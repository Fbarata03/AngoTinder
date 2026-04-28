import json
import os
import asyncio
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import asyncpg
from jose import jwt, JWTError
from database import get_db, cleanup_old_data
from notif_manager import notif_manager
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


class BroadcastRequest(BaseModel):
    title: str
    message: str


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
    # Execute all stat queries in parallel for speed
    (
        total_users,
        verified_users,
        total_matches,
        total_messages,
        total_swipes,
        right_swipes,
        users_today,
        matches_today,
        messages_today,
        swipes_today,
        active_24h,
        top_locations,
    ) = await asyncio.gather(
        db.fetchval("SELECT COUNT(*) FROM users"),
        db.fetchval("SELECT COUNT(*) FROM users WHERE is_verified = 1"),
        db.fetchval("SELECT COUNT(*) FROM matches"),
        db.fetchval("SELECT COUNT(*) FROM messages"),
        db.fetchval("SELECT COUNT(*) FROM swipes"),
        db.fetchval("SELECT COUNT(*) FROM swipes WHERE direction IN ('right','super')"),
        db.fetchval("SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours'"),
        db.fetchval("SELECT COUNT(*) FROM matches WHERE created_at >= NOW() - INTERVAL '24 hours'"),
        db.fetchval("SELECT COUNT(*) FROM messages WHERE created_at >= NOW() - INTERVAL '24 hours'"),
        db.fetchval("SELECT COUNT(*) FROM swipes WHERE created_at >= NOW() - INTERVAL '24 hours'"),
        db.fetchval(
            """SELECT COUNT(DISTINCT sender_id) FROM messages
               WHERE created_at >= NOW() - INTERVAL '24 hours'"""
        ),
        db.fetch(
            """SELECT location, COUNT(*) as cnt FROM users
               GROUP BY location ORDER BY cnt DESC LIMIT 6"""
        ),
    )

    online_users = notif_manager.online_count()

    right_rate = round((right_swipes / total_swipes * 100) if total_swipes else 0, 1)
    match_rate = round((total_matches / (right_swipes / 2) * 100) if right_swipes >= 2 else 0, 1)

    return {
        "total_users": total_users,
        "verified_users": verified_users,
        "total_matches": total_matches,
        "total_messages": total_messages,
        "total_swipes": total_swipes,
        "right_swipes": right_swipes,
        "right_swipe_rate": right_rate,
        "match_rate": match_rate,
        "users_today": users_today,
        "matches_today": matches_today,
        "messages_today": messages_today,
        "swipes_today": swipes_today,
        "active_users_24h": active_24h,
        "online_users": online_users,
        "top_locations": [{"location": r["location"], "count": r["cnt"]} for r in top_locations],
    }


@router.get("/users")
async def get_all_users(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
    search: str = "",
    page: int = 1,
    gender: str = "",
    verified: str = "",
    location: str = "",
):
    limit = 30
    offset = (page - 1) * limit

    conditions = []
    params: list = []

    if search:
        params.append(f"%{search}%")
        conditions.append(f"(name ILIKE ${len(params)} OR email ILIKE ${len(params)})")

    if gender:
        params.append(gender)
        conditions.append(f"gender = ${len(params)}")

    if verified == "yes":
        conditions.append("is_verified = 1")
    elif verified == "no":
        conditions.append("is_verified = 0")

    if location:
        params.append(f"%{location}%")
        conditions.append(f"location ILIKE ${len(params)}")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_params = params[:]
    params += [limit, offset]

    rows, total = await asyncio.gather(
        db.fetch(
            f"""SELECT u.id, u.name, u.email, u.age, u.location, u.gender,
                       u.is_verified, u.photos, u.created_at,
                       (SELECT COUNT(*) FROM matches WHERE user1_id=u.id OR user2_id=u.id) as match_count,
                       (SELECT COUNT(*) FROM messages WHERE sender_id=u.id) as message_count
                FROM users u {where}
                ORDER BY u.created_at DESC
                LIMIT ${len(params)-1} OFFSET ${len(params)}""",
            *params,
        ),
        db.fetchval(f"SELECT COUNT(*) FROM users {where}", *count_params),
    )

    users = []
    for row in rows:
        d = dict(row)
        d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = d["created_at"].isoformat()
        users.append(d)

    return {"users": users, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: str,
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    row = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    d = dict(row)
    d.pop("password_hash", None)
    d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
    d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
    if d.get("created_at") and not isinstance(d["created_at"], str):
        d["created_at"] = d["created_at"].isoformat()

    match_count, msg_count, swipe_count = await asyncio.gather(
        db.fetchval("SELECT COUNT(*) FROM matches WHERE user1_id=$1 OR user2_id=$1", user_id),
        db.fetchval("SELECT COUNT(*) FROM messages WHERE sender_id=$1", user_id),
        db.fetchval("SELECT COUNT(*) FROM swipes WHERE swiper_id=$1", user_id),
    )
    d["match_count"] = match_count
    d["message_count"] = msg_count
    d["swipe_count"] = swipe_count
    d["is_online"] = notif_manager.is_online(user_id)
    return d


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


@router.delete("/matches/{match_id}")
async def delete_match(
    match_id: str,
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    row = await db.fetchrow("SELECT id FROM matches WHERE id = $1", match_id)
    if not row:
        raise HTTPException(status_code=404, detail="Match não encontrado")
    await db.execute("DELETE FROM messages WHERE match_id = $1", match_id)
    await db.execute("DELETE FROM matches WHERE id = $1", match_id)
    return {"success": True}


@router.post("/broadcast")
async def send_broadcast(
    req: BroadcastRequest,
    _admin=Depends(get_admin_user),
):
    await notif_manager.broadcast_all({
        "type": "admin_broadcast",
        "title": req.title,
        "message": req.message,
    })
    return {"success": True}


@router.get("/matches")
async def get_all_matches(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
    page: int = 1,
):
    limit = 30
    offset = (page - 1) * limit

    rows, total = await asyncio.gather(
        db.fetch(
            """SELECT m.id, m.created_at,
                      u1.name as user1_name, u1.email as user1_email, u1.photos as user1_photos,
                      u2.name as user2_name, u2.email as user2_email, u2.photos as user2_photos,
                      (SELECT COUNT(*) FROM messages WHERE match_id = m.id) as message_count
               FROM matches m
               JOIN users u1 ON u1.id = m.user1_id
               JOIN users u2 ON u2.id = m.user2_id
               ORDER BY m.created_at DESC
               LIMIT $1 OFFSET $2""",
            limit, offset,
        ),
        db.fetchval("SELECT COUNT(*) FROM matches"),
    )

    result = []
    for row in rows:
        d = dict(row)
        if d.get("created_at") and not isinstance(d["created_at"], str):
            d["created_at"] = d["created_at"].isoformat()
        d["user1_photos"] = json.loads(d["user1_photos"]) if d.get("user1_photos") else []
        d["user2_photos"] = json.loads(d["user2_photos"]) if d.get("user2_photos") else []
        result.append(d)

    return {"matches": result, "total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)}


@router.get("/activity")
async def get_recent_activity(
    db: asyncpg.Connection = Depends(get_db),
    _admin=Depends(get_admin_user),
):
    """Últimas 20 ações: registos, matches e mensagens."""
    users_recent, matches_recent, msgs_recent = await asyncio.gather(
        db.fetch(
            """SELECT 'register' as type, u.name, u.email, u.created_at as ts
               FROM users u ORDER BY u.created_at DESC LIMIT 10"""
        ),
        db.fetch(
            """SELECT 'match' as type,
                      u1.name || ' ↔ ' || u2.name as name,
                      '' as email,
                      m.created_at as ts
               FROM matches m
               JOIN users u1 ON u1.id = m.user1_id
               JOIN users u2 ON u2.id = m.user2_id
               ORDER BY m.created_at DESC LIMIT 10"""
        ),
        db.fetch(
            """SELECT 'message' as type,
                      u.name,
                      '' as email,
                      msg.created_at as ts
               FROM messages msg
               JOIN users u ON u.id = msg.sender_id
               ORDER BY msg.created_at DESC LIMIT 10"""
        ),
    )

    all_events = []
    for r in list(users_recent) + list(matches_recent) + list(msgs_recent):
        d = dict(r)
        if d.get("ts") and not isinstance(d["ts"], str):
            d["ts"] = d["ts"].isoformat()
        all_events.append(d)

    all_events.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return all_events[:30]


@router.post("/cleanup")
async def manual_cleanup(_admin=Depends(get_admin_user)):
    """Limpeza manual — remove OTPs expirados, swipes antigos e mensagens excedentes."""
    result = await cleanup_old_data()
    return {"success": True, "result": result}
