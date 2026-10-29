"""Thin client for the Meta Model API (OpenAI-compatible)."""

import base64
import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

BASE_URL = "https://api.meta.ai/v1"
API_KEY = os.environ["META_DEV_API_KEY"]

SPARK = "muse-spark-1.3"
IMAGE = "muse-image-1.0"
TRANSCRIBE = "muse-voice-transcribe-1.0"

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)


def data_url(png_bytes: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(png_bytes).decode()}"


def spark_json(system: str, user_text: str, schema: dict, name: str,
               images: list[bytes] | None = None) -> dict:
    """Call Muse Spark with optional images and a JSON schema; return parsed JSON."""
    content: list[dict] = [{"type": "text", "text": user_text}]
    for img in images or []:
        content.append({"type": "image_url", "image_url": {"url": data_url(img)}})
    resp = client.chat.completions.create(
        model=SPARK,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": content}],
        response_format={"type": "json_schema",
                         "json_schema": {"name": name, "schema": schema}},
    )
    return json.loads(resp.choices[0].message.content)


def image_edit(prompt: str, images: list[bytes], size: str = "1024x1024") -> bytes:
    """Muse Image edit: returns PNG bytes (opaque background)."""
    r = httpx.post(
        f"{BASE_URL}/images/edits",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"model": IMAGE, "prompt": prompt, "n": 1, "size": size,
              "output_format": "png",
              "images": [{"image_url": data_url(i)} for i in images]},
        timeout=120,
    )
    r.raise_for_status()
    return base64.b64decode(r.json()["data"][0]["b64_json"])


def image_generate(prompt: str, size: str = "1024x1024") -> bytes:
    r = httpx.post(
        f"{BASE_URL}/images/generations",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"model": IMAGE, "prompt": prompt, "n": 1, "size": size,
              "output_format": "png", "response_format": "b64_json"},
        timeout=120,
    )
    r.raise_for_status()
    return base64.b64decode(r.json()["data"][0]["b64_json"])


def transcribe(wav_bytes: bytes) -> str:
    """Transcribe mono 16-bit PCM WAV (16/24 kHz)."""
    req = {"model": TRANSCRIBE, "mode": "PUSH_TO_TALK", "audioEncoding": "WAV"}
    r = httpx.post(
        f"{BASE_URL}/asr/transcribe",
        headers={"Authorization": f"Bearer {API_KEY}"},
        files={"request": (None, json.dumps(req), "application/json"),
               "audio": ("audio.wav", wav_bytes, "audio/wav")},
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["transcript"]
