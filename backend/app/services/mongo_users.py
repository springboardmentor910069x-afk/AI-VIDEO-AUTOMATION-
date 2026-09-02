from datetime import datetime
from uuid import uuid4

from pymongo import ASCENDING, ReturnDocument

from app.core.security import hash_password, verify_password
from app.db.mongo import get_mongo
from app.models.enums import UserRole
from app.schemas.auth import RegisterRequest


USERS_COLLECTION = "users"
AUDIT_COLLECTION = "audit_logs"


class EmailAlreadyRegisteredError(Exception):
    pass


class MongoUser:
    def __init__(self, document: dict):
        self.id = str(document["_id"])
        self.name = document["name"]
        self.email = document["email"]
        self.password_hash = document["password_hash"]
        self.role = UserRole(document["role"])
        self.created_at = document["created_at"]

    def to_public_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "created_at": self.created_at.isoformat() if hasattr(self.created_at, "isoformat") else str(self.created_at),
        }


async def ensure_user_indexes() -> None:
    db = get_mongo()
    db[USERS_COLLECTION].create_index([("email", ASCENDING)], unique=True)


async def create_user(payload: RegisterRequest) -> MongoUser:
    await ensure_user_indexes()
    db = get_mongo()
    email = payload.email.lower()
    if db[USERS_COLLECTION].find_one({"email": email}):
        raise EmailAlreadyRegisteredError("Email already registered")
    document = {
        "_id": str(uuid4()),
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": payload.role.value,
        "created_at": datetime.utcnow(),
    }
    db[USERS_COLLECTION].insert_one(document)
    await write_mongo_audit(document["_id"], "register", "users")
    return MongoUser(document)


async def find_user_by_email(email: str) -> MongoUser | None:
    document = get_mongo()[USERS_COLLECTION].find_one({"email": email.lower()})
    return MongoUser(document) if document else None


async def find_user_by_id(user_id: str) -> MongoUser | None:
    document = get_mongo()[USERS_COLLECTION].find_one({"_id": user_id})
    return MongoUser(document) if document else None


async def list_users() -> list[MongoUser]:
    documents = get_mongo()[USERS_COLLECTION].find({}, {"password_hash": 0}).sort("created_at", -1)
    return [MongoUser({**document, "password_hash": ""}) for document in documents]


async def update_user_role(user_id: str, role: UserRole) -> MongoUser | None:
    result = get_mongo()[USERS_COLLECTION].find_one_and_update(
        {"_id": user_id},
        {"$set": {"role": role.value}},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        return None
    await write_mongo_audit(user_id, "update_role", "users")
    return MongoUser(result)


async def authenticate_user(email: str, password: str) -> MongoUser | None:
    user = await find_user_by_email(email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    await write_mongo_audit(user.id, "login", "auth")
    return user


async def write_mongo_audit(user_id: str | None, action: str, resource: str) -> None:
    get_mongo()[AUDIT_COLLECTION].insert_one(
        {
            "user_id": user_id,
            "action": action,
            "resource": resource,
            "timestamp": datetime.utcnow(),
        }
    )
