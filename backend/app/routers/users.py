from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_role
from app.database.dependencies import get_db
from app.models.user import User, UserRole
from app.schemas.admin import UpdateRole, UserList

router = APIRouter(prefix="/users", tags=["Users"])


# -----------------------------
# Get all users (Admin only)
# -----------------------------
@router.get(
    "/",
    response_model=list[UserList],
)
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMINISTRATOR)
    ),
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return users


# -----------------------------
# Get one user
# -----------------------------
@router.get(
    "/{user_id}",
    response_model=UserList,
)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMINISTRATOR)
    ),
):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return user


# -----------------------------
# Update Role
# -----------------------------
@router.patch(
    "/{user_id}/role",
    response_model=UserList,
)
async def update_role(
    user_id: UUID,
    body: UpdateRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMINISTRATOR)
    ),
):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    user.role = body.role

    await db.flush()
    await db.refresh(user)

    return user


# -----------------------------
# Delete User
# -----------------------------
@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role(UserRole.ADMINISTRATOR)
    ),
):
    result = await db.execute(
        select(User).where(User.id == user_id)
    )

    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    await db.delete(user)
