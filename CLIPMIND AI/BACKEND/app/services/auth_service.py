from typing import Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import HTTPException, status
from app.mongodb_models import User, AuditLog, Setting
from app.schemas import UserRegister, UserLogin, Token, UserResponse, GoogleAuthRequest
from app.security import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token
)

class AuthService:
    async def signup(self, user_in: UserRegister) -> Token:
        try:
            existing = await User.find_one({"email": user_in.email})
        except Exception:
            existing = None
            
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists"
            )

        hashed_pwd = get_password_hash(user_in.password)
        user = User(
            email=user_in.email,
            hashed_password=hashed_pwd,
            name=user_in.name,
            role=user_in.role or "Creator"
        )
        await user.insert()

        # Initialize user settings
        user_setting = Setting(user_id=str(user.id))
        await user_setting.insert()

        # Log audit
        audit = AuditLog(
            user_id=str(user.id),
            user_email=user.email,
            action="USER_SIGNUP",
            resource=f"User:{user.id}",
            details=f"User signed up with role '{user.role}'."
        )
        await audit.insert()

        access_token = create_access_token({"sub": str(user.id), "role": user.role})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user)
        )

    async def login(self, credentials: UserLogin) -> Token:
        try:
            user = await User.find_one({"email": credentials.email})
        except Exception:
            user = None

        if not user or not verify_password(credentials.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated"
            )

        audit = AuditLog(
            user_id=str(user.id),
            user_email=user.email,
            action="USER_LOGIN",
            resource=f"User:{user.id}",
            details="User logged in successfully."
        )
        await audit.insert()

        access_token = create_access_token({"sub": str(user.id), "role": user.role})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user)
        )

    async def refresh_tokens(self, refresh_token_str: str) -> Dict[str, str]:
        from jose import jwt, JWTError
        from app.config import settings
        try:
            payload = jwt.decode(refresh_token_str, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid refresh token")
            user = await User.get(user_id)
            if not user or not user.is_active:
                raise HTTPException(status_code=401, detail="User inactive or not found")

            new_access = create_access_token({"sub": str(user.id), "role": user.role})
            new_refresh = create_refresh_token({"sub": str(user.id)})
            return {
                "access_token": new_access,
                "refresh_token": new_refresh,
                "token_type": "bearer"
            }
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

auth_service = AuthService()
