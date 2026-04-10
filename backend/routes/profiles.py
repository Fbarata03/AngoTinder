import json
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import aiosqlite
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
    db: aiosqlite.Connection = Depends(get_db),
):
    """Profiles for discover screen — excludes self and already-swiped."""
    async with db.execute("SELECT looking_for, gender FROM users WHERE id = ?", (user_id,)) as cur:
        me = await cur.fetchone()

    gender_filter = ""
    params = [user_id, user_id]

    if me and me["looking_for"] not in ("all", None, ""):
        gender_map = {"women": "female", "men": "male"}
        target_gender = gender_map.get(me["looking_for"])
        if target_gender:
            gender_filter = "AND u.gender = ?"
            params.append(target_gender)

    async with db.execute(
        f"""
        SELECT u.* FROM users u
        WHERE u.id != ?
          AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = ?)
          {gender_filter}
        ORDER BY RANDOM()
        LIMIT 50
        """,
        params,
    ) as cur:
        rows = await cur.fetchall()

    return [parse_user(r) for r in rows]


@router.get("/me")
async def get_my_profile(
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return parse_user(row)


@router.put("/me")
async def update_profile(
    update: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    fields, values = [], []

    for field, value in update.model_dump(exclude_none=True).items():
        if field == "interests":
            fields.append("interests = ?")
            values.append(json.dumps(value))
        else:
            fields.append(f"{field} = ?")
            values.append(value)

    if not fields:
        raise HTTPException(status_code=400, detail="Nada para atualizar")

    values.append(user_id)
    await db.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = ?", values)
    await db.commit()

    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    return parse_user(row)


@router.post("/me/photos")
async def upload_photo(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    """Upload photo to Cloudinary or serve locally."""
    contents = await file.read()

    if CLOUDINARY_ENABLED:
        result = cloudinary.uploader.upload(
            contents,
            folder="angotinder",
            transformation=[{"width": 800, "height": 1000, "crop": "fill", "gravity": "face"}],
        )
        photo_url = result["secure_url"]
    else:
        upload_dir = os.path.join(os.path.dirname(__file__), "..", "static", "photos")
        os.makedirs(upload_dir, exist_ok=True)
        ext = file.filename.split(".")[-1] if file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{ext}"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(contents)
        photo_url = f"/static/photos/{filename}"

    async with db.execute("SELECT photos FROM users WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    photos = json.loads(row["photos"]) if row and row["photos"] else []
    photos.append(photo_url)
    await db.execute("UPDATE users SET photos = ? WHERE id = ?", (json.dumps(photos), user_id))
    await db.commit()
    return {"photo_url": photo_url, "photos": photos}


@router.delete("/me/photos")
async def delete_photo(
    photo_url: str,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT photos FROM users WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    photos = json.loads(row["photos"]) if row and row["photos"] else []
    photos = [p for p in photos if p != photo_url]
    await db.execute("UPDATE users SET photos = ? WHERE id = ?", (json.dumps(photos), user_id))
    await db.commit()
    return {"photos": photos}


# IMPORTANT: /likes/received and /top-picks/today MUST come before /{profile_id}
# otherwise FastAPI will match them as profile_id="likes" / profile_id="top-picks"

@router.get("/likes/received")
async def get_likes(
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        """SELECT u.* FROM users u
           INNER JOIN swipes s ON s.swiper_id = u.id
           WHERE s.swiped_id = ? AND s.direction IN ('right', 'super')
           ORDER BY s.created_at DESC""",
        (user_id,),
    ) as cur:
        rows = await cur.fetchall()
    return [parse_user(r) for r in rows]


@router.get("/top-picks/today")
async def get_top_picks(
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute(
        """SELECT u.* FROM users u
           WHERE u.id != ?
             AND u.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = ?)
           ORDER BY u.is_verified DESC, RANDOM()
           LIMIT 6""",
        (user_id, user_id),
    ) as cur:
        rows = await cur.fetchall()

    reasons = ["Compartilha seus interesses", "Mora perto de você", "Perfil muito ativo",
               "Match em potencial", "Curtiu suas fotos", "Perfil verificado"]
    return [{**parse_user(r), "reason": reasons[i % len(reasons)]} for i, r in enumerate(rows)]


# This MUST be last — catches any /{profile_id}
@router.get("/{profile_id}")
async def get_profile(
    profile_id: str,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT * FROM users WHERE id = ?", (profile_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return parse_user(row)
