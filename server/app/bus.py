"""In-memory pub/sub between the tank screen and the camera page (Server-Sent Events)."""

import asyncio
import json

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from sse_starlette.sse import EventSourceResponse

router = APIRouter()
_subs: dict[str, set[asyncio.Queue]] = {}


def publish(to: str, event: dict) -> int:
    for q in _subs.get(to, set()):
        q.put_nowait(event)
    return len(_subs.get(to, set()))


@router.post("/api/bus/{to}")
async def send(to: str, request: Request) -> dict:
    return {"delivered": publish(to, await request.json())}


@router.get("/api/bus/{role}")
async def subscribe(role: str, request: Request):
    q: asyncio.Queue = asyncio.Queue()
    _subs.setdefault(role, set()).add(q)
    publish("camera" if role == "tank" else "tank", {"type": "peer", "role": role, "online": True})

    async def stream():
        try:
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(q.get(), timeout=15)
                    yield {"data": json.dumps(event)}
                except TimeoutError:
                    yield {"comment": "ping"}
        finally:
            _subs[role].discard(q)
            publish("camera" if role == "tank" else "tank", {"type": "peer", "role": role, "online": False})

    return EventSourceResponse(stream())


@router.get("/api/bus")
def peers() -> dict:
    return {role: len(qs) for role, qs in _subs.items()}


# ---------- live camera stream: camera page → tank (JPEG frames over WebSocket) ----------

_viewers: set[WebSocket] = set()


@router.websocket("/api/ws/stream/{role}")
async def stream(ws: WebSocket, role: str):
    await ws.accept()
    try:
        if role == "tank":
            _viewers.add(ws)
            while True:
                await ws.receive_text()  # keep-alive; tank never sends anything meaningful
        else:
            while True:
                frame = await ws.receive_bytes()
                for v in list(_viewers):
                    try:
                        await v.send_bytes(frame)
                    except Exception:  # noqa: BLE001
                        _viewers.discard(v)
    except WebSocketDisconnect:
        pass
    finally:
        _viewers.discard(ws)
