"""AI pipeline. AI_MODE=mock (default) uses hardcoded responses; AI_MODE=live calls the Meta Model API.

Local SAM runs in both modes (free).
"""

import io
import json
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

from . import performances, sam

MODE = os.environ.get("AI_MODE", "mock")
_ROOT = Path(__file__).resolve().parents[2]
STYLE = next(p for p in (_ROOT / "DUCK-STYLE.md", _ROOT / "docs" / "DUCK-STYLE.md") if p.exists()).read_text()

# Duck-space regions (viewBox 0 0 200 200) used to pick the slot a doodle belongs to.
SLOT_PARENT = {"hat": "head", "face": "head", "neck": "body", "body": "body", "back": "body", "held": "hand-r"}


def slot_for_bbox(b: dict) -> str:
    cx, cy = b["x"] + b["w"] / 2, b["y"] + b["h"] / 2
    if cy < 48 and cx > 80:
        return "hat"
    if cy < 92 and cx > 100:
        return "face"
    if cx > 150 and cy > 100:
        return "held"
    if cy < 115:
        return "neck"
    if cx < 55:
        return "back"
    return "body"


# ---------- live helpers ----------

PERF_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "duration_ms": {"type": "integer"},
        "props": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "slot": {"type": "string"}, "x": {"type": "number"},
            "y": {"type": "number"}, "svg": {"type": "string"}}, "required": ["id", "slot", "x", "y", "svg"]}},
        "tracks": {"type": "array", "items": {"type": "object", "properties": {
            "target": {"type": "string"},
            "easing": {"type": "string"},
            "iterations": {"type": "integer"},
            "keyframes": {"type": "array", "items": {"type": "object", "properties": {
                k: {"type": "number"} for k in
                ["t", "translateX", "translateY", "rotate", "scale", "scaleX", "scaleY", "opacity"]},
                "required": ["t"]}}}, "required": ["target", "keyframes"]}},
        "bubble": {"type": "array", "items": {"type": "object", "properties": {
            "t": {"type": "number"}, "text": {"type": "string"}}, "required": ["t", "text"]}},
    },
    "required": ["title", "duration_ms", "props", "tracks", "bubble"],
}


def _wav(media: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in", Path(d) / "out.wav"
        src.write_bytes(media)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000",
                        "-c:a", "pcm_s16le", str(dst)], check=True)
        return dst.read_bytes()


def _chroma_key(png: bytes) -> bytes:
    """Remove the solid green background Muse Image draws on."""
    im = np.array(Image.open(io.BytesIO(png)).convert("RGBA")).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    green = (g > 150) & (g > r + 60) & (g > b + 60)
    im[..., 3] = np.where(green, 0, 255)
    out = Image.fromarray(im.astype(np.uint8))
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()


def _flatten_white(png: bytes) -> bytes:
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    bg = Image.new("RGBA", im.size, "white")
    bg.alpha_composite(im)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "PNG")
    return buf.getvalue()


# ---------- public API ----------

def transcribe(media: bytes | None) -> str:
    if not media or MODE != "live":
        return ""
    from . import muse
    try:
        return muse.transcribe(_wav(media))
    except Exception as e:  # noqa: BLE001
        print("transcribe failed:", e)
        return ""


def quality_style(q: float) -> str:
    """Map the friend's 0–1 'drawn by a 5-year-old ↔ photo' slider to a Muse Image style description."""
    q = min(max(q, 0.0), 1.0)
    if q < 0.15:
        return ("a wobbly crayon scribble by a 5-year-old: shaky uneven lines, colors going outside the lines, "
                "lopsided proportions, paper texture")
    if q < 0.35:
        return "a child's felt-tip marker drawing: simple, slightly wonky, bright flat colors, thick uneven outline"
    if q < 0.6:
        return ("a clean flat cartoon sticker: thick dark navy outline (#1F2430), flat fills, no shading "
                "(the duck's house style)")
    if q < 0.85:
        return "a polished illustrated sticker: crisp outline, soft cel shading, highlights, rich detail"
    return "a photorealistic studio photo of the real object, natural materials and lighting, sharp focus"


def process_message(prompt: str, text: str, doodle: bytes | None, bbox: dict | None,
                    quality: float = 0.5) -> dict:
    """Returns {ok, reason, accessory: {url_bytes, slot, bbox} | None, performance}."""
    slot = slot_for_bbox(bbox) if bbox else None
    result = {"ok": True, "reason": "", "accessory_png": doodle, "slot": slot,
              "performance": performances.pick(f"{prompt} {text}")}
    if MODE != "live":
        return result

    from . import muse
    try:
        plan = muse.spark_json(
            "You run a desk toy: a cartoon duck that performs requests sent by friends. "
            "Follow this style guide strictly:\n\n" + STYLE,
            f"Friend's request for the duck: {prompt!r}\nFriend's message: {text!r}\n"
            f"The attached image is the friend's doodle drawn on the duck (slot guess: {slot}).\n"
            "1) Moderate: reject hateful, sexual, violent or harassing content.\n"
            "2) Write a performance (style guide section 6) that does what the friend asked, "
            "3-8 seconds, fun and expressive.",
            {"type": "object", "properties": {
                "ok": {"type": "boolean"}, "reason": {"type": "string"},
                "doodle_label": {"type": "string"},
                "performance": PERF_SCHEMA}, "required": ["ok", "reason", "doodle_label", "performance"]},
            "DuckPlan", images=[_flatten_white(doodle)] if doodle else None)
        result.update(ok=plan["ok"], reason=plan["reason"], performance=plan["performance"])
        if plan["ok"] and doodle:
            img = muse.image_edit(
                f"Redraw this doodle of a {plan['doodle_label']} as {quality_style(quality)}. Keep the same "
                "shape, proportions and colors as the doodle. No text, centered, isolated on a plain solid bright "
                "green (#00FF00) background with nothing else.", [_flatten_white(doodle)])
            result["accessory_png"] = _chroma_key(img)
    except Exception as e:  # noqa: BLE001
        print("live pipeline failed, using mock:", e)
    return result


def show_and_tell(frame: bytes, hint: str = "") -> dict:
    """Segment the held object, return {label, cutout_png, performance} or {error}."""
    image = Image.open(io.BytesIO(frame)).convert("RGB")
    label = hint or "object held in hand"
    perf = None
    if MODE == "live" and not hint:
        from . import muse
        try:
            r = muse.spark_json(
                "You run a desk toy duck. Style guide:\n\n" + STYLE,
                "Name the main object the person is holding up (1-3 words, a noun phrase usable as a "
                "segmentation prompt), then invent a funny short performance where the duck plays with it. "
                "The object is placed in the 'held' slot (hand-r), so animate hand-r with opacity 1.",
                {"type": "object", "properties": {"label": {"type": "string"}, "performance": PERF_SCHEMA},
                 "required": ["label", "performance"]}, "ShowTell", images=[frame])
            label, perf = r["label"], r["performance"]
        except Exception as e:  # noqa: BLE001
            print("live show&tell failed, using mock:", e)
    masks = sam.segment(image, label, threshold=0.4) if (hint or MODE == "live") else []
    if not masks and not hint:
        # Try concrete things people hold up first (SAM is much better with nouns), generic prompts last.
        area = image.width * image.height
        for guess in ["mug", "cup", "phone", "bottle", "can", "book", "toy", "fruit", "pen", "glasses",
                      "handheld object", "object held in hand"]:
            found = [m for m in sam.segment(image, guess, threshold=0.35) if m[0].sum() / area > 0.005]
            if found:
                masks, label = found, guess if "object" not in guess else "thing"
                break
    dbg = Path(__file__).resolve().parents[2] / "data" / "debug"
    dbg.mkdir(parents=True, exist_ok=True)
    (dbg / "showtell.jpg").write_bytes(frame)
    if not masks:
        return {"error": "I couldn't see a thing"}
    nice = label if label != "object held in hand" else "thing"
    return {"label": nice, "cutout_png": sam.cutout_png(image, masks[0][0]),
            "performance": perf or performances.show_and_tell(nice)}


def _mask_png(mask: np.ndarray) -> str:
    """Mask as a small base64 PNG (white on transparent) for the debug overlay."""
    import base64
    im = Image.fromarray((mask * 255).astype(np.uint8))
    im.thumbnail((256, 256))
    rgba = Image.new("RGBA", im.size, (255, 255, 255, 0))
    rgba.putalpha(im)
    buf = io.BytesIO()
    rgba.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _detections(image: Image.Image, prompt: str, threshold: float) -> list[dict]:
    area = image.width * image.height
    out = []
    for mask, score in sam.segment(image, prompt, threshold=threshold):
        ys, xs = np.where(mask)
        if not len(xs):
            continue
        out.append({"prompt": prompt, "score": round(score, 3), "area": round(float(mask.sum() / area), 4),
                    "box": [xs.min() / image.width, ys.min() / image.height,
                            xs.max() / image.width, ys.max() / image.height],
                    "mask": _mask_png(mask)})
    return out


def presence(frame: bytes) -> dict:
    """Face + hands via Apple Vision (fast, OS framework). A raised hand = 'showing something' → Show & Tell.
    The SAM cutout happens later, after the tank's countdown (see show_and_tell)."""
    import json as _json
    import time
    from . import faces as vision
    t = time.time()
    def box_area(b):
        return round((b[2] - b[0]) * (b[3] - b[1]), 4)
    found = [{"prompt": "face", "score": f["score"], "box": f["box"], "area": box_area(f["box"]), "mask": None}
             for f in vision.detect(frame)]
    hands = [{"prompt": "hand", "score": h["score"], "box": h["box"], "area": box_area(h["box"]), "mask": None}
             for h in vision.hands(frame)]
    holding = any(h["area"] > 0.004 for h in hands)
    res = {"present": bool(found) or holding, "holding": holding, "detections": found + hands,
           "face_ms": round((time.time() - t) * 1000), "ms": round((time.time() - t) * 1000)}
    # Keep the last checked frame + result for debugging (data/debug/).
    dbg = Path(__file__).resolve().parents[2] / "data" / "debug"
    dbg.mkdir(parents=True, exist_ok=True)
    (dbg / "presence.jpg").write_bytes(frame)
    (dbg / "presence.json").write_text(_json.dumps(res, indent=2))
    return res


def dump(obj) -> str:
    return json.dumps(obj)
