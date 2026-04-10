import json
import uuid
import re
import random
import string
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
import asyncpg
import httpx
from database import get_db
from auth_utils import hash_password, verify_password, create_token, get_current_user_id

router = APIRouter()

ANGOLA_PROVINCES = [
    "Luanda", "Benguela", "Huambo", "Bié", "Malanje", "Huíla", "Cunene",
    "Cuando Cubango", "Moxico", "Lunda Norte", "Lunda Sul", "Uíge",
    "Cuanza Norte", "Cuanza Sul", "Bengo", "Zaire", "Cabinda", "Namibe"
]


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
async def register(req: RegisterRequest, db: asyncpg.Connection = Depends(get_db)):
    existing = await db.fetchrow("SELECT id FROM users WHERE email = $1", req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Este email já está registado")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(req.password)
    photos = json.dumps([req.photo_url] if req.photo_url.startswith("http") else [])

    await db.execute(
        """INSERT INTO users (id, email, password_hash, name, age, location, gender, looking_for, bio, work, photos, is_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)""",
        user_id, req.email, password_hash, req.name, req.age, req.location,
        req.gender, req.looking_for, req.bio, req.work, photos,
    )

    user = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
    token = create_token(user_id)
    return AuthResponse(token=token, user=parse_user(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: asyncpg.Connection = Depends(get_db)):
    email = req.email.strip().lower()
    user = await db.fetchrow("SELECT * FROM users WHERE email = $1", email)

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")

    token = create_token(user["id"])
    return AuthResponse(token=token, user=parse_user(user))


@router.get("/me")
async def get_me(user_id: str = Depends(get_current_user_id), db: asyncpg.Connection = Depends(get_db)):
    user = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
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
    db: asyncpg.Connection = Depends(get_db),
):
    row = await db.fetchrow("SELECT password_hash FROM users WHERE id = $1", user_id)
    if not row or not verify_password(req.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    new_hash = hash_password(req.new_password)
    await db.execute("UPDATE users SET password_hash = $1 WHERE id = $2", new_hash, user_id)
    return {"success": True}


# ---------- Google OAuth ----------
class GoogleAuthRequest(BaseModel):
    access_token: str


@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest, db: asyncpg.Connection = Depends(get_db)):
    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.access_token}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Token Google inválido")

    info = resp.json()
    email = info.get("email", "").lower()
    name = info.get("name", "Utilizador")
    if not email:
        raise HTTPException(status_code=400, detail="Não foi possível obter o email do Google")

    # Check if user exists
    user = await db.fetchrow("SELECT * FROM users WHERE email = $1", email)
    if not user:
        # Auto-register with Google info
        user_id = str(uuid.uuid4())
        picture = info.get("picture", "")
        photos = json.dumps([picture] if picture else [])
        await db.execute(
            """INSERT INTO users (id, email, password_hash, name, age, location, gender, looking_for, bio, work, photos, is_verified)
               VALUES ($1, $2, $3, $4, 18, 'Luanda', 'other', 'all', '', '', $5, 1)""",
            user_id, email, hash_password(uuid.uuid4().hex), name, photos,
        )
        user = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)

    token = create_token(user["id"])
    return AuthResponse(token=token, user=parse_user(user))


# ---------- Phone OTP ----------
# In-memory OTP store (resets on server restart — acceptable for demo)
_otp_store: dict[str, str] = {}


class PhoneSendRequest(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        digits = re.sub(r"\D", "", v)
        if len(digits) < 9:
            raise ValueError("Número inválido")
        return digits


class PhoneVerifyRequest(BaseModel):
    phone: str
    code: str


@router.post("/phone/send")
async def phone_send(req: PhoneSendRequest):
    code = "".join(random.choices(string.digits, k=6))
    _otp_store[req.phone] = code
    # In production: send via Twilio/Africa's Talking
    # For demo: code is returned in response (remove in production!)
    return {"success": True, "demo_code": code}


@router.post("/phone/verify", response_model=AuthResponse)
async def phone_verify(req: PhoneVerifyRequest, db: asyncpg.Connection = Depends(get_db)):
    stored = _otp_store.get(req.phone)
    if not stored or stored != req.code:
        raise HTTPException(status_code=400, detail="Código inválido ou expirado")

    del _otp_store[req.phone]

    # Use phone as fake email identifier
    fake_email = f"+244{req.phone}@angotinder.phone"
    user = await db.fetchrow("SELECT * FROM users WHERE email = $1", fake_email)
    if not user:
        user_id = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO users (id, email, password_hash, name, age, location, gender, looking_for, bio, work, photos, is_verified)
               VALUES ($1, $2, $3, $4, 18, 'Luanda', 'other', 'all', '', '', '[]', 0)""",
            user_id, fake_email, hash_password(uuid.uuid4().hex), f"+244{req.phone}",
        )
        user = await db.fetchrow("SELECT * FROM users WHERE id = $1", user_id)

    token = create_token(user["id"])
    return AuthResponse(token=token, user=parse_user(user))
