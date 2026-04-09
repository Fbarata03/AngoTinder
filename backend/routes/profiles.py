from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import aiosqlite
import json
from database import get_db

router = APIRouter()


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    work: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    hometown: Optional[str] = None
    interests: Optional[list[str]] = None


def parse_user(row) -> dict:
    d = dict(row)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    d["interests"] = json.loads(d["interests"]) if d["interests"] else []
    return d


@router.get("/discover")
async def discover(
    user_id: str = "user_me",
    db: aiosqlite.Connection = Depends(get_db),
):
    """Get profiles for discover screen (excluding self and already-swiped)."""
    async with db.execute(
        """
        SELECT * FROM users
        WHERE id != ?
          AND id NOT IN (
            SELECT swiped_id FROM swipes WHERE swiper_id = ?
          )
        ORDER BY RANDOM()
        LIMIT 20
        """,
        (user_id, user_id),
    ) as cursor:
        rows = await cursor.fetchall()

    return [parse_user(r) for r in rows]


@router.get("/{profile_id}")
async def get_profile(profile_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM users WHERE id = ?", (profile_id,)
    ) as cursor:
        row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return parse_user(row)


@router.put("/me/{user_id}")
async def update_profile(
    user_id: str,
    update: ProfileUpdate,
    db: aiosqlite.Connection = Depends(get_db),
):
    fields = []
    values = []

    if update.name is not None:
        fields.append("name = ?")
        values.append(update.name)
    if update.age is not None:
        fields.append("age = ?")
        values.append(update.age)
    if update.location is not None:
        fields.append("location = ?")
        values.append(update.location)
    if update.work is not None:
        fields.append("work = ?")
        values.append(update.work)
    if update.bio is not None:
        fields.append("bio = ?")
        values.append(update.bio)
    if update.education is not None:
        fields.append("education = ?")
        values.append(update.education)
    if update.hometown is not None:
        fields.append("hometown = ?")
        values.append(update.hometown)
    if update.interests is not None:
        fields.append("interests = ?")
        values.append(json.dumps(update.interests))

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(user_id)
    await db.execute(
        f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()

    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cursor:
        row = await cursor.fetchone()

    return parse_user(row)


@router.get("/likes/{user_id}")
async def get_likes(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get profiles that liked the current user."""
    async with db.execute(
        """
        SELECT u.* FROM users u
        INNER JOIN swipes s ON s.swiper_id = u.id
        WHERE s.swiped_id = ? AND s.direction IN ('right', 'super')
        ORDER BY s.created_at DESC
        """,
        (user_id,),
    ) as cursor:
        rows = await cursor.fetchall()
    return [parse_user(r) for r in rows]


@router.get("/top-picks/{user_id}")
async def get_top_picks(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    """Get top picks for the user."""
    async with db.execute(
        """
        SELECT u.*,
               CASE WHEN u.is_verified = 1 THEN 'Perfil verificado' ELSE 'Match em potencial' END as reason
        FROM users u
        WHERE u.id != ?
          AND u.id NOT IN (
            SELECT swiped_id FROM swipes WHERE swiper_id = ?
          )
        ORDER BY u.is_verified DESC, RANDOM()
        LIMIT 6
        """,
        (user_id, user_id),
    ) as cursor:
        rows = await cursor.fetchall()

    result = []
    reasons = [
        "Compartilha seus interesses",
        "Mora perto de você",
        "Perfil muito ativo",
        "Match em potencial",
        "Curtiu suas fotos",
        "Perfil verificado",
    ]
    for i, row in enumerate(rows):
        d = parse_user(row)
        d["reason"] = reasons[i % len(reasons)]
        result.append(d)
    return result
