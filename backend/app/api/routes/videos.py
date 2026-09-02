from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import AsyncSessionLocal, get_db
from app.models.enums import UserRole, VideoStatus
from app.models.user import User
from app.models.video import Video
from app.schemas.video import JobStatus, VideoRead
from app.services.audit import write_audit_log
from app.services.document_store import delete_video_documents, save_video_metadata
from app.schemas.ai import VideoMetadata
from app.services.jobs import process_video
from app.services.storage import save_upload, save_video_link, validate_video
from app.services.video_processing import extract_duration_seconds

router = APIRouter(prefix="/videos", tags=["videos"])


async def run_processing(video_id: str) -> None:
    async with AsyncSessionLocal() as db:
        await process_video(video_id, db)


@router.post("", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def upload_video(
    background_tasks: BackgroundTasks,
    title: str = Form(..., min_length=2, max_length=255),
    file: UploadFile | None = File(None),
    video_url: str | None = Form(None),
    user: User = Depends(require_roles(UserRole.creator, UserRole.educator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> Video:
    try:
        has_file = file is not None and bool(file.filename)
        clean_video_url = video_url.strip() if video_url else ""
        if has_file and clean_video_url:
            raise ValueError("File ya video link me se ek hi submit karo.")
        if has_file and file is not None:
            validate_video(file)
            path, size = await save_upload(file)
            mime_type = file.content_type or "application/octet-stream"
            metadata = VideoMetadata(title=title, platform="upload")
        elif clean_video_url:
            path, size, mime_type, metadata = await save_video_link(clean_video_url)
        else:
            raise ValueError("Video file upload karo ya video link paste karo.")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    video = Video(
        user_id=user.id,
        title=title,
        file_url=path,
        duration=extract_duration_seconds(path),
        size_bytes=size,
        mime_type=mime_type,
        status=VideoStatus.queued,
    )
    db.add(video)
    await db.commit()
    await db.refresh(video)
    save_video_metadata(video.id, metadata.model_copy(update={"title": metadata.title or title}))
    await write_audit_log(db, user.id, "upload_video", video.id)
    background_tasks.add_task(run_processing, video.id)
    return video


@router.get("", response_model=list[VideoRead])
async def list_videos(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[Video]:
    statement = select(Video)
    if user.role == UserRole.learner:
        statement = statement.where(Video.status == VideoStatus.completed)
    elif user.role != UserRole.admin:
        statement = statement.where(Video.user_id == user.id)
    result = await db.execute(statement.order_by(Video.uploaded_at.desc()))
    return list(result.scalars().all())


@router.get("/{video_id}", response_model=VideoRead)
async def get_video(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Video:
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    can_view = (
        video is not None
        and (
            user.role == UserRole.admin
            or video.user_id == user.id
            or (user.role == UserRole.learner and video.status == VideoStatus.completed)
        )
    )
    if not can_view:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@router.get("/{video_id}/status", response_model=JobStatus)
async def status_video(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> JobStatus:
    video = await get_video(video_id, user, db)
    return JobStatus(video_id=video.id, status=video.status, message=f"Video is {video.status.value}")


@router.post("/{video_id}/reprocess", response_model=JobStatus)
async def reprocess_video(
    video_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_roles(UserRole.creator, UserRole.educator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> JobStatus:
    video = await get_video(video_id, user, db)
    video.status = VideoStatus.queued
    await db.commit()
    await write_audit_log(db, user.id, "reprocess_video", video.id)
    background_tasks.add_task(run_processing, video.id)
    return JobStatus(video_id=video.id, status=video.status, message="Video reprocessing queued")


@router.delete("/{video_id}", response_model=JobStatus)
async def delete_video(
    video_id: str,
    user: User = Depends(require_roles(UserRole.creator, UserRole.educator, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> JobStatus:
    video = await get_video(video_id, user, db)
    file_path = Path(video.file_url)
    await db.delete(video)
    await db.commit()
    file_path.unlink(missing_ok=True)
    delete_video_documents(video_id)
    await write_audit_log(db, user.id, "delete_video", video_id)
    return JobStatus(video_id=video_id, status=VideoStatus.failed, message="Video deleted")
