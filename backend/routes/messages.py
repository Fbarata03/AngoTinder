from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
import asyncpg
from database import get_db, get_pool
from auth_utils import get_current_user_id, decode_token

router = APIRouter()


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
        if match_id in self.rooms:
            dead = []
            for ws, _ in self.rooms[match_id]:
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
    await manager.broadcast(match_id, {"type": "message", "data": msg_dict})
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

            await manager.broadcast(match_id, {"type": "message", "data": serialize_msg(msg)})

    except WebSocketDisconnect:
        manager.disconnect(ws, match_id)
