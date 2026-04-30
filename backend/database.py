import asyncpg
import asyncio
import os
import json
import time
import uuid

DATABASE_URL = os.getenv("DATABASE_URL", "")
INSTANCE_ID = os.getenv("ANGOTINDER_INSTANCE_ID", "") or uuid.uuid4().hex
PG_EVENTS_CHANNEL = os.getenv("PG_EVENTS_CHANNEL", "angotinder_events")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
            max_inactive_connection_lifetime=300,
        )
    return _pool


async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


async def publish_event(event: dict):
    """
    Publica um evento via Postgres LISTEN/NOTIFY para sincronizar tempo real entre múltiplas instâncias.
    Nunca apaga utilizadores e não depende de Redis.
    """
    pool = await get_pool()
    payload = json.dumps({"source": INSTANCE_ID, **event}, ensure_ascii=False)
    async with pool.acquire() as conn:
        await conn.execute("SELECT pg_notify($1, $2)", PG_EVENTS_CHANNEL, payload)


def _parse_chat_exp(name: str) -> int | None:
    i = name.find("__exp")
    if i < 0:
        return None
    start = i + 5
    end = name.find(".", start)
    if end < 0:
        end = len(name)
    part = name[start:end]
    if not part.isdigit():
        return None
    return int(part)


def cleanup_chat_files_sync() -> int:
    """
    Apaga ficheiros de chat expirados da pasta /static/chat/.
    Função síncrona para poder ser chamada de tasks assíncronas via loop.run_in_executor.
    Retorna o número de ficheiros apagados.
    """
    static_chat_dir = os.path.join(os.path.dirname(__file__), "static", "chat")
    if not os.path.isdir(static_chat_dir):
        return 0
    deleted = 0
    now = int(time.time())
    try:
        for entry in os.scandir(static_chat_dir):
            if not entry.is_file():
                continue
            exp = _parse_chat_exp(entry.name)
            if exp is None:
                continue
            if now <= exp:
                continue
            try:
                os.remove(entry.path)
                deleted += 1
            except FileNotFoundError:
                continue
            except OSError:
                continue
    except OSError:
        pass
    return deleted


async def cleanup_chat_files() -> int:
    """Limpeza assíncrona dos ficheiros de chat expirados. Roda o I/O bloqueante numa thread."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, cleanup_chat_files_sync)


async def cleanup_old_data():
    """
    Limpeza completa (DB + ficheiros) — deve correr uma vez por dia:
    - OTPs expirados
    - Swipes LEFT com mais de 60 dias
    - Mensagens excedentes (mantém as 500 mais recentes por conversa)
    - Fotos de perfil locais órfãs
    - Ficheiros de chat expirados
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        deleted_otps = await conn.execute(
            "DELETE FROM phone_otps WHERE expires_at < NOW()"
        )

        # Remove swipes LEFT antigos (>60 dias) — deixa mostrar o perfil de novo ao fim de 2 meses
        deleted_swipes = await conn.execute(
            "DELETE FROM swipes WHERE direction = 'left' AND created_at < NOW() - INTERVAL '60 days'"
        )

        # Mantém apenas as 500 mensagens mais recentes por conversa
        await conn.execute("""
            DELETE FROM messages
            WHERE id IN (
                SELECT id FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY created_at DESC) AS rn
                    FROM messages
                ) ranked
                WHERE rn > 500
            )
        """)

        static_photos_dir = os.path.join(os.path.dirname(__file__), "static", "photos")
        referenced: set[str] = set()
        try:
            rows = await conn.fetch("SELECT photos FROM users")
            for r in rows:
                raw = r.get("photos")
                if not raw:
                    continue
                try:
                    arr = json.loads(raw)
                except Exception:
                    continue
                if not isinstance(arr, list):
                    continue
                for url in arr:
                    if isinstance(url, str) and url.startswith("/static/photos/"):
                        rel = url.split("?", 1)[0].replace("/static/photos/", "", 1)
                        name = os.path.basename(rel)
                        if name:
                            referenced.add(name)
        except Exception:
            referenced = set()

        if os.path.isdir(static_photos_dir):
            now = time.time()
            for entry in os.scandir(static_photos_dir):
                if not entry.is_file():
                    continue
                name = entry.name
                if name in referenced:
                    continue
                lower = name.lower()
                if not lower.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
                    continue
                try:
                    st = entry.stat()
                    if (now - st.st_mtime) < 60:
                        continue
                    os.remove(entry.path)
                except FileNotFoundError:
                    continue
                except OSError:
                    continue

    # Limpeza de ficheiros de chat (roda na thread pool para não bloquear)
    await cleanup_chat_files()

    return {"otps": deleted_otps, "swipes": deleted_swipes}


async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                location TEXT NOT NULL DEFAULT 'Angola',
                work TEXT DEFAULT '',
                bio TEXT DEFAULT '',
                photos TEXT DEFAULT '[]',
                is_verified INTEGER DEFAULT 0,
                education TEXT DEFAULT '',
                hometown TEXT DEFAULT '',
                interests TEXT DEFAULT '[]',
                gender TEXT DEFAULT 'other',
                looking_for TEXT DEFAULT 'all',
                created_at TIMESTAMP DEFAULT NOW(),
                latitude FLOAT DEFAULT NULL,
                longitude FLOAT DEFAULT NULL,
                last_active_at TIMESTAMP DEFAULT NOW(),
                incognito_mode INTEGER DEFAULT 0
            )
        """)
        # Migrations: add columns if they don't exist yet (safe for existing DBs)
        for col_sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude FLOAT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude FLOAT DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW()",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS incognito_mode INTEGER DEFAULT 0",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE",
        ]:
            try:
                await conn.execute(col_sql)
            except Exception:
                pass

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS swipes (
                id SERIAL PRIMARY KEY,
                swiper_id TEXT NOT NULL REFERENCES users(id),
                swiped_id TEXT NOT NULL REFERENCES users(id),
                direction TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(swiper_id, swiped_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id TEXT PRIMARY KEY,
                user1_id TEXT NOT NULL REFERENCES users(id),
                user2_id TEXT NOT NULL REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                match_id TEXT NOT NULL REFERENCES matches(id),
                sender_id TEXT NOT NULL REFERENCES users(id),
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS phone_otps (
                phone TEXT PRIMARY KEY,
                code TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS blocks (
                id SERIAL PRIMARY KEY,
                blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(blocker_id, blocked_id)
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reported_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                details TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            )
        """)

        # Índices para melhorar performance e reduzir uso de BD
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_swiped ON swipes(swiped_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_swiped_dir ON swipes(swiped_id, direction)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_created ON swipes(created_at)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_users ON matches(user1_id, user2_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_location ON users(location)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_match_created ON messages(match_id, created_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id)")
        # Composite indexes for discover hot path
        # (swiper_id, direction) → NOT IN subqueries on right/super swipes
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_swiper_dir ON swipes(swiper_id, direction)")
        # (swiper_id, direction, created_at) → left-swipe cooldown filter
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_swipes_swiper_dir_created ON swipes(swiper_id, direction, created_at DESC)")
        # (incognito_mode, age) → WHERE incognito_mode=0 AND age BETWEEN x AND y
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_incognito_age ON users(incognito_mode, age)")
        # (gender, age) → gender+age filter combinations in discover
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_users_gender_age ON users(gender, age)")
        # matches: fast lookup by either user (for exclusion subquery)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1_id)")
        # messages: covering index for last-message lookup (avoids heap fetch)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_messages_match_id_desc ON messages(match_id, id DESC)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)")
