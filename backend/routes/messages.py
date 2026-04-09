from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
from database import get_db

router = APIRouter()


class SendMessageRequest(BaseModel):
    sender_id: str
    text: str


@router.get("/{match_id}")
async def get_messages(match_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        """
        SELECT m.*, u.name as sender_name
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.match_id = ?
        ORDER BY m.created_at ASC
        """,
        (match_id,),
    ) as cursor:
        rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.post("/{match_id}")
async def send_message(
    match_id: str,
    req: SendMessageRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    await db.execute(
        "INSERT INTO messages (match_id, sender_id, text) VALUES (?, ?, ?)",
        (match_id, req.sender_id, req.text),
    )
    await db.commit()

    async with db.execute(
        "SELECT * FROM messages WHERE match_id = ? ORDER BY created_at DESC LIMIT 1",
        (match_id,),
    ) as cursor:
        row = await cursor.fetchone()
    return dict(row)


@router.get("/last/{match_id}")
async def get_last_message(match_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM messages WHERE match_id = ? ORDER BY created_at DESC LIMIT 1",
        (match_id,),
    ) as cursor:
        row = await cursor.fetchone()
    if row:
        return dict(row)
    return None
