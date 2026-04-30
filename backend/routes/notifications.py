"""
Real-time notification WebSocket per user.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from notif_manager import notif_manager
from auth_utils import decode_token
from database import get_pool

router = APIRouter()


@router.get("/online-count")
async def online_count():
    """Número de utilizadores com WebSocket ativo (aproximação de online)."""
    return {"count": notif_manager.online_count()}


@router.websocket("/ws")
async def notifications_ws(ws: WebSocket, token: str = Query(...)):
    try:
        user_id = decode_token(token)
    except Exception:
        await ws.close(code=4001)
        return

    was_online = notif_manager.is_online(user_id)
    await notif_manager.connect(ws, user_id)
    if not was_online:
        try:
            await notif_manager.broadcast_all({"type": "user_online", "user_id": user_id})
        except Exception:
            pass
    try:
        pool = await get_pool()
        async with pool.acquire() as db:
            await db.execute("UPDATE users SET last_active_at = NOW() WHERE id = $1", user_id)
    except Exception:
        pass
    try:
        while True:
            # Keep connection alive — client just listens
            await ws.receive_text()
            try:
                pool = await get_pool()
                async with pool.acquire() as db:
                    await db.execute("UPDATE users SET last_active_at = NOW() WHERE id = $1", user_id)
            except Exception:
                pass
    except WebSocketDisconnect:
        notif_manager.disconnect(ws, user_id)
        if not notif_manager.is_online(user_id):
            try:
                await notif_manager.broadcast_all({"type": "user_offline", "user_id": user_id})
            except Exception:
                pass
