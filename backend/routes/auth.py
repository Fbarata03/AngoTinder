from fastapi import APIRouter, Depends
from pydantic import BaseModel
import aiosqlite
import json
from database import get_db

router = APIRouter()


class LoginRequest(BaseModel):
    provider: str  # "facebook" | "google" | "demo"
    user_id: str = "user_me"  # default demo user


class LoginResponse(BaseModel):
    user_id: str
    name: str
    photos: list[str]
    location: str


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM users WHERE id = ?", (req.user_id,)
    ) as cursor:
        user = await cursor.fetchone()

    if not user:
        async with db.execute(
            "SELECT * FROM users WHERE id = 'user_me'"
        ) as cursor:
            user = await cursor.fetchone()

    photos = json.loads(user["photos"]) if user["photos"] else []
    return LoginResponse(
        user_id=user["id"],
        name=user["name"],
        photos=photos,
        location=user["location"],
    )


@router.get("/me/{user_id}")
async def get_me(user_id: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT * FROM users WHERE id = ?", (user_id,)
    ) as cursor:
        user = await cursor.fetchone()
    if not user:
        return {"error": "User not found"}
    d = dict(user)
    d["photos"] = json.loads(d["photos"]) if d["photos"] else []
    d["interests"] = json.loads(d["interests"]) if d["interests"] else []
    return d
