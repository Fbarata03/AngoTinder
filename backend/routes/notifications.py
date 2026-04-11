"""
Real-time notification WebSocket per user.
When a match is created, the match route notifies the other user here.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from auth_utils import decode_token

router = APIRouter()


class NotificationManager:
    def __init__(self):
        # user_id -> list of WebSocket connections (same user on multiple devices)
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(ws)

    def disconnect(self, ws: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id] = [w for w in self.connections[user_id] if w != ws]

    async def notify(self, user_id: str, event: dict):
        """Send an event to all connections for a user."""
        if user_id not in self.connections:
            return
        dead = []
        for ws in self.connections[user_id]:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)


notif_manager = NotificationManager()


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
