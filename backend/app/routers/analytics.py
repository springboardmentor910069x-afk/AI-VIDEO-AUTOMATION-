from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsDashboard
from app.services.analytics_service import get_analytics_dashboard

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


@router.get(
    "/dashboard",
    response_model=AnalyticsDashboard,
)
async def analytics_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_analytics_dashboard(db, current_user)