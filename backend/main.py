import os
import asyncio
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from database import init_db, cleanup_old_data, cleanup_chat_files, get_pool, PG_EVENTS_CHANNEL, INSTANCE_ID
from routes import auth, profiles, matches, messages, admin, notifications
from notif_manager import notif_manager

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


async def hourly_chat_files_cleanup_task():
    while True:
        await asyncio.sleep(60 * 60)
        try:
            deleted = await cleanup_chat_files()
            if deleted:
                print(f"[cleanup-chat] Apagados {deleted} ficheiros expirados")
        except Exception as e:
            print(f"[cleanup-chat] Erro na limpeza: {e}")


async def pg_events_task():
    while True:
        conn = None
        listener = None
        try:
            pool = await get_pool()
            conn = await pool.acquire()

            def _listener(_conn, _pid, _channel, payload):
                try:
                    event = json.loads(payload)
                except Exception:
                    return
                if event.get("source") == INSTANCE_ID:
                    return
                kind = event.get("kind")
                if kind == "notification":
                    user_id = event.get("user_id")
                    data = event.get("event")
                    if user_id and isinstance(data, dict):
                        asyncio.create_task(notif_manager.notify_local(user_id, data))
                    return
                if kind == "room_broadcast":
                    match_id = event.get("match_id")
                    msg = event.get("message")
                    if match_id and isinstance(msg, dict):
                        asyncio.create_task(messages.manager.broadcast(match_id, msg))
                    return
                if kind == "room_signal":
                    match_id = event.get("match_id")
                    sender_id = event.get("sender_id", "")
                    msg = event.get("message")
                    if match_id and isinstance(msg, dict) and isinstance(sender_id, str):
                        asyncio.create_task(messages.manager.forward_to_others(match_id, sender_id, msg))
                    return
                if kind == "broadcast_all":
                    ev = event.get("event")
                    if isinstance(ev, dict):
                        asyncio.create_task(notif_manager.broadcast_all_local(ev))
                    return

            listener = _listener
            await conn.add_listener(PG_EVENTS_CHANNEL, listener)
            print(f"[pg-events] LISTEN {PG_EVENTS_CHANNEL} ({INSTANCE_ID})")
            await asyncio.Future()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[pg-events] Erro: {e}")
        finally:
            try:
                if conn and listener:
                    await conn.remove_listener(PG_EVENTS_CHANNEL, listener)
            except Exception:
                pass
            try:
                if conn:
                    pool = await get_pool()
                    await pool.release(conn)
            except Exception:
                pass
        await asyncio.sleep(2)


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
    asyncio.create_task(hourly_chat_files_cleanup_task())
    asyncio.create_task(pg_events_task())


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "AngoTinder"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3001, reload=True)
