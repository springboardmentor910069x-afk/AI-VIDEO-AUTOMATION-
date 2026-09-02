import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
from typing import Any
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    digest = _password_digest(password)
    return bcrypt.hashpw(digest, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    digest = _password_digest(password)
    expected = password_hash.encode("utf-8")
    try:
        actual = bcrypt.hashpw(digest, expected)
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


def _password_digest(password: str) -> bytes:
    sha = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(sha)


def create_token(subject: str, role: str, minutes: int | None = None, days: int | None = None, token_type: str = "access") -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expires = now + (timedelta(days=days) if days else timedelta(minutes=minutes or settings.access_token_expire_minutes))
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": expires,
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
