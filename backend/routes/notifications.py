"""
Real-time notification WebSocket per user.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from auth_utils import decode_token
from notif_manager import notif_manager  # shared singleton

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

    await notif_manager.connect(ws, user_id)
    try:
        while True:
            # Keep connection alive — client just listens
            await ws.receive_text()
    except WebSocketDisconnect:
        notif_manager.disconnect(ws, user_id)
