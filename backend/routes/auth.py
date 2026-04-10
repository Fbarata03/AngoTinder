import json
import uuid
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
import aiosqlite
from database import get_db
from auth_utils import hash_password, verify_password, create_token, get_current_user_id

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    age: int
    location: str
    gender: str = "other"
    looking_for: str = "all"
    bio: str = ""
    work: str = ""
    photo_url: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", v.strip()):
            raise ValueError("Email inválido")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("A senha deve ter pelo menos 6 caracteres")
        return v

    @field_validator("age")
    @classmethod
    def validate_age(cls, v):
        if v < 18 or v > 99:
            raise ValueError("Idade deve ser entre 18 e 99")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Nome muito curto")
        return v.strip()


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


def parse_user(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    d["photos"] = json.loads(d["photos"]) if d.get("photos") else []
    d["interests"] = json.loads(d["interests"]) if d.get("interests") else []
    return d


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest, db: aiosqlite.Connection = Depends(get_db)):
    # Check if email already exists
    async with db.execute("SELECT id FROM users WHERE email = ?", (req.email,)) as cur:
        if await cur.fetchone():
            raise HTTPException(status_code=400, detail="Este email já está registado")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(req.password)

    # Build photos list
    photos = [req.photo_url] if req.photo_url.startswith("http") else []

    await db.execute(
        """INSERT INTO users (id, email, password_hash, name, age, location, gender, looking_for, bio, work, photos, is_verified)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
        (user_id, req.email, password_hash, req.name, req.age, req.location,
         req.gender, req.looking_for, req.bio, req.work, json.dumps(photos)),
    )
    await db.commit()

    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
        user = await cur.fetchone()

    token = create_token(user_id)
    return AuthResponse(token=token, user=parse_user(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    email = req.email.strip().lower()
    async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cur:
        user = await cur.fetchone()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    token = create_token(user["id"])
    return AuthResponse(token=token, user=parse_user(user))


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id), db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM users WHERE id = ?", (user_id,)) as cur:
        user = await cur.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")
    return parse_user(user)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 6:
            raise ValueError("A nova senha deve ter pelo menos 6 caracteres")
        return v


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    user_id: str = Depends(get_current_user_id),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    if not row or not verify_password(req.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    new_hash = hash_password(req.new_password)
    await db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user_id))
    await db.commit()
    return {"success": True}
