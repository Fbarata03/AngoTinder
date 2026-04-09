import json
import uuid
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import aiosqlite
from database import get_db
from auth_utils import get_current_user_id

router = APIRouter()


class SwipeRequest(BaseModel):
    swiped_id: str
    direction: str  # "left" | "right" | "super"


def parse_user(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
    d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
    return d


@router.post("/swipe")
async def swipe(
    req: SwipeRequest,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Validate target user exists
    async with db.execute("SELECT id FROM users WHERE id = ?", (req.swiped_id,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=404, detail="Perfil não encontrado")

    # Record swipe (ignore duplicate)
    try:
        await db.execute(
            "INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)",
            (user_id, req.swiped_id, req.direction),
        )
        await db.commit()
    except Exception:
        pass  # already swiped

    if req.direction == "left":
        return {"is_match": False, "match_id": None}

    # Check for mutual like
    async with db.execute(
        "SELECT id FROM swipes WHERE swiper_id = ? AND swiped_id = ? AND direction IN ('right', 'super')",
        (req.swiped_id, user_id),
    ) as cur:
        mutual = await cur.fetchone()

    # Check if match already exists
    async with db.execute(
        "SELECT id FROM matches WHERE (user1_id=? AND user2_id=?) OR (user1_id=? AND user2_id=?)",
        (user_id, req.swiped_id, req.swiped_id, user_id),
    ) as cur:
        existing_match = await cur.fetchone()

    if existing_match:
        return {"is_match": True, "match_id": existing_match["id"]}

    if mutual:
        match_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO matches (id, user1_id, user2_id) VALUES (?, ?, ?)",
            (match_id, user_id, req.swiped_id),
        )
        await db.commit()
        return {"is_match": True, "match_id": match_id}

    return {"is_match": False, "match_id": None}


@router.get("/")
async def get_matches(
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        """
        SELECT m.id as match_id, m.created_at as matched_at,
               u.*,
               (SELECT text FROM messages WHERE match_id=m.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE match_id=m.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM matches m
        JOIN users u ON u.id = CASE WHEN m.user1_id=? THEN m.user2_id ELSE m.user1_id END
        WHERE m.user1_id=? OR m.user2_id=?
        ORDER BY COALESCE(last_message_at, m.created_at) DESC
        """,
        (user_id, user_id, user_id),
    ) as cur:
        rows = await cur.fetchall()

    result = []
    for row in rows:
        d = dict(row)
        d.pop("password_hash", None)
        d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
        d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
        result.append(d)
    return result


@router.delete("/{match_id}")
async def unmatch(
    match_id: str,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    # Verify user is part of this match
    async with db.execute(
        "SELECT id FROM matches WHERE id=? AND (user1_id=? OR user2_id=?)",
        (match_id, user_id, user_id),
    ) as cur:
        if not await cur.fetchone():
            raise HTTPException(status_code=403, detail="Sem permissão")

    await db.execute("DELETE FROM messages WHERE match_id=?", (match_id,))
    await db.execute("DELETE FROM matches WHERE id=?", (match_id,))
    await db.commit()
    return {"success": True}
