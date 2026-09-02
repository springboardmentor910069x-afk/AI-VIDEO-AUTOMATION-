from pymongo import MongoClient
from pymongo.database import Database

from app.core.config import get_settings

_client: MongoClient | None = None


def get_mongo() -> Database:
    global _client
    settings = get_settings()
    if _client is None:
        _client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    return _client[settings.mongodb_db]
