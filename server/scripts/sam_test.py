"""Local SAM 3.1 test on MPS. Run: uv run python -m scripts.sam_test <image> "<text prompt>" """

import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import Sam3Model, Sam3Processor

REPO = "unsloth/sam3.1"
device = "mps" if torch.backends.mps.is_available() else "cpu"

t = time.time()
processor = Sam3Processor.from_pretrained(REPO)
model = Sam3Model.from_pretrained(REPO).to(device).eval()
print(f"loaded {REPO} on {device} in {time.time() - t:.1f}s")

img_path, prompt = sys.argv[1], sys.argv[2]
image = Image.open(img_path).convert("RGB")

for i in range(2):  # second run shows warm latency
    t = time.time()
    inputs = processor(images=image, text=prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)
    res = processor.post_process_instance_segmentation(
        outputs, threshold=0.5, mask_threshold=0.5,
        target_sizes=inputs.get("original_sizes").tolist())[0]
    print(f"run {i}: {len(res['masks'])} masks in {time.time() - t:.2f}s, scores={res['scores'].tolist()}")

if len(res["masks"]):
    m = res["masks"][0].cpu().numpy().astype(bool)
    rgba = np.dstack([np.array(image), (m * 255).astype(np.uint8)])
    out = Path(img_path).with_name("cutout.png")
    Image.fromarray(rgba).save(out)
    print("saved", out)
