import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.video import UploadStatus, Video


async def create_video(
    db: AsyncSession,
    title: str,
    description: str | None,
    filename: str,
    original_filename: str,
    file_path: str,
    uploaded_by: uuid.UUID,
) -> Video:
    video = Video(
        title=title,
        description=description,
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        uploaded_by=uploaded_by,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    return video


async def get_video_by_id(db: AsyncSession, video_id: uuid.UUID) -> Video | None:
    result = await db.execute(select(Video).where(Video.id == video_id))
    return result.scalar_one_or_none()


async def get_all_videos(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> list[Video]:
    result = await db.execute(select(Video).offset(skip).limit(limit))
    return result.scalars().all()


async def get_videos_by_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[Video]:
    result = await db.execute(
        select(Video)
        .where(Video.uploaded_by == user_id)
        .order_by(Video.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def delete_video(db: AsyncSession, video_id: uuid.UUID) -> bool:
    video = await get_video_by_id(db, video_id)
    if not video:
        return False
    await db.delete(video)
    await db.commit()
    return True


async def update_video_status(
    db: AsyncSession,
    video_id: uuid.UUID,
    status: UploadStatus,
) -> Video | None:
    video = await get_video_by_id(db, video_id)
    if not video:
        return None
    video.upload_status = status
    await db.commit()
    await db.refresh(video)
    return video


async def update_video_fields(
    db: AsyncSession,
    video_id: uuid.UUID,
    *,
    thumbnail_path: str | None = None,
    duration: float | None = None,
    file_size: int | None = None,
    upload_status: UploadStatus | None = None,
) -> Video | None:
    video = await get_video_by_id(db, video_id)
    if not video:
        return None
    if thumbnail_path is not None:
        video.thumbnail_path = thumbnail_path
    if duration is not None:
        video.duration = duration
    if file_size is not None:
        video.file_size = file_size
    if upload_status is not None:
        video.upload_status = upload_status
    await db.commit()
    await db.refresh(video)
    return video
