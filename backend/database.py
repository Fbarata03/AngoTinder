import aiosqlite
import json
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(__file__), "angotinder.db")


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                location TEXT NOT NULL,
                work TEXT,
                bio TEXT,
                photos TEXT DEFAULT '[]',
                is_verified INTEGER DEFAULT 1,
                education TEXT,
                hometown TEXT,
                interests TEXT DEFAULT '[]',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS swipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                swiper_id TEXT NOT NULL,
                swiped_id TEXT NOT NULL,
                direction TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(swiper_id, swiped_id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id TEXT PRIMARY KEY,
                user1_id TEXT NOT NULL,
                user2_id TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                match_id TEXT NOT NULL,
                sender_id TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await db.commit()

        # Seed users if empty
        cursor = await db.execute("SELECT COUNT(*) as count FROM users")
        row = await cursor.fetchone()
        if row["count"] == 0:
            await seed_data(db)


async def seed_data(db):
    users = [
        {
            "id": "user_me",
            "name": "Maria Santos",
            "age": 28,
            "location": "Luanda, Angola",
            "work": "Engenheira de Software",
            "bio": "Amo viajar, conhecer novos lugares e aproveitar a vida! 🌍✨ Adoro música, dançar kizomba e experimentar novas culinárias angolanas.",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=800",
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800",
            ]),
            "is_verified": 1,
            "education": "Universidade Agostinho Neto",
            "hometown": "Luanda",
            "interests": json.dumps(["Kizomba", "Tecnologia", "Viagens", "Culinária", "Fotografia"]),
        },
        {
            "id": "user_ana",
            "name": "Ana Silva",
            "age": 26,
            "location": "Luanda, Angola",
            "work": "Designer Gráfica",
            "bio": "Apaixonada por arte, design e café ☕️ Adoro explorar novos lugares em Luanda e criar coisas bonitas!",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800",
                "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
            ]),
            "is_verified": 1,
            "education": "Instituto Superior de Artes",
            "hometown": "Benguela",
            "interests": json.dumps(["Arte", "Design", "Café", "Música", "Dança"]),
        },
        {
            "id": "user_sofia",
            "name": "Sofia Costa",
            "age": 24,
            "location": "Benguela, Angola",
            "work": "Professora",
            "bio": "Amo dançar kizomba e semba! 💃 Professora durante o dia, dançarina à noite. Procuro alguém especial!",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1619194617426-f460de77ff72?w=800",
                "https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?w=800",
            ]),
            "is_verified": 1,
            "education": "Escola de Dança de Benguela",
            "hometown": "Benguela",
            "interests": json.dumps(["Kizomba", "Semba", "Educação", "Crianças", "Música"]),
        },
        {
            "id": "user_joana",
            "name": "Joana Mendes",
            "age": 29,
            "location": "Huambo, Angola",
            "work": "Engenheira Civil",
            "bio": "Aventureira e amante da natureza 🏞️ Sempre pronta para uma nova aventura! Amo as serras do Huambo.",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1560114928-40f1f1eb26a0?w=800",
                "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=800",
            ]),
            "is_verified": 1,
            "education": "ISPT Angola",
            "hometown": "Huambo",
            "interests": json.dumps(["Natureza", "Aventura", "Engenharia", "Caminhadas", "Fotografia"]),
        },
        {
            "id": "user_isabel",
            "name": "Isabel Fernandes",
            "age": 27,
            "location": "Lobito, Angola",
            "work": "Fotógrafa",
            "bio": "Capturo momentos e crio memórias 📸 Amo a cultura angolana e suas belezas! A fotografia é minha paixão.",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800",
                "https://images.unsplash.com/photo-1557296387-5358ad7997bb?w=800",
            ]),
            "is_verified": 1,
            "education": "Escola de Artes de Luanda",
            "hometown": "Lobito",
            "interests": json.dumps(["Fotografia", "Arte", "Cultura", "Viagens", "Cinema"]),
        },
        {
            "id": "user_beatriz",
            "name": "Beatriz Santos",
            "age": 25,
            "location": "Luanda, Angola",
            "work": "Médica",
            "bio": "Médica apaixonada pela vida! 🩺 Acredito que a saúde é o maior bem. Amo a praia e os pôr do sol em Luanda.",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800",
                "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800",
            ]),
            "is_verified": 1,
            "education": "Faculdade de Medicina - UAN",
            "hometown": "Luanda",
            "interests": json.dumps(["Medicina", "Saúde", "Praia", "Leitura", "Culinária"]),
        },
        {
            "id": "user_carolina",
            "name": "Carolina Lopes",
            "age": 28,
            "location": "Benguela, Angola",
            "work": "Economista",
            "bio": "Economista e empreendedora 💼 Sonho grande e trabalho duro! Amo empreendedorismo e negócios angolanos.",
            "photos": json.dumps([
                "https://images.unsplash.com/photo-1589156229687-496a31ad1d1f?w=800",
                "https://images.unsplash.com/photo-1619194617426-f460de77ff72?w=800",
            ]),
            "is_verified": 1,
            "education": "Universidade Católica de Angola",
            "hometown": "Benguela",
            "interests": json.dumps(["Negócios", "Empreendedorismo", "Economia", "Viagens", "Moda"]),
        },
    ]

    for user in users:
        await db.execute(
            """INSERT INTO users (id, name, age, location, work, bio, photos, is_verified, education, hometown, interests)
               VALUES (:id, :name, :age, :location, :work, :bio, :photos, :is_verified, :education, :hometown, :interests)""",
            user,
        )

    # Seed initial match between user_me and user_ana
    match_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO matches (id, user1_id, user2_id) VALUES (?, ?, ?)",
        (match_id, "user_me", "user_ana"),
    )

    # Seed some messages
    messages = [
        (match_id, "user_ana", "Oi! Como está? 😊"),
        (match_id, "user_me", "Olá! Estou bem, obrigada! E você?"),
        (match_id, "user_ana", "Também estou bem! Vi que você gosta de tecnologia, que interessante!"),
        (match_id, "user_me", "Sim! É minha paixão. Trabalho como engenheira há 4 anos 😊"),
        (match_id, "user_ana", "Que legal! Adorei o teu perfil!"),
    ]
    for match_id_msg, sender_id, text in messages:
        await db.execute(
            "INSERT INTO messages (match_id, sender_id, text) VALUES (?, ?, ?)",
            (match_id_msg, sender_id, text),
        )

    await db.commit()
