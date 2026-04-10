import asyncpg
import os

DATABASE_URL = os.getenv("DATABASE_URL", "")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn


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
