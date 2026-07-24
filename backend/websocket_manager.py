"""
websocket_manager.py
--------------------
Thread-safe WebSocket ConnectionManager for real-time push notifications.

Two types of connections are tracked:
  - Admin connections: receive every order status change event
  - Customer connections: keyed by user_id, receive only their own events

Usage (in order_router.py):
    from websocket_manager import manager
    await manager.broadcast_admin(event)
    await manager.send_to_user(user_id, event)
"""

import asyncio
import json
import logging
from typing import Dict, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # All connected admin websockets
        self._admin_connections: List[WebSocket] = []
        # Per-user customer connections: { user_id: [WebSocket, ...] }
        self._user_connections: Dict[int, List[WebSocket]] = {}

    # ── Connect / Disconnect ──────────────────────────────────────────────────

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self._admin_connections.append(websocket)
        logger.info(f"[WS] Admin connected. Total admins: {len(self._admin_connections)}")

    def disconnect_admin(self, websocket: WebSocket):
        self._admin_connections = [c for c in self._admin_connections if c is not websocket]
        logger.info(f"[WS] Admin disconnected. Remaining: {len(self._admin_connections)}")

    async def connect_user(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self._user_connections:
            self._user_connections[user_id] = []
        self._user_connections[user_id].append(websocket)
        logger.info(f"[WS] User {user_id} connected. Total user connections: {sum(len(v) for v in self._user_connections.values())}")

    def disconnect_user(self, websocket: WebSocket, user_id: int):
        if user_id in self._user_connections:
            self._user_connections[user_id] = [
                c for c in self._user_connections[user_id] if c is not websocket
            ]
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        logger.info(f"[WS] User {user_id} disconnected.")

    # ── Broadcast helpers ──────────────────────────────────────────────────────

    async def broadcast_admin(self, event: dict):
        """Push an event to all connected admin clients."""
        if not self._admin_connections:
            return
        payload = json.dumps(event)
        dead: List[WebSocket] = []
        for ws in list(self._admin_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)

    async def send_to_user(self, user_id: int, event: dict):
        """Push an event to all WebSocket connections belonging to user_id."""
        sockets = self._user_connections.get(user_id, [])
        if not sockets:
            return
        payload = json.dumps(event)
        dead: List[WebSocket] = []
        for ws in list(sockets):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_user(ws, user_id)

    async def broadcast_order_event(self, order_id: int, user_id: int, status: str):
        """
        Convenience wrapper called after every order status change.
        Pushes to both the admin channel and the specific customer.
        """
        event = {
            "type":     "order_update",
            "order_id": order_id,
            "status":   status,
            "user_id":  user_id,
        }
        await asyncio.gather(
            self.broadcast_admin(event),
            self.send_to_user(user_id, event),
        )

    @property
    def admin_count(self) -> int:
        return len(self._admin_connections)

    @property
    def user_count(self) -> int:
        return sum(len(v) for v in self._user_connections.values())


# Singleton instance — import this everywhere
manager = ConnectionManager()
