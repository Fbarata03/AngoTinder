from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncpg
from database import get_db
from auth_utils import get_current_user_id

router = APIRouter()

REPORT_REASONS = {
    "fake",
    "spam",
    "inappropriate",
    "harassment",
    "underage",
    "other",
}


class ReportRequest(BaseModel):
    reported_id: str
    reason: str
    details: Optional[str] = ""


@router.post("/block/{target_id}")
async def block_user(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Não podes bloquear-te a ti mesmo")

    target = await db.fetchrow("SELECT id FROM users WHERE id=$1", target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    await db.execute(
        """INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
           ON CONFLICT (blocker_id, blocked_id) DO NOTHING""",
        user_id, target_id,
    )

    # Also remove any existing match between them
    match = await db.fetchrow(
        "SELECT id FROM matches WHERE (user1_id=$1 AND user2_id=$2) OR (user1_id=$3 AND user2_id=$4)",
        user_id, target_id, target_id, user_id,
    )
    if match:
        await db.execute("DELETE FROM messages WHERE match_id=$1", match["id"])
        await db.execute("DELETE FROM matches WHERE id=$1", match["id"])

    return {"success": True}


@router.delete("/block/{target_id}")
async def unblock_user(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        "DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2",
        user_id, target_id,
    )
    return {"success": True}


@router.get("/blocks")
async def get_blocked_users(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.id, u.name FROM users u
           INNER JOIN blocks b ON b.blocked_id = u.id
           WHERE b.blocker_id = $1""",
        user_id,
    )
    return [dict(r) for r in rows]


@router.post("/report")
async def report_user(
    req: ReportRequest,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    if req.reported_id == user_id:
        raise HTTPException(status_code=400, detail="Não podes denunciar-te a ti mesmo")

    if req.reason not in REPORT_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"Motivo inválido. Use: {', '.join(sorted(REPORT_REASONS))}",
        )

    target = await db.fetchrow("SELECT id FROM users WHERE id=$1", req.reported_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    await db.execute(
        "INSERT INTO reports (reporter_id, reported_id, reason, details) VALUES ($1, $2, $3, $4)",
        user_id, req.reported_id, req.reason, (req.details or "")[:500],
    )

    # Auto-block after report
    await db.execute(
        """INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
           ON CONFLICT (blocker_id, blocked_id) DO NOTHING""",
        user_id, req.reported_id,
    )

    return {"success": True, "message": "Denúncia enviada. O perfil foi bloqueado automaticamente."}
