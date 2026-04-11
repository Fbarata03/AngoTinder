import json
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import asyncpg
import cloudinary
import cloudinary.uploader
from database import get_db
from auth_utils import get_current_user_id

router = APIRouter()

# Configure Cloudinary (optional — only if env vars are set)
CLOUDINARY_ENABLED = bool(os.getenv("CLOUDINARY_CLOUD_NAME"))
if CLOUDINARY_ENABLED:
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    )

LOCAL_PHOTOS_MAX_MB = int(os.getenv("LOCAL_PHOTOS_MAX_MB", "900") or "900")
LEFT_SWIPE_COOLDOWN_DAYS = int(os.getenv("LEFT_SWIPE_COOLDOWN_DAYS", "7") or "7")


def get_local_photos_dir() -> str:
    return os.path.join(os.path.dirname(__file__), "..", "static", "photos")


def is_local_photo_url(photo_url: str) -> bool:
    return photo_url.startswith("/static/photos/")


def local_photos_dir_size_bytes(upload_dir: str) -> int:
    total = 0
    if not os.path.isdir(upload_dir):
        return 0
    for entry in os.scandir(upload_dir):
        try:
            if entry.is_file():
                total += entry.stat().st_size
        except FileNotFoundError:
            continue
    return total


def try_delete_local_photo(photo_url: str) -> bool:
    if not is_local_photo_url(photo_url):
        return False
    rel = photo_url.split("?", 1)[0].replace("/static/photos/", "", 1)
    filename = os.path.basename(rel)
    if not filename:
        return False
    upload_dir = os.path.realpath(get_local_photos_dir())
    path = os.path.realpath(os.path.join(upload_dir, filename))
    if not path.startswith(upload_dir + os.sep):
        return False
    if not os.path.exists(path):
        return True
    try:
        os.remove(path)
        return True
    except OSError:
        return False


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    work: Optional[str] = None
    bio: Optional[str] = None
    education: Optional[str] = None
    hometown: Optional[str] = None
    interests: Optional[list[str]] = None
    gender: Optional[str] = None
    looking_for: Optional[str] = None


def parse_user(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
    d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
    return d


@router.get("/discover")
async def discover(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
    min_age: int = 18,
    max_age: int = 99,
    gender: str = "",
    verified_only: bool = False,
):
    # Only apply gender filter when explicitly requested (not "all")
    # If gender="all" is passed from frontend, show everyone regardless of looking_for
    target_gender = ""
    if gender and gender not in ("all", ""):
        gender_map = {"women": "female", "men": "male", "female": "female", "male": "male"}
        target_gender = gender_map.get(gender, "")
    # Do NOT auto-apply looking_for filter — let users see everyone by default

    # Priority 1: show people who already liked you (higher chance of match)
    liked_conditions = [
        "u.id != $1",
        "u.age >= $2",
        "u.age <= $3",
        """u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = $4
        )""",
        """u.id NOT IN (
            SELECT CASE WHEN user1_id = $5 THEN user2_id ELSE user1_id END
            FROM matches WHERE user1_id = $6 OR user2_id = $7
        )""",
    ]
    liked_params: list = [user_id, min_age, max_age, user_id, user_id, user_id, user_id]

    if target_gender:
        liked_params.append(target_gender)
        liked_conditions.append(f"u.gender = ${len(liked_params)}")

    if verified_only:
        liked_conditions.append("u.is_verified = 1")

    liked_where = " AND ".join(liked_conditions)
    liked_rows = await db.fetch(
        f"""
        SELECT u.*
        FROM swipes s
        JOIN users u ON u.id = s.swiper_id
        WHERE s.swiped_id = $1
          AND s.direction IN ('right', 'super')
          AND {liked_where}
        ORDER BY s.created_at DESC
        LIMIT 25
        """,
        *liked_params,
    )

    liked_ids = [r["id"] for r in liked_rows] if liked_rows else []

    # Base conditions (random fill):
    # - Not yourself
    # - Not already right/super swiped (pending like — no point showing again)
    # - Not already matched
    # Left swipes can reappear AFTER a cooldown to avoid showing the same profile all the time
    base_conditions = [
        "u.id != $1",
        """u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = $2 AND direction IN ('right', 'super')
        )""",
        f"""u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = $3 AND direction = 'left'
              AND created_at > NOW() - INTERVAL '{LEFT_SWIPE_COOLDOWN_DAYS} days'
        )""",
        """u.id NOT IN (
            SELECT CASE WHEN user1_id = $3 THEN user2_id ELSE user1_id END
            FROM matches WHERE user1_id = $4 OR user2_id = $5
        )""",
        "u.age >= $6",
        "u.age <= $7",
    ]
    params: list = [user_id, user_id, user_id, user_id, user_id, min_age, max_age]

    if target_gender:
        params.append(target_gender)
        base_conditions.append(f"u.gender = ${len(params)}")

    if verified_only:
        base_conditions.append("u.is_verified = 1")

    if liked_ids:
        placeholders = ", ".join([f"${len(params) + i + 1}" for i in range(len(liked_ids))])
        base_conditions.append(f"u.id NOT IN ({placeholders})")
        params.extend(liked_ids)

    where = " AND ".join(base_conditions)
    rows = await db.fetch(
        f"SELECT u.* FROM users u WHERE {where} ORDER BY RANDOM() LIMIT 50",
        *params,
    )

    # Fallback 1: ignore left-swipe cooldown but still respect age/gender filters
    if not rows and not liked_rows:
        rows = await db.fetch(
            f"""SELECT u.* FROM users u
               WHERE u.id != $1
               AND u.id NOT IN (
                   SELECT swiped_id FROM swipes
                   WHERE swiper_id = $2 AND direction IN ('right', 'super')
               )
               AND u.id NOT IN (
                   SELECT swiped_id FROM swipes
                   WHERE swiper_id = $3 AND direction = 'left'
                     AND created_at > NOW() - INTERVAL '{LEFT_SWIPE_COOLDOWN_DAYS} days'
               )
               AND u.id NOT IN (
                   SELECT CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END
                   FROM matches WHERE user1_id = $3 OR user2_id = $4
               )
               ORDER BY RANDOM() LIMIT 50""",
            user_id, user_id, user_id, user_id,
        )

    # Fallback 2 (último recurso): ignora cooldown de left — mostra todos que não foram right/super e não são match
    # Evita o ecrã "Sem mais perfis" quando a base tem poucos utilizadores
    if not rows and not liked_rows:
        rows = await db.fetch(
            """SELECT u.* FROM users u
               WHERE u.id != $1
               AND u.id NOT IN (
                   SELECT swiped_id FROM swipes
                   WHERE swiper_id = $2 AND direction IN ('right', 'super')
               )
               AND u.id NOT IN (
                   SELECT CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END
                   FROM matches WHERE user1_id = $3 OR user2_id = $4
               )
               ORDER BY RANDOM() LIMIT 50""",
            user_id, user_id, user_id, user_id,
        )

    combined = []
    seen = set()
    for r in liked_rows:
        rid = r["id"]
        if rid in seen:
            continue
        seen.add(rid)
        combined.append(r)
    for r in rows:
        rid = r["id"]
        if rid in seen:
            continue
        seen.add(rid)
        combined.append(r)
    return [parse_user(r) for r in combined[:50]]


@router.get("/me")
async def get_my_profile(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return parse_user(row)


@router.put("/me")
async def update_profile(
    update: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    fields, values = [], []

    for field, value in update.model_dump(exclude_none=True).items():
        idx = len(values) + 1
        if field == "interests":
            fields.append(f"interests = ${idx}")
            values.append(json.dumps(value))
        else:
            fields.append(f"{field} = ${idx}")
            values.append(value)

    if not fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")

    values.append(user_id)
    await db.execute(
        f"UPDATE users SET {', '.join(fields)} WHERE id = ${len(values)}",
        *values,
    )

    row = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    return parse_user(row)


@router.post("/me/photos")
async def upload_photo(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    # Limit file size to 10MB
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Foto demasiado grande. Máximo 10MB.")

    # Limit to 6 photos per user
    row_check = await db.fetchrow("SELECT photos FROM users WHERE id = $1", user_id)
    existing = json.loads(row_check["photos"]) if row_check and row_check["photos"] else []
    if len(existing) >= 6:
        raise HTTPException(status_code=400, detail="Máximo de 6 fotos por perfil.")

    if CLOUDINARY_ENABLED:
        result = cloudinary.uploader.upload(
            contents,
            folder="angotinder",
            transformation=[{"width": 800, "height": 1000, "crop": "fill", "gravity": "face"}],
        )
        photo_url = result["secure_url"]
    else:
        upload_dir = get_local_photos_dir()
        os.makedirs(upload_dir, exist_ok=True)
        max_bytes = max(0, LOCAL_PHOTOS_MAX_MB) * 1024 * 1024
        if max_bytes and (local_photos_dir_size_bytes(upload_dir) + len(contents)) > max_bytes:
            raise HTTPException(
                status_code=507,
                detail="Armazenamento de fotos cheio no servidor. Ativa Cloudinary ou aumenta LOCAL_PHOTOS_MAX_MB.",
            )
        ext = file.filename.split(".")[-1] if file.filename else "jpg"
        if not ext or ext.lower() not in {"jpg", "jpeg", "png", "webp"}:
            ext = "jpg"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(contents)
        photo_url = f"/static/photos/{filename}"

    row = await db.fetchrow("SELECT photos FROM users WHERE id = $1", user_id)
    photos = json.loads(row["photos"]) if row and row["photos"] else []
    photos.append(photo_url)
    await db.execute("UPDATE users SET photos = $1 WHERE id = $2", json.dumps(photos), user_id)
    return {"photo_url": photo_url, "photos": photos}


@router.delete("/me/photos")
async def delete_photo(
    photo_url: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT photos FROM users WHERE id = $1", user_id)
    photos = json.loads(row["photos"]) if row and row["photos"] else []
    photos = [p for p in photos if p != photo_url]
    await db.execute("UPDATE users SET photos = $1 WHERE id = $2", json.dumps(photos), user_id)
    try_delete_local_photo(photo_url)
    return {"photos": photos}


# IMPORTANT: /likes/received and /top-picks/today MUST come before /{profile_id}
@router.get("/likes/received")
async def get_likes(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.* FROM users u
           INNER JOIN swipes s ON s.swiper_id = u.id
           WHERE s.swiped_id = $1 AND s.direction IN ('right', 'super')
           ORDER BY s.created_at DESC""",
        user_id,
    )
    return [parse_user(r) for r in rows]


@router.get("/top-picks/today")
async def get_top_picks(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.* FROM users u
           WHERE u.id != $1
             AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $2)
           ORDER BY u.is_verified DESC, RANDOM()
           LIMIT 6""",
        user_id, user_id,
    )

    reasons = ["Compartilha seus interesses", "Mora perto de você", "Perfil muito ativo",
               "Match em potencial", "Curtiu suas fotos", "Perfil verificado"]
    return [{**parse_user(r), "reason": reasons[i % len(reasons)]} for i, r in enumerate(rows)]


@router.delete("/me/swipes")
async def reset_swipes(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    """Remove todos os swipes do utilizador exceto os que resultaram em match."""
    await db.execute(
        """DELETE FROM swipes
           WHERE swiper_id = $1
             AND swiped_id NOT IN (
                 SELECT CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END
                 FROM matches WHERE user1_id = $3 OR user2_id = $4
             )""",
        user_id, user_id, user_id, user_id,
    )
    return {"success": True}


# This MUST be last — catches any /{profile_id}
@router.get("/{profile_id}")
async def get_profile(
    profile_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT * FROM users WHERE id = $1", profile_id)
    if not row:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return parse_user(row)
