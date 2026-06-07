"""
Real-time notification WebSocket per user + REST endpoints for persistent notifications.
"""
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
import asyncpg
from notif_manager import notif_manager
from auth_utils import decode_token, get_current_user_id
from database import get_pool, get_db

router = APIRouter()


@router.get("/online-count")
async def online_count():
    """Número de utilizadores com WebSocket ativo (aproximação de online)."""
    return {"count": notif_manager.online_count()}


@router.get("/")
async def get_notifications(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT n.id, n.type, n.message, n.read, n.ref_id, n.created_at,
                  u.name as from_name, u.photos as from_photos
           FROM notifications n
           LEFT JOIN users u ON u.id = n.from_user_id
           WHERE n.user_id=$1
           ORDER BY n.created_at DESC
           LIMIT 50""",
        user_id,
    )
    import json as _json
    result = []
    for r in rows:
        photos = r["from_photos"]
        if photos and not isinstance(photos, list):
            try:
                photos = _json.loads(photos)
            except Exception:
                photos = []
        result.append({
            "id": r["id"],
            "type": r["type"],
            "message": r["message"],
            "read": r["read"],
            "ref_id": r["ref_id"],
            "from_name": r["from_name"],
            "from_photo": (photos[0] if photos else None),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        })
    return result


@router.put("/read")
async def mark_all_read(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE notifications SET read=TRUE WHERE user_id=$1 AND read=FALSE",
        user_id,
    )
    return {"success": True}


@router.put("/{notif_id}/read")
async def mark_one_read(
    notif_id: int,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "UPDATE notifications SET read=TRUE WHERE id=$1 AND user_id=$2",
        notif_id, user_id,
    )
    return {"success": True}


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
    async def _heartbeat():
        """Atualiza last_active_at a cada 60s enquanto o WS estiver ligado."""
        try:
            pool = await get_pool()
            async with pool.acquire() as db:
                await db.execute("UPDATE users SET last_active_at = NOW() WHERE id = $1", user_id)
        except Exception:
            pass

    try:
        while True:
            try:
                # Aguarda ping do cliente por até 60s; timeout → heartbeat mesmo sem ping
                await asyncio.wait_for(ws.receive_text(), timeout=60.0)
            except asyncio.TimeoutError:
                pass
            await _heartbeat()
    except WebSocketDisconnect:
        notif_manager.disconnect(ws, user_id)
        if not notif_manager.is_online(user_id):
            try:
                await notif_manager.broadcast_all({"type": "user_offline", "user_id": user_id})
            except Exception:
                pass
