import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.summary import Summary, SummaryStatus, SummaryType


async def create_summary(
    db: AsyncSession,
    video_id: uuid.UUID,
    summary: str,
    summary_type: SummaryType,
    model_name: str | None = None,
    status: SummaryStatus = SummaryStatus.PENDING,
) -> Summary:
    summary_model = Summary(
        video_id=video_id,
        summary=summary,
        summary_type=summary_type,
        model_name=model_name,
        status=status,
    )

    db.add(summary_model)
    await db.flush()
    await db.refresh(summary_model)

    return summary_model


async def get_summary_by_id(
    db: AsyncSession,
    summary_id: uuid.UUID,
) -> Summary | None:
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id)
    )
    return result.scalar_one_or_none()


async def get_summaries_by_video_id(
    db: AsyncSession,
    video_id: uuid.UUID,
) -> list[Summary]:
    result = await db.execute(
        select(Summary).where(Summary.video_id == video_id)
    )
    return list(result.scalars().all())


async def get_summary_by_video_and_type(
    db: AsyncSession,
    video_id: uuid.UUID,
    summary_type: SummaryType,
) -> Summary | None:
    result = await db.execute(
        select(Summary).where(
            Summary.video_id == video_id,
            Summary.summary_type == summary_type,
        )
    )
    return result.scalar_one_or_none()


async def update_summary(
    db: AsyncSession,
    summary_id: uuid.UUID,
    *,
    summary: str | None = None,
    model_name: str | None = None,
    summary_type: SummaryType | None = None,
) -> Summary | None:
    summary_model = await get_summary_by_id(db, summary_id)

    if not summary_model:
        return None

    if summary is not None:
        summary_model.summary = summary

    if model_name is not None:
        summary_model.model_name = model_name

    if summary_type is not None:
        summary_model.summary_type = summary_type

    await db.flush()
    await db.refresh(summary_model)

    return summary_model


async def update_summary_status(
    db: AsyncSession,
    summary_id: uuid.UUID,
    status: SummaryStatus,
) -> Summary | None:
    summary_model = await get_summary_by_id(db, summary_id)

    if not summary_model:
        return None

    summary_model.status = status

    await db.flush()
    await db.refresh(summary_model)

    return summary_model


async def delete_summary(
    db: AsyncSession,
    summary_id: uuid.UUID,
) -> bool:
    summary_model = await get_summary_by_id(db, summary_id)

    if not summary_model:
        return False

    await db.delete(summary_model)

    return True
