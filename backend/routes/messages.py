from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, UploadFile, File
from pydantic import BaseModel
import asyncpg
from database import get_db, get_pool, publish_event
from auth_utils import get_current_user_id, decode_token
from notif_manager import notif_manager
import os
import uuid
import time
import base64
import hmac
import hashlib
import cloudinary
import cloudinary.uploader

CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    )

router = APIRouter()

# Signaling message types (not stored in DB — just forwarded)
SIGNAL_TYPES = {"call-offer", "call-answer", "ice-candidate", "call-end", "call-reject", "call-busy", "typing", "typing-stop"}
TURN_URLS = [u.strip() for u in (os.getenv("TURN_URLS", "") or "").split(",") if u.strip()]
TURN_SHARED_SECRET = os.getenv("TURN_SHARED_SECRET", "") or ""
TURN_TTL_SECONDS = int(os.getenv("TURN_TTL_SECONDS", "3600") or "3600")


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[tuple[WebSocket, str]]] = {}

    async def connect(self, ws: WebSocket, match_id: str, user_id: str):
        await ws.accept()
        if match_id not in self.rooms:
            self.rooms[match_id] = []
        self.rooms[match_id].append((ws, user_id))

    def disconnect(self, ws: WebSocket, match_id: str):
        if match_id in self.rooms:
            self.rooms[match_id] = [(w, u) for w, u in self.rooms[match_id] if w != ws]

    async def broadcast(self, match_id: str, message: dict):
        """Send to ALL users in the room."""
        if match_id in self.rooms:
            dead = []
            for ws, _ in self.rooms[match_id]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(ws, match_id)

    async def forward_to_others(self, match_id: str, sender_id: str, message: dict):
        """Forward signaling message to everyone except the sender."""
        if match_id in self.rooms:
            dead = []
            for ws, uid in self.rooms[match_id]:
                if uid != sender_id:
                    try:
                        await ws.send_json(message)
                    except Exception:
                        dead.append(ws)
            for ws in dead:
                self.disconnect(ws, match_id)


manager = ConnectionManager()


class SendMessageRequest(BaseModel):
    text: str


def serialize_msg(row) -> dict:
    d = dict(row)
    if d.get("created_at") and not isinstance(d["created_at"], str):
        d["created_at"] = d["created_at"].isoformat()
    return d


def chat_media_dir() -> str:
    base = os.path.join(os.path.dirname(__file__), "..", "static", "chat")
    os.makedirs(base, exist_ok=True)
    return base


@router.get("/turn/credentials")
async def turn_credentials(user_id: str = Depends(get_current_user_id)):
    if not TURN_URLS or not TURN_SHARED_SECRET:
        raise HTTPException(status_code=501, detail="TURN não configurado no servidor")
    ttl = max(300, min(TURN_TTL_SECONDS, 24 * 3600))
    exp = int(time.time()) + ttl
    username = f"{exp}:{user_id}"
    digest = hmac.new(TURN_SHARED_SECRET.encode("utf-8"), username.encode("utf-8"), hashlib.sha1).digest()
    credential = base64.b64encode(digest).decode("utf-8")
    return {"urls": TURN_URLS, "username": username, "credential": credential, "ttl": ttl}


@router.post("/upload")
async def upload_chat_media(
    file: UploadFile = File(...),
    type: str = "image",
    ttl_hours: int = 24,
    user_id: str = Depends(get_current_user_id),
):
    contents = await file.read()
    if type not in ("image", "audio"):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    if type == "image" and len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande")
    if type == "audio" and len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Áudio muito grande")
    ext = (file.filename.split(".")[-1] if file.filename else "").lower()
    if type == "image" and ext not in {"jpg", "jpeg", "png", "webp"}:
        ext = "jpg"
    if type == "audio" and ext not in {"webm", "ogg", "mp3", "m4a"}:
        ext = "webm"
    token = "img:" if type == "image" else "aud:"

    if CLOUDINARY_ENABLED:
        resource_type = "image" if type == "image" else "video"  # Cloudinary uses "video" for audio
        result = cloudinary.uploader.upload(
            contents,
            folder="angotinder/chat",
            resource_type=resource_type,
        )
        url = result["secure_url"]
        return {"url": url, "text": f"{token}{url}"}

    exp = int(time.time()) + max(1, ttl_hours) * 3600
    filename = f"{uuid.uuid4()}__exp{exp}.{ext}"
    path = os.path.join(chat_media_dir(), filename)
    with open(path, "wb") as f:
        f.write(contents)
    url = f"/static/chat/{filename}"
    return {"url": url, "text": f"{token}{url}"}


@router.get("/{match_id}")
async def get_messages(
    match_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT id FROM matches WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)",
        match_id, user_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=403, detail="Sem permissão")

    rows = await db.fetch(
        """SELECT m.*, u.name as sender_name
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.match_id=$1
           ORDER BY m.created_at ASC""",
        match_id,
    )
    return [serialize_msg(r) for r in rows]


@router.post("/{match_id}")
async def send_message(
    match_id: str,
    req: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    row = await db.fetchrow(
        "SELECT id FROM matches WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)",
        match_id, user_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=403, detail="Sem permissão")

    await db.execute(
        "INSERT INTO messages (match_id, sender_id, text) VALUES ($1, $2, $3)",
        match_id, user_id, req.text.strip(),
    )

    msg = await db.fetchrow(
        """SELECT m.*, u.name as sender_name FROM messages m
           JOIN users u ON u.id=m.sender_id
           WHERE m.match_id=$1 ORDER BY m.created_at DESC LIMIT 1""",
        match_id,
    )
    msg_dict = serialize_msg(msg)
    msg_payload = {"type": "message", "data": msg_dict}
    await manager.broadcast(match_id, msg_payload)
    await publish_event({"kind": "room_broadcast", "match_id": match_id, "message": msg_payload})
    other = await db.fetchrow(
        "SELECT CASE WHEN user1_id=$1 THEN user2_id ELSE user1_id END AS other_id FROM matches WHERE id=$2",
        user_id, match_id,
    )
    if other:
        await notif_manager.notify(other["other_id"], {"type": "new_message", "match_id": match_id, "preview": msg_dict.get("text", "")})
    return msg_dict


@router.websocket("/ws/{match_id}")
async def websocket_chat(
    ws: WebSocket,
    match_id: str,
    token: str = Query(...),
):
    try:
        user_id = decode_token(token)
    except Exception:
        await ws.close(code=4001)
        return

    pool = await get_pool()
    async with pool.acquire() as db:
        row = await db.fetchrow(
            "SELECT id FROM matches WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)",
            match_id, user_id, user_id,
        )
        if not row:
            await ws.close(code=4003)
            return

    await manager.connect(ws, match_id, user_id)
    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "text")

            # ── Call signaling: forward to the other user, do NOT store ──
            if msg_type in SIGNAL_TYPES:
                data["from"] = user_id
                await manager.forward_to_others(match_id, user_id, data)
                await publish_event({"kind": "room_signal", "match_id": match_id, "sender_id": user_id, "message": data})
                continue

            # ── Regular text message ──
            text = data.get("text", "").strip()
            if not text:
                continue

            async with pool.acquire() as db:
                await db.execute(
                    "INSERT INTO messages (match_id, sender_id, text) VALUES ($1, $2, $3)",
                    match_id, user_id, text,
                )
                msg = await db.fetchrow(
                    """SELECT m.*, u.name as sender_name FROM messages m
                       JOIN users u ON u.id=m.sender_id
                       WHERE m.match_id=$1 ORDER BY m.created_at DESC LIMIT 1""",
                    match_id,
                )
                other = await db.fetchrow(
                    "SELECT CASE WHEN user1_id=$1 THEN user2_id ELSE user1_id END AS other_id FROM matches WHERE id=$2",
                    user_id, match_id,
                )

            msg_payload = {"type": "message", "data": serialize_msg(msg)}
            await manager.broadcast(match_id, msg_payload)
            await publish_event({"kind": "room_broadcast", "match_id": match_id, "message": msg_payload})
            if other:
                await notif_manager.notify(other["other_id"], {"type": "new_message", "match_id": match_id, "preview": text})

    except WebSocketDisconnect:
        manager.disconnect(ws, match_id)
