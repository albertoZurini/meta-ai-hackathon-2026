"""Smoke test for the Meta Model API. Run: uv run python -m scripts.smoke"""

import io
import subprocess
import time
from pathlib import Path

from PIL import Image, ImageDraw

from app import muse

OUT = Path(__file__).resolve().parents[2] / "data" / "smoke"
OUT.mkdir(parents=True, exist_ok=True)


def timed(label, fn):
    t = time.time()
    try:
        out = fn()
        print(f"✓ {label} ({time.time() - t:.1f}s)")
        return out
    except Exception as e:  # noqa: BLE001
        print(f"✗ {label}: {e}")
        return None


# A crude "doodle": purple crown strokes on white.
img = Image.new("RGB", (512, 512), "white")
d = ImageDraw.Draw(img)
d.line([(120, 380), (150, 160), (230, 300), (256, 120), (290, 300), (370, 160), (400, 380), (120, 380)],
       fill="#7C3AED", width=14)
buf = io.BytesIO()
img.save(buf, "PNG")
doodle = buf.getvalue()
(OUT / "doodle.png").write_bytes(doodle)

res = timed("spark text + image + json schema", lambda: muse.spark_json(
    "You classify kids' doodles.",
    "What is this doodle meant to be? Which body slot of a duck: hat, face, neck, body, held, back?",
    {"type": "object",
     "properties": {"label": {"type": "string"}, "slot": {"type": "string"}},
     "required": ["label", "slot"]},
    "Doodle", images=[doodle]))
print("   ", res)

png = timed("image edit (doodle → accessory)", lambda: muse.image_edit(
    "Redraw this doodle as a clean flat cartoon sticker: same shape and colors, thick dark navy "
    "outline (#1F2430), flat fills, no shading, centered, on a plain solid bright green (#00FF00) background.",
    [doodle]))
if png:
    (OUT / "accessory.png").write_bytes(png)
    print("    saved", OUT / "accessory.png")

# 2 seconds of generated speech-free tone → WAV via ffmpeg (just checks the endpoint accepts it).
wav = OUT / "tone.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)], check=True)
txt = timed("transcribe (tone, expect empty)", lambda: muse.transcribe(wav.read_bytes()))
print("    transcript:", repr(txt))
