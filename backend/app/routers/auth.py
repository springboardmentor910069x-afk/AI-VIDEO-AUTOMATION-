from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.auth import Token, TokenRefresh
from app.schemas.user import UserCreate, UserRead
from app.core.ratelimit import auth_ip_rate_limit, rate_limit_username, reset_username

router = APIRouter(prefix="/auth", tags=["Auth"])

# Login & register are rate-limited per source IP to blunt brute-force and
# credential-stuffing. Login additionally limits per-username (below).


# ---------------- REGISTER ----------------

@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_ip_rate_limit),
):
    existing = await db.execute(
        select(User).where(
            (User.email == body.email)
            | (User.username == body.username)
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already registered",
        )

    # SECURITY: publicly registered users are assigned the role supplied in the
    # request body, which is server-validated by UserCreate to a restricted set
    # (learner / educator / content_creator). Administrator is never accepted
    # through this endpoint.
    user = User(
        email=body.email,
        username=body.username,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
    )

    db.add(user)

    await db.flush()
    await db.refresh(user)

    return UserRead.model_validate(user)


# ---------------- LOGIN ----------------

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_ip_rate_limit),
):
    # Per-username throttle in addition to the per-IP throttle above.
    rate_limit_username(form_data.username)

    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )

    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(
            select(User).where(User.email == form_data.username)
        )
        user = result.scalar_one_or_none()

    if user is None or not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Successful auth: reset this user's throttled attempt window.
    reset_username(user.username)

    return {
        "access_token": create_access_token(
            str(user.id),
            user.role.value,
        ),
        "refresh_token": create_refresh_token(
            str(user.id),
            user.role.value,
        ),
        "token_type": "bearer",
    }


# ---------------- REFRESH ----------------

@router.post("/refresh", response_model=Token)
async def refresh_token(
    body: TokenRefresh,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(auth_ip_rate_limit),
):
    payload = decode_token(body.refresh_token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    user_id = payload.get("sub")

    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return {
        "access_token": create_access_token(
            str(user.id),
            user.role.value,
        ),
        "refresh_token": create_refresh_token(
            str(user.id),
            user.role.value,
        ),
        "token_type": "bearer",
    }


# ---------------- ME ----------------

@router.get("/me", response_model=UserRead)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
