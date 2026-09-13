from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
from app.mongodb_models import (
    User as MongoUser, APIKey, Video as MongoVideo, Transcript, Summary,
    KeyMoment, Bookmark, AuditLog, Setting, ProcessingJob, ContentInsight, Share,
    Quiz, FlashcardSet
)


Base = declarative_base()

# SQLAlchemy (PostgreSQL / Relational DB) Engine & Sessionmaker
postgres_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
try:
    sql_engine = create_engine(postgres_url, pool_pre_ping=True, connect_args={"connect_timeout": 3})
    # Test connection
    with sql_engine.connect() as conn:
        pass
    print("[OK] Relational SQL database connected successfully")
except Exception:
    # Fallback to SQLite if PostgreSQL service is not actively listening locally
    sql_engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {})
    print("[OK] Relational SQL database initialized")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sql_engine)

def get_sql_db():
    """Dependency to provide a PostgreSQL / SQL database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_postgres():
    """Create all PostgreSQL relational tables DDL"""
    from app import models # Ensure models are loaded
    Base.metadata.create_all(bind=sql_engine)
    print("[OK] Relational tables verified")

# MongoDB client
mongodb_client: AsyncIOMotorClient = None

async def init_mongodb():
    """Initialize MongoDB connection and Beanie ODM for document payloads"""
    global mongodb_client
    try:
        mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
        await init_beanie(
            database=mongodb_client[settings.MONGODB_DB_NAME],
            document_models=[
                MongoUser, APIKey, MongoVideo, Transcript, Summary,
                KeyMoment, Bookmark, AuditLog, Setting,
                ProcessingJob, ContentInsight, Share,
                Quiz, FlashcardSet
            ]
        )
        print("[OK] Document database connected securely")

        # Seed default Admin account for administrative operations
        try:
            from app.security import get_password_hash
            from app.mongodb_models import UserRole
            existing_admin = await MongoUser.find_one({"email": "admin@clipmind.ai"})
            if not existing_admin:
                admin_user = MongoUser(
                    email="admin@clipmind.ai",
                    name="System Admin",
                    hashed_password=get_password_hash("Admin@123"),
                    role=UserRole.ADMIN,
                    is_active=True
                )
                await admin_user.insert()
                print("[OK] Seeded default administrator account: admin@clipmind.ai / Admin@123")
        except Exception as seed_err:
            print(f"[WARN] Admin seed notice: {seed_err}")
    except Exception as e:
        print(f"[WARN] Document database connection fallback active: {e}")
        # Proceed gracefully for dev
        pass

async def close_mongodb():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        print("[OK] MongoDB connection closed")

async def get_mongodb():
    """Dependency to get MongoDB client"""
    return mongodb_client

def get_db():
    """Dependency for DB session (SQLAlchemy Session)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
