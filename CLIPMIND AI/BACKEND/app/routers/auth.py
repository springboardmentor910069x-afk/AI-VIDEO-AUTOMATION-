from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.mongodb_models import User as MongoUser, UserRole
from app.schemas import UserRegister, UserLogin, GoogleAuthRequest, Token, UserResponse
from app.security import (
    verify_password, get_password_hash, create_access_token,
    create_refresh_token, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


async def ensure_beanie_initialized():
    try:
        MongoUser.get_settings()
    except Exception:
        from app.database import init_mongodb
        await init_mongodb()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_user(req: UserRegister):
    await ensure_beanie_initialized()
    existing = await MongoUser.find_one({"email": req.email.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Email is already registered")

    if req.role and req.role.strip().lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts cannot be created from public registration. Please contact system administration."
        )

    # All registering users (Learner, Creator, Educator) are activated immediately
    role_val = UserRole.LEARNER
    if req.role:
        for r in UserRole:
            if r.value.lower() == req.role.lower() and r != UserRole.ADMIN:
                role_val = r
                break

    user = MongoUser(
        email=req.email.lower().strip(),
        name=req.name.strip() or req.email.split("@")[0].capitalize(),
        hashed_password=get_password_hash(req.password),
        role=role_val,
        is_active=True,
        is_verified=True,
        verification_status="verified"
    )
    await user.insert()

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": user.role.value})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    user_resp = UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        verification_status=user.verification_status,
        created_at=user.created_at
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_resp
    )


@router.post("/login", response_model=Token)
async def login_user(req: UserLogin):
    await ensure_beanie_initialized()
    email = req.email.lower().strip()
    user = await MongoUser.find_one({"email": email})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact an administrator."
        )

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": getattr(user.role, "value", user.role)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    user_resp = UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=getattr(user.role, "value", user.role),
        is_active=user.is_active,
        is_verified=getattr(user, "is_verified", True),
        verification_status=getattr(user, "verification_status", "verified"),
        created_at=user.created_at
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_resp
    )


@router.post("/google", response_model=Token)
async def google_login(req: GoogleAuthRequest):
    await ensure_beanie_initialized()
    extracted_email = (req.email or "").strip().lower()
    extracted_name = (req.name or "").strip()
    extracted_avatar = req.avatar_url

    # If a real Google Identity Services JWT was provided, decode and verify with Google
    if req.credential and "." in req.credential and req.credential != "google_oauth_token_client_auth":
        try:
            import urllib.request, json
            verify_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
            v_req = urllib.request.Request(verify_url, headers={"User-Agent": "ClipMind-Auth/2.0"})
            with urllib.request.urlopen(v_req, timeout=5) as resp:
                if resp.status == 200:
                    token_data = json.loads(resp.read().decode("utf-8"))
                    if "email" in token_data:
                        extracted_email = token_data["email"].strip().lower()
                    if "name" in token_data and not extracted_name:
                        extracted_name = token_data["name"].strip()
                    if "picture" in token_data and not extracted_avatar:
                        extracted_avatar = token_data["picture"].strip()
        except Exception:
            # Fallback to base64url payload extraction
            try:
                import base64, json
                parts = req.credential.split(".")
                if len(parts) >= 2:
                    padding = "=" * (4 - len(parts[1]) % 4)
                    payload_bytes = base64.urlsafe_b64decode(parts[1] + padding)
                    payload = json.loads(payload_bytes.decode("utf-8"))
                    if "email" in payload and not extracted_email:
                        extracted_email = payload["email"].strip().lower()
                    if "name" in payload and not extracted_name:
                        extracted_name = payload["name"].strip()
                    if "picture" in payload and not extracted_avatar:
                        extracted_avatar = payload["picture"].strip()
            except Exception:
                pass

    if not extracted_email:
        raise HTTPException(
            status_code=400,
            detail="Google account email could not be verified. Please enter your Google email address or authenticate with password."
        )

    email = extracted_email
    user = await MongoUser.find_one({"email": email})
    if not user:
        role_val = UserRole.LEARNER
        if req.role:
            for r in UserRole:
                if r.value.lower() == req.role.lower() and r != UserRole.ADMIN:
                    role_val = r
                    break
        user = MongoUser(
            email=email,
            name=extracted_name or email.split("@")[0].capitalize(),
            hashed_password=get_password_hash(f"google_oauth_{email}"),
            role=role_val,
            avatar_url=extracted_avatar,
            is_active=True,
            is_verified=True,
            verification_status="verified"
        )
        await user.insert()
    else:
        # Update user name or avatar if provided from Google profile
        updated = False
        if extracted_name and (not user.name or user.name == user.email.split("@")[0]):
            user.name = extracted_name
            updated = True
        if extracted_avatar and not user.avatar_url:
            user.avatar_url = extracted_avatar
            updated = True
        if updated:
            await user.save()

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email, "role": getattr(user.role, "value", user.role)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    user_resp = UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=getattr(user.role, "value", user.role),
        is_active=user.is_active,
        is_verified=getattr(user, "is_verified", True),
        verification_status=getattr(user, "verification_status", "verified"),
        created_at=user.created_at
    )
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user_resp
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: MongoUser = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=getattr(current_user.role, "value", current_user.role),
        is_active=current_user.is_active,
        is_verified=getattr(current_user, "is_verified", True),
        verification_status=getattr(current_user, "verification_status", "verified"),
        created_at=current_user.created_at
    )
