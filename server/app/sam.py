"""Local SAM 3.1 (open weights, MPS). Loaded lazily on first use."""

import io
import threading

import numpy as np
from PIL import Image, ImageFilter

REPO = "unsloth/sam3.1"
_model = None
_processor = None
_device = "cpu"
_lock = threading.Lock()


def _load():
    global _model, _processor, _device
    if _model is None:
        import torch
        from transformers import Sam3Model, Sam3Processor

        _device = "mps" if torch.backends.mps.is_available() else "cpu"
        _processor = Sam3Processor.from_pretrained(REPO)
        _model = Sam3Model.from_pretrained(REPO).to(_device).eval()


def segment(image: Image.Image, prompt: str, threshold: float = 0.5) -> list[tuple[np.ndarray, float]]:
    """Return [(bool mask HxW, score)] sorted by score desc."""
    import torch

    with _lock:
        _load()
        inputs = _processor(images=image, text=prompt, return_tensors="pt").to(_device)
        with torch.no_grad():
            outputs = _model(**inputs)
        res = _processor.post_process_instance_segmentation(
            outputs, threshold=threshold, mask_threshold=0.5,
            target_sizes=inputs.get("original_sizes").tolist())[0]
    out = [(m.cpu().numpy().astype(bool), float(s)) for m, s in zip(res["masks"], res["scores"])]
    return sorted(out, key=lambda x: -x[1])


def cutout_png(image: Image.Image, mask: np.ndarray, outline: int = 6) -> bytes:
    """Crop to mask, transparent background, ink outline around the edge (sticker look)."""
    ys, xs = np.where(mask)
    pad = outline * 2
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, mask.shape[1] - 1)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, mask.shape[0] - 1)
    rgb = np.array(image.convert("RGB"))[y0:y1 + 1, x0:x1 + 1]
    m = Image.fromarray((mask[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8))
    grown = m.filter(ImageFilter.MaxFilter(outline * 2 + 1))
    ink = Image.new("RGBA", m.size, (31, 36, 48, 255))
    out = Image.new("RGBA", m.size, (0, 0, 0, 0))
    out.paste(ink, mask=grown)
    out.paste(Image.fromarray(rgb).convert("RGBA"), mask=m)
    buf = io.BytesIO()
    out.save(buf, "PNG")
    return buf.getvalue()
