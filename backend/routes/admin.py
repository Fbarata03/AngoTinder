import json
import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import asyncpg
from jose import jwt, JWTError
from database import get_db
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

router = APIRouter()

ADMIN_USERNAME = os.getenv("ADMIN_USER", "Fbarata03")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "marias66s3")
SECRET_KEY = os.getenv("SECRET_KEY", "angotinder-super-secret-key-change-in-production-2024")
ALGORITHM = "HS256"

bearer_scheme = HTTPBearer(auto_error=False)


def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Autenticação necessária")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("admin"):
            raise HTTPException(status_code=403, detail="Acesso negado")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def admin_login(req: AdminLoginRequest):
    if req.username != ADMIN_USERNAME or req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    token = jwt.encode(
        {"admin": True, "sub": req.username, "exp": datetime.utcnow() + timedelta(days=1)},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return {"token": token}


@router.get("/stats")
async def get_stats(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    total_users = await db.fetchval("SELECT COUNT(*) FROM users")
    verified_users = await db.fetchval("SELECT COUNT(*) FROM users WHERE is_verified = 1")
    total_matches = await db.fetchval("SELECT COUNT(*) FROM matches")
    total_messages = await db.fetchval("SELECT COUNT(*) FROM messages")
    users_today = await db.fetchval(
        "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'"
    )
    matches_today = await db.fetchval(
        "SELECT COUNT(*) FROM matches WHERE created_at >= NOW() - INTERVAL '24 hours'"
    )

    return {
        "total_users": total_users,
        "verified_users": verified_users,
        "total_matches": total_matches,
        "total_messages": total_messages,
        "users_today": users_today,
        "matches_today": matches_today,
    }


@router.get("/users")
async def get_all_users(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
    search: str = "",
    page: int = 1,
):
    limit = 50
    offset = (page - 1) * limit

    if search:
        rows = await db.fetch(
            """SELECT id, name, email, age, location, gender, is_verified, photos, created_at
               FROM users
               WHERE name ILIKE $1 OR email ILIKE $1
               ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
            f"%{search}%", limit, offset,
        )
        total = await db.fetchval(
            "SELECT COUNT(*) FROM users WHERE name ILIKE $1 OR email ILIKE $1",
            f"%{search}%",
        )
    else:
        rows = await db.fetch(
            """SELECT id, name, email, age, location, gender, is_verified, photos, created_at
               FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2""",
            limit, offset,
        )
        total = await db.fetchval("SELECT COUNT(*) FROM users")

    users = []
    for row in rows:
        d = dict(row)
        d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = d["created_at"].isoformat()
        users.append(d)

    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.post("/users/{user_id}/verify")
async def verify_user(
    user_id: str,
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    row = await db.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    await db.execute("UPDATE users SET is_verified = 1 WHERE id = $1", user_id)
    return {"success": True}


@router.post("/users/{user_id}/unverify")
async def unverify_user(
    user_id: str,
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    row = await db.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    await db.execute("UPDATE users SET is_verified = 0 WHERE id = $1", user_id)
    return {"success": True}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    row = await db.fetchrow("SELECT id FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    match_ids = await db.fetch(
        "SELECT id FROM matches WHERE user1_id = $1 OR user2_id = $1", user_id
    )
    for m in match_ids:
        await db.execute("DELETE FROM messages WHERE match_id = $1", m["id"])
    await db.execute("DELETE FROM matches WHERE user1_id = $1 OR user2_id = $1", user_id)
    await db.execute("DELETE FROM swipes WHERE swiper_id = $1 OR swiped_id = $1", user_id)
    await db.execute("DELETE FROM users WHERE id = $1", user_id)
    return {"success": True}


@router.get("/matches")
async def get_all_matches(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    rows = await db.fetch(
        """SELECT m.id, m.created_at,
                  u1.name as user1_name, u1.email as user1_email,
                  u2.name as user2_name, u2.email as user2_email,
                  (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as message_count
           FROM matches m
           JOIN users u1 ON u1.id = m.user1_id
           JOIN users u2 ON u2.id = m.user2_id
           ORDER BY m.created_at DESC LIMIT 100"""
    )
    result = []
    for row in rows:
        d = dict(row)
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = d["created_at"].isoformat()
        result.append(d)
    return result
