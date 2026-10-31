"""Drawing + message → (placement, redrawn accessory, free CSS animation).

Muse Spark plans (vision + structured output), Muse Image redraws, then the CSS is checked:
it must parse, and only animation-related declarations on known duck parts are kept.
"""

import io
import re
import time
from pathlib import Path

import tinycss2
from PIL import Image

from . import performances, pipeline

PROMPT = (Path(__file__).parent / "prompts" / "duck_animator.md").read_text().replace(
    "{{PERFORMANCES}}", performances.prompt_examples())
PARTS = {"duck", "body", "head", "beak", "eye", "wing", "feet", "hand-l", "hand-r", "accessory"}
ATTACH = {"head", "body", "hand-r", "duck"}
ALLOWED_PROPS = re.compile(r"^(animation(-[a-z-]+)?|transform|transform-origin|opacity)$")
SELECTOR = re.compile(r'^\s*\[data-part="([a-z-]+)"\]\s*$')
FORBIDDEN = re.compile(r"url\(|expression|@import|javascript:|infinite", re.I)

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string"},
        "attach_to": {"type": "string", "enum": sorted(ATTACH)},
        "placement": {"type": "object", "properties": {
            "x": {"type": "number"}, "y": {"type": "number"}, "w": {"type": "number"}, "h": {"type": "number"},
            "rotate": {"type": "number"}}, "required": ["x", "y", "w", "h", "rotate"]},
        "image_prompt": {"type": "string"},
        "css": {"type": "string"},
        "duration_ms": {"type": "integer"},
        "bubble": {"type": "string"},
    },
    "required": ["label", "attach_to", "placement", "image_prompt", "css", "duration_ms", "bubble"],
}

FALLBACK_CSS = """@keyframes dk-wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-6deg) } 75% { transform: rotate(6deg) } }
[data-part="duck"] { animation: dk-wiggle 1s ease-in-out 3 }"""


def check_css(css: str) -> dict:
    """Parse and sanitize model CSS. Returns {css, ok, notes}. ok=False means we fell back."""
    notes: list[str] = []
    rules = tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True)
    out: list[str] = []
    for rule in rules:
        if rule.type == "error":
            notes.append(f"parse error: {rule.message}")
            continue
        if rule.type == "at-rule":
            if rule.lower_at_keyword != "keyframes" or rule.content is None:
                notes.append(f"dropped @{rule.at_keyword}")
                continue
            body = tinycss2.serialize(rule.content)
            if FORBIDDEN.search(body):
                notes.append("dropped keyframes with forbidden value")
                continue
            name = tinycss2.serialize(rule.prelude).strip()
            out.append(f"@keyframes {name} {{{body}}}")
            continue
        selector = tinycss2.serialize(rule.prelude).strip()
        selectors = [s for s in selector.split(",")]
        good = [s.strip() for s in selectors if (m := SELECTOR.match(s)) and m.group(1) in PARTS]
        if len(good) != len(selectors):
            notes.append(f"dropped selector {selector!r}")
        if not good:
            continue
        decls = tinycss2.parse_blocks_contents(rule.content, skip_whitespace=True, skip_comments=True)
        kept = []
        for d in decls:
            if d.type != "declaration":
                continue
            value = tinycss2.serialize(d.value).strip()
            if not ALLOWED_PROPS.match(d.lower_name) or FORBIDDEN.search(value):
                notes.append(f"dropped {d.lower_name}: {value[:40]}")
                continue
            kept.append(f"{d.lower_name}: {value}")
        if kept:
            out.append(f"{', '.join(good)} {{ {'; '.join(kept)} }}")
    has_animation = any("animation" in r for r in out if not r.startswith("@"))
    if not has_animation:
        notes.append("no usable animation → fallback")
        return {"css": FALLBACK_CSS, "ok": False, "notes": notes}
    return {"css": "\n".join(out), "ok": True, "notes": notes}


def _crop(doodle: bytes, bbox: dict | None) -> bytes:
    """Crop the full-frame doodle (transparent PNG) to its bbox, flattened on white for the image model."""
    im = Image.open(io.BytesIO(doodle)).convert("RGBA")
    if bbox:
        s = im.width / 200
        box = (int(bbox["x"] * s), int(bbox["y"] * s), int((bbox["x"] + bbox["w"]) * s), int((bbox["y"] + bbox["h"]) * s))
        im = im.crop(box)
    bg = Image.new("RGBA", im.size, "white")
    bg.alpha_composite(im)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "PNG")
    return buf.getvalue()


def _placement_from_bbox(bbox: dict | None) -> dict:
    b = bbox or {"x": 90, "y": 0, "w": 70, "h": 50}
    return {"x": b["x"] / 2, "y": b["y"] / 2, "w": b["w"] / 2, "h": b["h"] / 2, "rotate": 0}


def generate(composite: bytes | None, doodle: bytes | None, bbox: dict | None, message: str,
             quality: float, live: bool) -> dict:
    """Returns a draft: {label, attach_to, placement, accessory_png, css, css_check, duration_ms, bubble, timings, raw}."""
    timings: dict[str, int] = {}
    draft = {"label": "drawing", "attach_to": pipeline.SLOT_PARENT.get(pipeline.slot_for_bbox(bbox), "head")
             if bbox else "head", "placement": _placement_from_bbox(bbox), "accessory_png": doodle,
             "duration_ms": 3000, "bubble": "Ooh, for me?", "raw": None}
    if not live:
        check = check_css(FALLBACK_CSS)
        return {**draft, "css": check["css"], "css_check": check, "timings": timings}

    from . import muse
    t = time.time()
    plan = muse.spark_json(
        PROMPT,
        f"Friend's message: {message!r}\n"
        f"Image 1: the duck with the friend's drawing on top. Image 2: only the drawing.\n"
        f"The drawing's bounding box in percent of the duck box is x={draft['placement']['x']:.0f}%, "
        f"y={draft['placement']['y']:.0f}%, w={draft['placement']['w']:.0f}%, h={draft['placement']['h']:.0f}%.",
        PLAN_SCHEMA, "DuckPlan",
        images=[i for i in [composite, _crop(doodle, bbox) if doodle else None] if i])
    timings["spark_ms"] = round((time.time() - t) * 1000)
    draft["raw"] = plan
    p = plan["placement"]
    draft.update(label=plan["label"], attach_to=plan["attach_to"] if plan["attach_to"] in ATTACH else "head",
                 placement={k: float(p[k]) for k in ("x", "y", "w", "h", "rotate")},
                 duration_ms=min(max(int(plan["duration_ms"]), 1500), 10000), bubble=plan["bubble"][:60])
    check = check_css(plan["css"])

    if doodle:
        t = time.time()
        img = muse.image_edit(
            f"Redraw this doodle: {plan['image_prompt']}, as {pipeline.quality_style(quality)}. Keep the doodle's "
            "shape, proportions and colors. No text. Centered, isolated on a plain solid bright green (#00FF00) "
            "background with nothing else.", [_crop(doodle, bbox)])
        timings["image_ms"] = round((time.time() - t) * 1000)
        draft["accessory_png"] = pipeline._chroma_key(img)
        draft["accessory_raw_png"] = img
    return {**draft, "css": check["css"], "css_check": check, "timings": timings}
