from fastapi import APIRouter, Depends, HTTPException, Query
import asyncpg
import uuid
import json
from database import get_db
from auth_utils import get_current_user_id
from notif_manager import notif_manager

router = APIRouter()


@router.post("/follow/{target_id}")
async def follow_user(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Não podes seguir-te a ti mesmo")

    target = await db.fetchrow("SELECT id FROM users WHERE id=$1", target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    await db.execute(
        "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        user_id, target_id,
    )

    # Check for mutual follow → auto-create match
    mutual = await db.fetchrow(
        "SELECT id FROM follows WHERE follower_id=$1 AND following_id=$2",
        target_id, user_id,
    )

    match_id = None
    if mutual:
        existing = await db.fetchrow(
            "SELECT id FROM matches WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$3 AND user2_id=$4)",
            user_id, target_id, target_id, user_id,
        )
        if not existing:
            match_id = str(uuid.uuid4())
            await db.execute(
                "INSERT INTO matches (id, user1_id, user2_id) VALUES ($1, $2, $3)",
                match_id, user_id, target_id,
            )
            me_row = await db.fetchrow("SELECT id, name, photos FROM users WHERE id=$1", user_id)
            them_row = await db.fetchrow("SELECT id, name, photos FROM users WHERE id=$1", target_id)

            def _preview(row):
                if not row:
                    return {"id": "", "name": "Utilizador", "photos": []}
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "photos": json.loads(row["photos"]) if row.get("photos") else [],
                }

            try:
                await notif_manager.notify(target_id, {
                    "type": "new_match", "match_id": match_id, "user": _preview(me_row),
                })
                await notif_manager.notify(user_id, {
                    "type": "new_match", "match_id": match_id, "user": _preview(them_row),
                })
            except Exception:
                pass
        else:
            match_id = existing["id"]

    # Notify target of new follower
    me = await db.fetchrow("SELECT name FROM users WHERE id=$1", user_id)
    try:
        await notif_manager.notify(target_id, {
            "type": "new_follower",
            "user_id": user_id,
            "name": me["name"] if me else "Utilizador",
        })
    except Exception:
        pass

    return {"success": True, "is_match": mutual is not None, "match_id": match_id}


@router.delete("/follow/{target_id}")
async def unfollow_user(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "DELETE FROM follows WHERE follower_id=$1 AND following_id=$2",
        user_id, target_id,
    )
    return {"success": True}


@router.get("/stats/{target_id}")
async def social_stats(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    followers = await db.fetchval("SELECT COUNT(*) FROM follows WHERE following_id=$1", target_id)
    following = await db.fetchval("SELECT COUNT(*) FROM follows WHERE follower_id=$1", target_id)
    is_following = await db.fetchval(
        "SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2)",
        user_id, target_id,
    )
    return {
        "followers": int(followers),
        "following": int(following),
        "is_following": bool(is_following),
    }


@router.get("/following")
async def get_following(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.id, u.name, u.photos, u.location, u.age, u.is_verified
           FROM follows f JOIN users u ON u.id = f.following_id
           WHERE f.follower_id=$1 ORDER BY f.created_at DESC""",
        user_id,
    )
    return [
        {
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "photos": json.loads(r["photos"]) if r.get("photos") else [],
        }
        for r in rows
    ]


@router.get("/followers")
async def get_followers(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.id, u.name, u.photos, u.location, u.age, u.is_verified
           FROM follows f JOIN users u ON u.id = f.follower_id
           WHERE f.following_id=$1 ORDER BY f.created_at DESC""",
        user_id,
    )
    return [
        {
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "photos": json.loads(r["photos"]) if r.get("photos") else [],
        }
        for r in rows
    ]


@router.get("/search")
async def search_users(
    q: str = Query(""),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    q = q.strip()
    blocked_sub = (
        "NOT EXISTS (SELECT 1 FROM blocks b "
        "WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))"
    )

    if not q:
        rows = await db.fetch(
            f"""SELECT u.id, u.name, u.photos, u.location, u.age, u.is_verified, u.bio, u.work
               FROM users u
               WHERE u.id != $1 AND u.incognito_mode = 0 AND {blocked_sub}
               ORDER BY u.last_active_at DESC NULLS LAST
               LIMIT 60""",
            user_id,
        )
    else:
        q_pat = f"%{q.lower()}%"
        rows = await db.fetch(
            f"""SELECT u.id, u.name, u.photos, u.location, u.age, u.is_verified, u.bio, u.work
               FROM users u
               WHERE u.id != $1 AND u.incognito_mode = 0 AND {blocked_sub}
               AND (LOWER(u.name) LIKE $2 OR LOWER(u.location) LIKE $2
                    OR LOWER(COALESCE(u.bio, '')) LIKE $2)
               ORDER BY u.last_active_at DESC NULLS LAST
               LIMIT 40""",
            user_id, q_pat,
        )

    return [
        {
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "bio": r.get("bio") or "", "work": r.get("work") or "",
            "photos": json.loads(r["photos"]) if r.get("photos") else [],
        }
        for r in rows
    ]
