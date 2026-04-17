import asyncpg
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


async def cleanup_old_data():
    """
    Limpa dados temporários sem eliminar utilizadores:
    - OTPs expirados
    - Swipes LEFT com mais de 60 dias (apenas para reduzir tabela, utilizadores não são afetados)
    - Mensagens com mais de 1 ano (mantém as recentes)
    - Fotos locais órfãs (ficheiros que já não estão referenciados por nenhum user)
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Remove OTPs expirados
        deleted_otps = await conn.execute(
            "DELETE FROM phone_otps WHERE expires_at < NOW()"
        )

        # Remove swipes LEFT antigos (>60 dias) — só servem para não mostrar o perfil de novo,
        # mas após 60 dias faz sentido mostrar outra vez
        deleted_swipes = await conn.execute(
            "DELETE FROM swipes WHERE direction = 'left' AND created_at < NOW() - INTERVAL '60 days'"
        )

        # Mantém apenas as últimas 500 mensagens por conversa (apaga as mais antigas)
        # Nunca apaga utilizadores nem matches
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

        static_chat_dir = os.path.join(os.path.dirname(__file__), "static", "chat")
        if os.path.isdir(static_chat_dir):
            now = time.time()
            for entry in os.scandir(static_chat_dir):
                if not entry.is_file():
                    continue
                name = entry.name
                exp = None
                if "__exp" in name:
                    try:
                        exp = int(name.split("__exp", 1)[1].split(".", 1)[0])
                    except Exception:
                        exp = None
                if exp and now > exp:
                    try:
                        os.remove(entry.path)
                    except Exception:
                        pass

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
                created_at TIMESTAMP DEFAULT NOW()
            )
        """)

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
