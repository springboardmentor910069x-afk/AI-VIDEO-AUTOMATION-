import os
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Union
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings
from app.mongodb_models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash each password with a unique salt managed by passlib."""
    return password_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return password_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None, token_type: str = "access") -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "typ": token_type})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict) -> str:
    return create_access_token(data, expires_delta=timedelta(days=7), token_type="refresh")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # Strict token validation

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None or payload.get("typ", "access") != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 1. Try MongoUser (Beanie)
    try:
        user = await User.get(user_id)
        if user and user.is_active:
            return user
    except Exception:
        pass

    # 2. Try SQL User (PostgreSQL / Relational)
    try:
        from app.database import SessionLocal
        from app.models import User as SQLUser
        db = SessionLocal()
        try:
            sql_u = db.query(SQLUser).filter(SQLUser.id == user_id).first()
            if sql_u and sql_u.is_active:
                # Convert SQLUser to Mongo-compatible duck type
                return User(
                    id=sql_u.id,
                    email=sql_u.email,
                    hashed_password=sql_u.password_hash,
                    name=sql_u.name,
                    role=sql_u.role,
                    is_active=sql_u.is_active
                )
        finally:
            db.close()
    except Exception:
        pass

    raise credentials_exception

oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional)) -> Optional[User]:
    """Optional user dependency that allows unauthenticated access for media streaming and public queries."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None or payload.get("typ", "access") != "access":
            return None
        user = await User.get(user_id)
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None

def require_role(roles: Union[str, List[str]]):
    """
    RBAC dependency supporting both single string role or list of allowed roles.
    """
    if isinstance(roles, str):
        allowed_roles = [roles]
    else:
        allowed_roles = roles

    async def role_checker(current_user: User = Depends(get_current_user)):
        raw_role = getattr(current_user, "role", "")
        user_role = str(getattr(raw_role, "value", raw_role)).lower()
        allowed_lower = [r.lower() for r in allowed_roles]
        if user_role not in allowed_lower and user_role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the required permissions"
            )
        return current_user
    return role_checker

def require_roles(allowed_roles: List[str]):
    return require_role(allowed_roles)

def verify_ownership(resource_owner_id: str, current_user: Optional[User]) -> bool:
    """
    Verifies that the current user owns the resource or has an admin role.
    If current_user is None (optional route), access is allowed.
    """
    if current_user is None:
        return True
    user_id = str(getattr(current_user, "id", ""))
    raw_role = getattr(current_user, "role", "")
    user_role = str(getattr(raw_role, "value", raw_role)).lower()
    if user_role == "admin" or not resource_owner_id or resource_owner_id in ["None", "", "demo-user"]:
        return True
    if user_id != str(resource_owner_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access or modify this resource"
        )
    return True

async def require_video_access(video_id: str, current_user: User) -> User:
    """Ensure a user owns a video, unless they are an administrator."""
    from app.mongodb_models import Video
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
    verify_ownership(str(video.user_id), current_user)
    return current_user
