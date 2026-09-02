from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.db.mongo import get_mongo
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.enums import UserRole
from app.models.video import Video
from app.services.mongo_users import AUDIT_COLLECTION, USERS_COLLECTION, MongoUser, list_users, update_user_role

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/metrics")
async def metrics(_: MongoUser = Depends(require_roles(UserRole.admin)), db: AsyncSession = Depends(get_db)) -> dict[str, int]:
    mongo = get_mongo()
    users = mongo[USERS_COLLECTION].count_documents({})
    mongo_logs = mongo[AUDIT_COLLECTION].count_documents({})
    videos = await db.scalar(select(func.count()).select_from(Video))
    sql_logs = await db.scalar(select(func.count()).select_from(AuditLog))
    logs = mongo_logs + (sql_logs or 0)
    return {"users": users or 0, "videos": videos or 0, "audit_logs": logs or 0}


@router.get("/users")
async def users(_: MongoUser = Depends(require_roles(UserRole.admin))) -> list[dict[str, str]]:
    return [user.to_public_dict() for user in await list_users()]


class RoleUpdateRequest(BaseModel):
    role: UserRole


@router.patch("/users/{user_id}/role")
async def update_role(
    user_id: str,
    payload: RoleUpdateRequest,
    _: MongoUser = Depends(require_roles(UserRole.admin)),
) -> dict[str, str]:
    user = await update_user_role(user_id, payload.role)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_public_dict()
