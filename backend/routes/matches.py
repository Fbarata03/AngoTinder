from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
import uuid
import json
from database import get_db

router = APIRouter()


class SwipeRequest(BaseModel):
    swiper_id: str
    swiped_id: str
    direction: str  # "left" | "right" | "super"


class SwipeResponse(BaseModel):
    is_match: bool
    match_id: str | None = None


def parse_user(row) -> dict:
    d = dict(row)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    d["interests"] = json.loads(d["interests"]) if d["interests"] else []
    return d


@router.post("/swipe", response_model=SwipeResponse)
async def swipe(req: SwipeRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Record the swipe
    try:
        await db.execute(
            "INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, ?)",
            (req.swiper_id, req.swiped_id, req.direction),
        )
        await db.commit()
    except Exception:
        # Already swiped
        pass

    is_match = False
    match_id = None

    if req.direction in ("right", "super"):
        # Check if the other person already swiped right on us
        async with db.execute(
            """
            SELECT id FROM swipes
            WHERE swiper_id = ? AND swiped_id = ? AND direction IN ('right', 'super')
            """,
            (req.swiped_id, req.swiper_id),
        ) as cursor:
            mutual = await cursor.fetchone()

        if mutual:
            # Check if match already exists
            async with db.execute(
                """
                SELECT id FROM matches
                WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
                """,
                (req.swiper_id, req.swiped_id, req.swiped_id, req.swiper_id),
            ) as cursor:
                existing = await cursor.fetchone()

            if not existing:
                match_id = str(uuid.uuid4())
                await db.execute(
                    "INSERT INTO matches (id, user1_id, user2_id) VALUES (?, ?, ?)",
                    (match_id, req.swiper_id, req.swiped_id),
                )
                await db.commit()
                is_match = True
            else:
                is_match = True
                match_id = existing["id"]
        else:
            # Simulate random match for demo purposes (30% chance)
            import random
            if random.random() < 0.3:
                match_id = str(uuid.uuid4())
                # Auto-add a swipe from the other side
                try:
                    await db.execute(
                        "INSERT INTO swipes (swiper_id, swiped_id, direction) VALUES (?, ?, 'right')",
                        (req.swiped_id, req.swiper_id),
                    )
                    await db.execute(
                        "INSERT INTO matches (id, user1_id, user2_id) VALUES (?, ?, ?)",
                        (match_id, req.swiper_id, req.swiped_id),
                    )
                    await db.commit()
                    is_match = True
                except Exception:
                    pass

    return SwipeResponse(is_match=is_match, match_id=match_id)


@router.get("/{user_id}")
async def get_matches(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get all matches for a user with profile info."""
    async with db.execute(
        """
        SELECT m.id as match_id, m.created_at as matched_at,
               u.*
        FROM matches m
        JOIN users u ON (
            CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END = u.id
        )
        WHERE m.user1_id = ? OR m.user2_id = ?
        ORDER BY m.created_at DESC
        """,
        (user_id, user_id, user_id),
    ) as cursor:
        rows = await cursor.fetchall()

    result = []
    for row in rows:
        d = dict(row)
        d["photos"] = json.loads(d["photos"]) if d["photos"] else []
        d["interests"] = json.loads(d["interests"]) if d["interests"] else []
        result.append(d)
    return result


@router.delete("/{match_id}")
async def unmatch(match_id: str, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute("DELETE FROM matches WHERE id = ?", (match_id,))
    await db.execute("DELETE FROM messages WHERE match_id = ?", (match_id,))
    await db.commit()
    return {"success": True}
