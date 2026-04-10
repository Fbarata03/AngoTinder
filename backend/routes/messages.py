from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
import aiosqlite
import json
from database import get_db, DB_PATH
from auth_utils import get_current_user_id, decode_token

router = APIRouter()

# In-memory WebSocket manager
class ConnectionManager:
    def __init__(self):
        # match_id -> list of (websocket, user_id)
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


@router.get("/{match_id}")
async def get_messages(
    match_id: str,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Verify user is in this match
    async with db.execute(
        "SELECT id FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)",
        (match_id, user_id, user_id),
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=403, detail="Sem permissão")

    async with db.execute(
        """SELECT m.*, u.name as sender_name
           FROM messages m
           JOIN users u ON u.id = m.sender_id
           WHERE m.match_id=?
           ORDER BY m.created_at ASC""",
        (match_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/{match_id}")
async def send_message(
    match_id: str,
    req: SendMessageRequest,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Mensagem vazia")

    # Verify user is in this match
    async with db.execute(
        "SELECT id FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)",
        (match_id, user_id, user_id),
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=403, detail="Sem permissão")

    await db.execute(
        "INSERT INTO messages (match_id, sender_id, text) VALUES (?, ?, ?)",
        (match_id, user_id, req.text.strip()),
    )
    await db.commit()

    async with db.execute(
        "SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.match_id=? ORDER BY m.created_at DESC LIMIT 1",
        (match_id,),
    ) as cur:
        msg = await cur.fetchone()

    msg_dict = dict(msg)

    # Broadcast via WebSocket
    await manager.broadcast(match_id, {"type": "message", "data": msg_dict})

    return msg_dict


@router.websocket("/ws/{match_id}")
async def websocket_chat(
    ws: WebSocket,
    match_id: str,
    token: str = Query(...),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Verify token
    try:
        user_id = decode_token(token)
    except Exception:
        await ws.close(code=4001)
        return

    # Verify user is in this match
    async with db.execute(
        "SELECT id FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)",
        (match_id, user_id, user_id),
    ) as cur:
        if not await cur.fetchone():
            await ws.close(code=4003)
            return

    await manager.connect(ws, match_id, user_id)
    try:
        while True:
            data = await ws.receive_json()
            text = data.get("text", "").strip()
            if not text:
                continue

            # Save message to DB
            async with aiosqlite.connect(DB_PATH) as save_db:
                save_db.row_factory = aiosqlite.Row
                await save_db.execute(
                    "INSERT INTO messages (match_id, sender_id, text) VALUES (?, ?, ?)",
                    (match_id, user_id, text),
                )
                await save_db.commit()
                async with save_db.execute(
                    "SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.match_id=? ORDER BY m.created_at DESC LIMIT 1",
                    (match_id,),
                ) as cur:
                    msg = await cur.fetchone()

            await manager.broadcast(match_id, {"type": "message", "data": dict(msg)})

    except WebSocketDisconnect:
        manager.disconnect(ws, match_id)
