from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import create_token
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair
from app.schemas.user import UserRead
from app.services.mongo_users import EmailAlreadyRegisteredError, MongoUser, authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest) -> MongoUser:
    try:
        return await create_user(payload)
    except EmailAlreadyRegisteredError as exc:
        raise HTTPException(status_code=409, detail="Email already registered")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"MongoDB error: {exc}") from exc


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest) -> TokenPair:
    try:
        user = await authenticate_user(payload.email, payload.password)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="MongoDB connection failed. Check MONGODB_URL and Atlas Network Access.") from exc
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    settings = get_settings()
    return TokenPair(
        access_token=create_token(user.id, user.role.value),
        refresh_token=create_token(user.id, user.role.value, days=settings.refresh_token_expire_days, token_type="refresh"),
    )


@router.get("/me", response_model=UserRead)
async def me(user: MongoUser = Depends(get_current_user)) -> MongoUser:
    return user
