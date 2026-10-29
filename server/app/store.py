"""Tiny JSON-file store. Single machine, single process — good enough for the hackathon."""

import json
import threading
import time
import uuid
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"
MEDIA = DATA / "media"
MEDIA.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA / "db.json"

_lock = threading.Lock()


def _load() -> dict:
    db = json.loads(DB_PATH.read_text()) if DB_PATH.exists() else {}
    for kind in ("messages", "replies", "showtell", "drafts"):
        db.setdefault(kind, [])
    return db


def _save(db: dict) -> None:
    tmp = DB_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(db, indent=2))
    tmp.replace(DB_PATH)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


def save_media(data: bytes, ext: str) -> str:
    """Store bytes under data/media and return the public URL."""
    name = f"{new_id()}.{ext}"
    (MEDIA / name).write_bytes(data)
    return f"/api/media/{name}"


def media_path(url: str) -> Path:
    return MEDIA / url.rsplit("/", 1)[-1]


def add(kind: str, item: dict) -> dict:
    with _lock:
        db = _load()
        item = {"id": new_id(), "created": time.time(), **item}
        db[kind].append(item)
        _save(db)
        return item


def update(kind: str, item_id: str, **fields) -> dict | None:
    with _lock:
        db = _load()
        for item in db[kind]:
            if item["id"] == item_id:
                item.update(fields)
                _save(db)
                return item
    return None


def get(kind: str, item_id: str) -> dict | None:
    return next((i for i in _load()[kind] if i["id"] == item_id), None)


def query(kind: str, **filters) -> list[dict]:
    return [i for i in _load()[kind] if all(i.get(k) == v for k, v in filters.items())]
