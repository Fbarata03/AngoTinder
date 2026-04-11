import os
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from database import init_db, cleanup_old_data
from routes import auth, profiles, matches, messages, admin, notifications

app = FastAPI(title="AngoTinder API", version="1.0.0")

# CORS
_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://angotinder.bafly.net",
    "https://angotinder.netlify.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["profiles"])
app.include_router(matches.router, prefix="/api/matches", tags=["matches"])
app.include_router(messages.router, prefix="/api/messages", tags=["messages"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

# Serve local photo uploads (fallback when Cloudinary is not configured)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(_static_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


async def daily_cleanup_task():
    """Limpeza automática a cada 24 horas — nunca apaga utilizadores."""
    while True:
        await asyncio.sleep(24 * 60 * 60)  # 24 horas
        try:
            await cleanup_old_data()
            print("[cleanup] Limpeza automática concluída")
        except Exception as e:
            print(f"[cleanup] Erro na limpeza: {e}")


@app.on_event("startup")
async def startup():
    await init_db()
    # Limpeza inicial ao arrancar
    try:
        await cleanup_old_data()
        print("[cleanup] Limpeza inicial concluída")
    except Exception as e:
        print(f"[cleanup] Erro na limpeza inicial: {e}")
    # Inicia tarefa de limpeza periódica
    asyncio.create_task(daily_cleanup_task())


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "AngoTinder"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
