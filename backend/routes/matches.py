import json
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import asyncpg
from database import get_db
from auth_utils import get_current_user_id
from notif_manager import notif_manager

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
    db: asyncpg.Connection = Depends(get_db),
):
    target = await db.fetchrow("SELECT id FROM users WHERE id = $1", req.swiped_id)
    if not target:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    # Record swipe; if already swiped, update direction (e.g. left→right after cooldown)
    await db.execute(
        """INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES ($1, $2, $3)
           ON CONFLICT (swiper_id, swiped_id) DO UPDATE
           SET direction = EXCLUDED.direction, created_at = NOW()""",
        user_id, req.swiped_id, req.direction,
    )

    if req.direction == "left":
        return {"is_match": False, "match_id": None}

    # Check for mutual like
    mutual = await db.fetchrow(
        "SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction IN ('right', 'super')",
        req.swiped_id, user_id,
    )

    # Check if match already exists
    existing_match = await db.fetchrow(
        "SELECT id FROM matches WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$3 AND user2_id=$4)",
        user_id, req.swiped_id, req.swiped_id, user_id,
    )

    if existing_match:
        return {"is_match": True, "match_id": existing_match["id"]}

    if mutual:
        match_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO matches (id, user1_id, user2_id) VALUES ($1, $2, $3)",
            match_id, user_id, req.swiped_id,
        )

        # Fetch both user profiles to send in notifications (safe if row is missing)
        me_row = await db.fetchrow("SELECT id, name, photos FROM users WHERE id = $1", user_id)
        them_row = await db.fetchrow("SELECT id, name, photos FROM users WHERE id = $1", req.swiped_id)

        def user_preview(row):
            if not row:
                return {"id": "", "name": "Utilizador", "photos": []}
            return {
                "id": row["id"],
                "name": row["name"],
                "photos": json.loads(row["photos"]) if row.get("photos") else [],
            }

        try:
            await notif_manager.notify(req.swiped_id, {
                "type": "new_match",
                "match_id": match_id,
                "user": user_preview(me_row),
            })
            await notif_manager.notify(user_id, {
                "type": "new_match",
                "match_id": match_id,
                "user": user_preview(them_row),
            })
        except Exception:
            pass

        return {"is_match": True, "match_id": match_id}

    return {"is_match": False, "match_id": None}


@router.get("/")
async def get_matches(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """
        SELECT m.id as match_id, m.created_at as matched_at,
               u.*,
               (SELECT text FROM messages WHERE match_id=m.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE match_id=m.id ORDER BY created_at DESC LIMIT 1) as last_message_at
        FROM matches m
        JOIN users u ON u.id = CASE WHEN m.user1_id=$1 THEN m.user2_id ELSE m.user1_id END
        WHERE m.user1_id=$2 OR m.user2_id=$3
        ORDER BY COALESCE(last_message_at, m.created_at) DESC
        """,
        user_id, user_id, user_id,
    )

    result = []
    for row in rows:
        d = dict(row)
        d.pop("password_hash", None)
        d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
        d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
        # Convert datetime to string for JSON serialization
        if d.get("matched_at") and not isinstance(d["matched_at"], str):
            d["matched_at"] = d["matched_at"].isoformat()
        if d.get("last_message_at") and not isinstance(d["last_message_at"], str):
            d["last_message_at"] = d["last_message_at"].isoformat()
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result


@router.delete("/{match_id}")
async def unmatch(
    match_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow(
        "SELECT id, user1_id, user2_id FROM matches WHERE id=$1 AND (user1_id=$2 OR user2_id=$3)",
        match_id, user_id, user_id,
    )
    if not row:
        raise HTTPException(status_code=403, detail="Sem permissão")

    other_id = row["user2_id"] if row["user1_id"] == user_id else row["user1_id"]

    await db.execute("DELETE FROM messages WHERE match_id=$1", match_id)
    await db.execute("DELETE FROM matches WHERE id=$1", match_id)

    # Notify the other user so their chat list updates in real time
    try:
        await notif_manager.notify(other_id, {"type": "unmatch", "match_id": match_id})
    except Exception:
        pass

    return {"success": True}
