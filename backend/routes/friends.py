from fastapi import APIRouter, Depends, HTTPException
import asyncpg
import json
import uuid
from database import get_db
from auth_utils import get_current_user_id
from notif_manager import notif_manager

router = APIRouter()


def _parse_photos(v):
    if not v:
        return []
    if isinstance(v, list):
        return v
    try:
        return json.loads(v)
    except Exception:
        return []


def _user_preview(row) -> dict:
    if not row:
        return {"id": "", "name": "Utilizador", "photos": []}
    return {
        "id": row["id"],
        "name": row["name"],
        "photos": _parse_photos(row.get("photos")),
    }


@router.post("/request/{target_id}")
async def send_friend_request(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Não podes enviar pedido a ti mesmo")

    target = await db.fetchrow("SELECT id, name FROM users WHERE id=$1", target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    existing = await db.fetchrow(
        """SELECT id, status, sender_id FROM friend_requests
           WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)""",
        user_id, target_id,
    )

    if existing:
        if existing["status"] == "accepted":
            raise HTTPException(status_code=400, detail="Já são amigos")
        if existing["status"] == "pending":
            if existing["sender_id"] == user_id:
                raise HTTPException(status_code=400, detail="Pedido já enviado")
            # The other person sent me a request → accept it automatically
            return await _do_accept(existing["id"], user_id, db)
        # rejected → reset to pending
        await db.execute(
            "UPDATE friend_requests SET status='pending', created_at=NOW(), sender_id=$1, receiver_id=$2 WHERE id=$3",
            user_id, target_id, existing["id"],
        )
        req_id = existing["id"]
    else:
        req_id = await db.fetchval(
            "INSERT INTO friend_requests (sender_id, receiver_id) VALUES ($1, $2) RETURNING id",
            user_id, target_id,
        )

    me = await db.fetchrow("SELECT name, photos FROM users WHERE id=$1", user_id)
    me_name = (me["name"] if me else None) or "Utilizador"

    # Persistent notification
    await db.execute(
        """INSERT INTO notifications (user_id, from_user_id, type, message, ref_id)
           VALUES ($1, $2, 'friend_request', $3, $4)""",
        target_id, user_id,
        f"{me_name} enviou-te um pedido de amizade",
        str(req_id),
    )

    # Real-time notification
    try:
        await notif_manager.notify(target_id, {
            "type": "friend_request",
            "request_id": req_id,
            "from_user_id": user_id,
            "name": me_name,
            "photos": _parse_photos(me["photos"]) if me else [],
        })
    except Exception:
        pass

    return {"success": True, "request_id": req_id}


async def _do_accept(request_id: int, user_id: str, db: asyncpg.Connection) -> dict:
    req = await db.fetchrow(
        "SELECT * FROM friend_requests WHERE id=$1 AND receiver_id=$2 AND status='pending'",
        request_id, user_id,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")

    await db.execute("UPDATE friend_requests SET status='accepted' WHERE id=$1", request_id)

    sender_id = req["sender_id"]

    # Create friend-type match for chat
    existing_match = await db.fetchrow(
        """SELECT id FROM matches
           WHERE ((user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1))
           AND type='friend'""",
        user_id, sender_id,
    )
    if not existing_match:
        match_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO matches (id, user1_id, user2_id, type) VALUES ($1, $2, $3, 'friend')",
            match_id, user_id, sender_id,
        )
    else:
        match_id = existing_match["id"]

    me = await db.fetchrow("SELECT name, photos FROM users WHERE id=$1", user_id)
    them = await db.fetchrow("SELECT name, photos FROM users WHERE id=$1", sender_id)
    me_name = (me["name"] if me else None) or "Utilizador"

    # Persistent notification for sender
    await db.execute(
        """INSERT INTO notifications (user_id, from_user_id, type, message, ref_id)
           VALUES ($1, $2, 'friend_accepted', $3, $4)""",
        sender_id, user_id,
        f"{me_name} aceitou o teu pedido de amizade",
        match_id,
    )

    try:
        await notif_manager.notify(sender_id, {
            "type": "friend_accepted",
            "match_id": match_id,
            "user": _user_preview(me),
        })
        await notif_manager.notify(user_id, {
            "type": "friend_accepted",
            "match_id": match_id,
            "user": _user_preview(them),
        })
    except Exception:
        pass

    return {"success": True, "match_id": match_id}


@router.put("/requests/{request_id}/accept")
async def accept_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    return await _do_accept(request_id, user_id, db)


@router.put("/requests/{request_id}/reject")
async def reject_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    req = await db.fetchrow(
        "SELECT id FROM friend_requests WHERE id=$1 AND receiver_id=$2 AND status='pending'",
        request_id, user_id,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    await db.execute("UPDATE friend_requests SET status='rejected' WHERE id=$1", request_id)
    return {"success": True}


@router.delete("/requests/{request_id}")
async def cancel_request(
    request_id: int,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    req = await db.fetchrow(
        "SELECT id FROM friend_requests WHERE id=$1 AND sender_id=$2 AND status='pending'",
        request_id, user_id,
    )
    if not req:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    await db.execute("DELETE FROM friend_requests WHERE id=$1", request_id)
    return {"success": True}


@router.delete("/{friend_id}")
async def remove_friend(
    friend_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    await db.execute(
        """DELETE FROM friend_requests
           WHERE ((sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1))""",
        user_id, friend_id,
    )
    await db.execute(
        """DELETE FROM matches
           WHERE ((user1_id=$1 AND user2_id=$2) OR (user1_id=$2 AND user2_id=$1))
           AND type='friend'""",
        user_id, friend_id,
    )
    return {"success": True}


@router.get("/")
async def get_friends(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT u.id, u.name, u.photos, u.age, u.location, u.is_verified, fr.id as request_id
           FROM friend_requests fr
           JOIN users u ON u.id = CASE WHEN fr.sender_id=$1 THEN fr.receiver_id ELSE fr.sender_id END
           WHERE (fr.sender_id=$1 OR fr.receiver_id=$1) AND fr.status='accepted'
           ORDER BY fr.created_at DESC""",
        user_id,
    )
    return [
        {
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "photos": _parse_photos(r["photos"]), "request_id": r["request_id"],
        }
        for r in rows
    ]


@router.get("/requests/received")
async def get_received_requests(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT fr.id as request_id, fr.created_at,
                  u.id, u.name, u.photos, u.age, u.location, u.is_verified, u.bio
           FROM friend_requests fr
           JOIN users u ON u.id = fr.sender_id
           WHERE fr.receiver_id=$1 AND fr.status='pending'
           ORDER BY fr.created_at DESC""",
        user_id,
    )
    return [
        {
            "request_id": r["request_id"],
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "bio": r.get("bio") or "",
            "photos": _parse_photos(r["photos"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


@router.get("/requests/sent")
async def get_sent_requests(
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    rows = await db.fetch(
        """SELECT fr.id as request_id, fr.created_at,
                  u.id, u.name, u.photos, u.age, u.location, u.is_verified
           FROM friend_requests fr
           JOIN users u ON u.id = fr.receiver_id
           WHERE fr.sender_id=$1 AND fr.status='pending'
           ORDER BY fr.created_at DESC""",
        user_id,
    )
    return [
        {
            "request_id": r["request_id"],
            "id": r["id"], "name": r["name"], "age": r["age"],
            "location": r["location"], "is_verified": r["is_verified"],
            "photos": _parse_photos(r["photos"]),
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
        }
        for r in rows
    ]


@router.get("/status/{target_id}")
async def friendship_status(
    target_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db),
):
    req = await db.fetchrow(
        """SELECT id, status, sender_id FROM friend_requests
           WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)""",
        user_id, target_id,
    )
    if not req:
        return {"status": "none", "request_id": None, "is_sender": False}
    return {
        "status": req["status"],
        "request_id": req["id"],
        "is_sender": req["sender_id"] == user_id,
    }
