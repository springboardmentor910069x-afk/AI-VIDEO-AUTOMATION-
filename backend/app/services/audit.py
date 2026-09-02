from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def write_audit_log(db: AsyncSession, user_id: str | None, action: str, resource: str) -> None:
    db.add(AuditLog(user_id=user_id, action=action, resource=resource))
    await db.commit()

