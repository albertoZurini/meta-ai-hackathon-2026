import json
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from . import animator, bus, pipeline, store

OWNER = os.environ.get("DUCK_OWNER", "alberto")
MAX_VIDEO = 25 * 1024 * 1024

app = FastAPI(title="Duck server")
app.include_router(bus.router)


def _ext(upload: UploadFile) -> str:
    ct = upload.content_type or ""
    return "mp4" if "mp4" in ct else "webm"


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "mode": pipeline.MODE, "owner": OWNER}


@app.get("/api/performances")
def performance_library() -> dict:
    """Hand-written performances (used by the tank's simulation keys)."""
    return pipeline.performances.LIBRARY


@app.get("/api/media/{name}")
def media(name: str):
    path = store.MEDIA / name
    if "/" in name or not path.exists():
        raise HTTPException(404)
    return FileResponse(path)


# ---------- AI drafts: drawing + message → placement, redrawn accessory, CSS animation ----------

@app.post("/api/drafts")
async def create_draft(
    message: str = Form(""),
    quality: float = Form(0.5),
    bbox: str = Form(""),
    lab: bool = Form(False),
    composite: UploadFile | None = File(None),
    doodle: UploadFile | None = File(None),
):
    """Preview for the friend page (live if AI_MODE=live) and QA runs on /lab (always live)."""
    box = json.loads(bbox) if bbox else None
    doodle_bytes = await doodle.read() if doodle else None
    composite_bytes = await composite.read() if composite else None
    live = lab or pipeline.MODE == "live"
    try:
        d = animator.generate(composite_bytes, doodle_bytes, box, message, quality, live)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"AI generation failed: {e}") from e
    return store.add("drafts", {
        "lab": lab, "live": live, "message": message[:500], "quality": quality, "bbox": box,
        "doodle": store.save_media(doodle_bytes, "png") if doodle_bytes else None,
        "composite": store.save_media(composite_bytes, "png") if composite_bytes else None,
        "accessory": {
            "url": store.save_media(d["accessory_png"], "png"), "attach_to": d["attach_to"],
            "placement": d["placement"],
        } if d["accessory_png"] else None,
        "accessory_raw": store.save_media(d["accessory_raw_png"], "png") if d.get("accessory_raw_png") else None,
        "label": d["label"], "css": d["css"], "css_check": d["css_check"], "duration_ms": d["duration_ms"],
        "bubble": d["bubble"], "timings": d["timings"], "raw": d["raw"],
    })


@app.get("/api/lab")
def lab_runs():
    return store.query("drafts", lab=True)


# ---------- friend side ----------

@app.post("/api/messages")
async def create_message(
    owner: str = Form(...),
    friend_id: str = Form(...),
    from_name: str = Form(...),
    prompt: str = Form(""),
    quality: float = Form(0.5),
    text: str = Form(""),
    bbox: str = Form(""),
    doodle: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    draft_id: str = Form(""),
):
    if owner != OWNER:
        raise HTTPException(404, "No duck here")
    if draft_id:
        d = store.get("drafts", draft_id)
        if not d:
            raise HTTPException(404, "Draft not found")
        return store.add("messages", {
            "owner": owner, "friend_id": friend_id, "from_name": from_name[:40], "prompt": "",
            "text": text[:500], "video": None, "transcript": "", "accessory": None, "placed": d["accessory"],
            "css": d["css"], "duration_ms": d["duration_ms"], "bubble": d["bubble"], "label": d["label"],
            "performance": pipeline.performances.pick(""), "status": "pending", "draft_id": draft_id,
        })
    doodle_bytes = await doodle.read() if doodle else None
    video_bytes = await video.read() if video else None
    if video_bytes and len(video_bytes) > MAX_VIDEO:
        raise HTTPException(413, "Video too large")
    box = json.loads(bbox) if bbox else None

    res = pipeline.process_message(prompt, text, doodle_bytes, box, quality)
    if not res["ok"]:
        raise HTTPException(422, res["reason"] or "The duck didn't like that one")

    accessory = None
    if res["accessory_png"] and box:
        accessory = {"url": store.save_media(res["accessory_png"], "png"), "slot": res["slot"], "bbox": box}
    video_url = store.save_media(video_bytes, _ext(video)) if video_bytes else None
    msg = store.add("messages", {
        "owner": owner, "friend_id": friend_id, "from_name": from_name[:40],
        "prompt": prompt[:200], "text": text[:500], "video": video_url, "quality": quality,
        "transcript": pipeline.transcribe(video_bytes), "accessory": accessory,
        "performance": res["performance"], "status": "pending",
    })
    return msg


@app.get("/api/f/{owner}/replies")
def friend_replies(owner: str, friend_id: str):
    """Replies for a friend, each with the duck they originally sent (so the page can show both)."""
    out = []
    for r in store.query("replies", owner=owner, friend_id=friend_id):
        msg = store.get("messages", r["to_message"]) if r.get("to_message") else None
        if msg:
            r = {**r, "message": {k: msg.get(k) for k in
                 ("text", "css", "placed", "bubble", "duration_ms", "accessory", "performance", "created")}}
        out.append(r)
    return out


# ---------- tank (owner) ----------

@app.get("/api/messages/pending")
def pending():
    return store.query("messages", owner=OWNER, status="pending")


@app.get("/api/messages")
def all_messages():
    return store.query("messages", owner=OWNER)


@app.post("/api/messages/{msg_id}/viewed")
def viewed(msg_id: str):
    msg = store.update("messages", msg_id, status="viewed")
    if not msg:
        raise HTTPException(404)
    return msg


@app.post("/api/messages/{msg_id}/reply")
async def reply(msg_id: str, photo: UploadFile | None = File(None), video: UploadFile | None = File(None)):
    """Reply to a message with a photo (tank flow) or a video."""
    msg = store.get("messages", msg_id)
    if not msg:
        raise HTTPException(404)
    upload = photo or video
    if not upload:
        raise HTTPException(400, "photo or video required")
    data = await upload.read()
    if len(data) > MAX_VIDEO:
        raise HTTPException(413, "Too large")
    base = {"owner": OWNER, "friend_id": msg["friend_id"], "to_message": msg_id}
    if photo:
        return store.add("replies", {**base, "kind": "photo", "photo": store.save_media(data, "jpg"),
                                     "performance": pipeline.performances.pick("love")})
    transcript = pipeline.transcribe(data)
    return store.add("replies", {**base, "kind": "video", "video": store.save_media(data, _ext(video)),
                                 "transcript": transcript,
                                 "performance": pipeline.performances.pick(transcript or "wave")})


@app.post("/api/presence")
async def presence(frame: UploadFile = File(...)):
    return pipeline.presence(await frame.read())


@app.post("/api/face")
async def face(frame: UploadFile = File(...)):
    """Fast face check only (Apple Vision), used to auto-open a message when you look at the screen."""
    from . import faces
    found = faces.detect(await frame.read())
    return {"present": bool(found), "faces": found}


@app.post("/api/showtell")
async def showtell(frame: UploadFile = File(...), hint: str = Form("")):
    res = pipeline.show_and_tell(await frame.read(), hint)
    if "error" in res:
        raise HTTPException(422, res["error"])
    item = store.add("showtell", {"label": res["label"], "cutout": store.save_media(res["cutout_png"], "png"),
                                  "performance": res["performance"]})
    return item


@app.post("/api/showtell/{item_id}/gift")
def gift(item_id: str, friend_id: str = Form(...)):
    item = store.get("showtell", item_id)
    if not item:
        raise HTTPException(404)
    return store.add("replies", {
        "owner": OWNER, "friend_id": friend_id, "kind": "gift", "label": item["label"],
        "cutout": item["cutout"], "performance": item["performance"],
    })


@app.get("/api/friends")
def friends():
    """Friends who have sent messages (for gifting)."""
    seen = {}
    for m in store.query("messages", owner=OWNER):
        seen[m["friend_id"]] = m["from_name"]
    return [{"friend_id": k, "name": v} for k, v in seen.items()]
