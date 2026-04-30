import json
import math
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


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

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
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    incognito_mode: Optional[int] = None


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
    lat: float | None = None,
    lon: float | None = None,
    max_distance_km: float | None = None,
    prioritize_user_id: str | None = None,
    online_only: bool = False,
):
    target_gender = ""
    if gender and gender not in ("all", ""):
        gender_map = {"women": "female", "men": "male", "female": "female", "male": "male"}
        target_gender = gender_map.get(gender, "")

    # Save user's coordinates if provided
    if lat is not None and lon is not None:
        try:
            await db.execute(
                "UPDATE users SET latitude=$1, longitude=$2, last_active_at=NOW() WHERE id=$3",
                lat, lon, user_id,
            )
        except Exception:
            pass

    # Fetch IDs blocked by or blocking this user (mutual exclusion)
    blocked_rows = await db.fetch(
        "SELECT blocked_id AS uid FROM blocks WHERE blocker_id=$1 UNION SELECT blocker_id AS uid FROM blocks WHERE blocked_id=$1",
        user_id,
    )
    blocked_ids = [r["uid"] for r in blocked_rows]

    def _common_conditions(param_list: list) -> list[str]:
        conds = [
            f"u.id != ${_p(param_list, user_id)}",
            f"COALESCE(u.incognito_mode, 0) = 0",
            f"""u.id NOT IN (
                SELECT swiped_id FROM swipes
                WHERE swiper_id = ${_p(param_list, user_id)} AND direction IN ('right', 'super')
            )""",
            f"""u.id NOT IN (
                SELECT CASE WHEN user1_id = ${_p(param_list, user_id)} THEN user2_id ELSE user1_id END
                FROM matches WHERE user1_id = ${_p(param_list, user_id)} OR user2_id = ${_p(param_list, user_id)}
            )""",
        ]
        if blocked_ids:
            ph = ", ".join([f"${_p(param_list, bid)}" for bid in blocked_ids])
            conds.append(f"u.id NOT IN ({ph})")
        return conds

    def _p(lst: list, val) -> int:
        lst.append(val)
        return len(lst)

    # ── Priority 1: people who already liked you ──
    liked_params: list = []
    liked_conds = [
        f"s.swiped_id = ${_p(liked_params, user_id)}",
        f"s.direction IN ('right', 'super')",
        f"u.id != ${_p(liked_params, user_id)}",
        f"COALESCE(u.incognito_mode, 0) = 0",
        f"u.age >= ${_p(liked_params, min_age)}",
        f"u.age <= ${_p(liked_params, max_age)}",
        f"""u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = ${_p(liked_params, user_id)} AND direction IN ('right', 'super')
        )""",
        f"""u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = ${_p(liked_params, user_id)} AND direction = 'left'
              AND created_at > NOW() - INTERVAL '{LEFT_SWIPE_COOLDOWN_DAYS} days'
        )""",
        f"""u.id NOT IN (
            SELECT CASE WHEN user1_id = ${_p(liked_params, user_id)} THEN user2_id ELSE user1_id END
            FROM matches WHERE user1_id = ${_p(liked_params, user_id)} OR user2_id = ${_p(liked_params, user_id)}
        )""",
    ]
    if blocked_ids:
        ph = ", ".join([f"${_p(liked_params, bid)}" for bid in blocked_ids])
        liked_conds.append(f"u.id NOT IN ({ph})")
    if target_gender:
        liked_conds.append(f"u.gender = ${_p(liked_params, target_gender)}")
    if verified_only:
        liked_conds.append("u.is_verified = 1")
    if online_only:
        liked_conds.append("COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes'")

    liked_rows = await db.fetch(
        f"""SELECT u.*, (COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes') AS is_online FROM swipes s
            JOIN users u ON u.id = s.swiper_id
            WHERE {' AND '.join(liked_conds)}
            ORDER BY COALESCE(u.last_active_at, u.created_at) DESC
            LIMIT 25""",
        *liked_params,
    )
    liked_ids = [r["id"] for r in liked_rows]

    # ── Priority 2: random fill ──
    base_params: list = []
    base_conds = [
        f"u.id != ${_p(base_params, user_id)}",
        f"COALESCE(u.incognito_mode, 0) = 0",
        f"u.age >= ${_p(base_params, min_age)}",
        f"u.age <= ${_p(base_params, max_age)}",
        f"""u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = ${_p(base_params, user_id)} AND direction IN ('right', 'super')
        )""",
        f"""u.id NOT IN (
            SELECT swiped_id FROM swipes
            WHERE swiper_id = ${_p(base_params, user_id)} AND direction = 'left'
              AND created_at > NOW() - INTERVAL '{LEFT_SWIPE_COOLDOWN_DAYS} days'
        )""",
        f"""u.id NOT IN (
            SELECT CASE WHEN user1_id = ${_p(base_params, user_id)} THEN user2_id ELSE user1_id END
            FROM matches WHERE user1_id = ${_p(base_params, user_id)} OR user2_id = ${_p(base_params, user_id)}
        )""",
    ]
    if blocked_ids:
        ph = ", ".join([f"${_p(base_params, bid)}" for bid in blocked_ids])
        base_conds.append(f"u.id NOT IN ({ph})")
    if liked_ids:
        ph = ", ".join([f"${_p(base_params, lid)}" for lid in liked_ids])
        base_conds.append(f"u.id NOT IN ({ph})")
    if target_gender:
        base_conds.append(f"u.gender = ${_p(base_params, target_gender)}")
    if verified_only:
        base_conds.append("u.is_verified = 1")
    if online_only:
        base_conds.append("COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes'")

    # Order: recently active first, then random (Tinder-like freshness boost)
    rows = await db.fetch(
        f"""SELECT u.*, (COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes') AS is_online FROM users u
            WHERE {' AND '.join(base_conds)}
            ORDER BY
              CASE WHEN COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes' THEN 0 ELSE 1 END,
              CASE WHEN u.last_active_at > NOW() - INTERVAL '1 day' THEN 0
                   WHEN u.last_active_at > NOW() - INTERVAL '7 days' THEN 1
                   ELSE 2 END,
              COALESCE(u.last_active_at, u.created_at) DESC,
              RANDOM()
            LIMIT 50""",
        *base_params,
    )

    # Fallback: ignore cooldown
    if not rows and not liked_rows:
        if not online_only:
            fb_params: list = []
            rows = await db.fetch(
                f"""SELECT u.*, (COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes') AS is_online FROM users u
                   WHERE u.id != ${_p(fb_params, user_id)}
                   AND COALESCE(u.incognito_mode, 0) = 0
                   AND u.id NOT IN (
                       SELECT swiped_id FROM swipes
                       WHERE swiper_id = ${_p(fb_params, user_id)} AND direction IN ('right', 'super')
                   )
                   AND u.id NOT IN (
                       SELECT CASE WHEN user1_id = ${_p(fb_params, user_id)} THEN user2_id ELSE user1_id END
                       FROM matches WHERE user1_id = ${_p(fb_params, user_id)} OR user2_id = ${_p(fb_params, user_id)}
                   )
                   ORDER BY RANDOM() LIMIT 50""",
                *fb_params,
            )

    # Fallback nuclear: show everyone except self
    if not online_only and not rows and not liked_rows:
        rows = await db.fetch(
            "SELECT u.*, (COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes') AS is_online FROM users u WHERE u.id != $1 ORDER BY RANDOM() LIMIT 50",
            user_id,
        )

    # Merge + deduplicate
    combined = []
    seen: set[str] = set()
    for r in [*liked_rows, *rows]:
        rid = r["id"]
        if rid in seen:
            continue
        seen.add(rid)
        combined.append(r)

    if prioritize_user_id and prioritize_user_id != user_id and prioritize_user_id not in seen:
        try:
            p_params: list = []
            p_conds = [
                f"u.id = ${_p(p_params, prioritize_user_id)}",
                f"u.id != ${_p(p_params, user_id)}",
                f"COALESCE(u.incognito_mode, 0) = 0",
                f"u.age >= ${_p(p_params, min_age)}",
                f"u.age <= ${_p(p_params, max_age)}",
                f"""u.id NOT IN (
                    SELECT swiped_id FROM swipes
                    WHERE swiper_id = ${_p(p_params, user_id)} AND direction IN ('right', 'super')
                )""",
                f"""u.id NOT IN (
                    SELECT swiped_id FROM swipes
                    WHERE swiper_id = ${_p(p_params, user_id)} AND direction = 'left'
                      AND created_at > NOW() - INTERVAL '{LEFT_SWIPE_COOLDOWN_DAYS} days'
                )""",
                f"""u.id NOT IN (
                    SELECT CASE WHEN user1_id = ${_p(p_params, user_id)} THEN user2_id ELSE user1_id END
                    FROM matches WHERE user1_id = ${_p(p_params, user_id)} OR user2_id = ${_p(p_params, user_id)}
                )""",
            ]
            if blocked_ids:
                ph = ", ".join([f"${_p(p_params, bid)}" for bid in blocked_ids])
                p_conds.append(f"u.id NOT IN ({ph})")
            if target_gender:
                p_conds.append(f"u.gender = ${_p(p_params, target_gender)}")
            if verified_only:
                p_conds.append("u.is_verified = 1")
            p_conds.append("COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes'")

            prow = await db.fetchrow(
                f"""SELECT u.*, (COALESCE(u.last_active_at, u.created_at) > NOW() - INTERVAL '2 minutes') AS is_online FROM users u
                    WHERE {' AND '.join(p_conds)}
                    LIMIT 1""",
                *p_params,
            )
            if prow:
                parsed = parse_user(prow)
                if lat is not None and lon is not None and max_distance_km:
                    ulat = parsed.get("latitude")
                    ulon = parsed.get("longitude")
                    if ulat is not None and ulon is not None:
                        if haversine_km(lat, lon, ulat, ulon) > max_distance_km:
                            prow = None
                if prow:
                    combined.insert(0, prow)
                    seen.add(prioritize_user_id)
        except Exception:
            pass

    result = [parse_user(r) for r in combined[:80]]

    # Distance filter (in-process Haversine) — only if caller provided GPS
    if lat is not None and lon is not None and max_distance_km:
        def within(u):
            ulat = u.get("latitude")
            ulon = u.get("longitude")
            if ulat is None or ulon is None:
                return True  # no GPS data → don't exclude
            return haversine_km(lat, lon, ulat, ulon) <= max_distance_km
        result = [u for u in result if within(u)]

    return result[:50]


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
           WHERE s.swiped_id = $1
             AND s.direction IN ('right', 'super')
             AND u.id NOT IN (
                 SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END
                 FROM matches WHERE user1_id = $1 OR user2_id = $1
             )
             AND u.id NOT IN (
                 SELECT swiped_id FROM swipes
                 WHERE swiper_id = $1 AND direction = 'left'
             )
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
             AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = $1)
             AND u.id NOT IN (
                 SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END
                 FROM matches WHERE user1_id = $1 OR user2_id = $1
             )
           ORDER BY u.is_verified DESC, RANDOM()
           LIMIT 6""",
        user_id,
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
