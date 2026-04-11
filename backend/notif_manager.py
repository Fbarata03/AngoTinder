"""
Shared notification manager — lives outside routes/ to avoid circular imports.
"""
from fastapi import WebSocket


class NotificationManager:
    def __init__(self):
        # user_id -> list of active WebSocket connections
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        if user_id not in self.connections:
            self.connections[user_id] = []
        self.connections[user_id].append(ws)

    def disconnect(self, ws: WebSocket, user_id: str):
        if user_id in self.connections:
            self.connections[user_id] = [w for w in self.connections[user_id] if w != ws]

    def online_count(self) -> int:
        return sum(1 for conns in self.connections.values() if conns)

    def is_online(self, user_id: str) -> bool:
        return bool(self.connections.get(user_id))

    async def notify(self, user_id: str, event: dict):
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


# Singleton — imported by both matches.py and notifications.py
notif_manager = NotificationManager()
