import asyncio
import os
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.whisper_service import transcribe_video
from app.auth.dependencies import get_current_user
from app.core.logging import logger
from app.database import async_session
from app.database.dependencies import get_db
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.models.video import UploadStatus
from app.schemas.video import VideoRead
from app.services.transcript_service import (
    create_transcript,
    get_transcript_by_video_id,
)
from app.services.video_processing import process_video
from app.services.video_service import (
    create_video,
    get_video_by_id,
    get_videos_by_user,
)

router = APIRouter(prefix="/videos", tags=["Videos"])

ALLOWED_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm"}
UPLOAD_DIR = "uploads/videos"
MAX_FILE_SIZE = 500 * 1024 * 1024


async def _mark_transcript_failed(db: AsyncSession, video_id: uuid.UUID) -> None:
    transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is None:
        await create_transcript(
            db=db,
            video_id=video_id,
            status=TranscriptStatus.FAILED,
        )
    else:
        transcript.status = TranscriptStatus.FAILED

    await db.commit()


async def _process_video_in_background(
    video_id: uuid.UUID,
    file_path: str,
    file_size: int,
) -> None:
    async with async_session() as db:
        try:
            video = await get_video_by_id(db, video_id)

            if video is None:
                logger.error(
                    "Video %s not found for background processing", video_id
                )
                return

            try:
                result = await asyncio.to_thread(process_video, file_path)
            except Exception:
                logger.exception(
                    "Video processing failed for video %s", video_id
                )
                video.upload_status = UploadStatus.FAILED
                await db.commit()
                return

            video.thumbnail_path = result["thumbnail_path"]
            video.duration = result["duration"]
            video.file_size = file_size
            video.upload_status = UploadStatus.READY
            await db.commit()

            try:
                transcription = await transcribe_video(file_path)

                transcript = await get_transcript_by_video_id(db, video_id)

                if transcript is None:
                    await create_transcript(
                        db=db,
                        video_id=video_id,
                        transcript=transcription.transcript,
                        language=transcription.language,
                        status=TranscriptStatus.COMPLETE,
                    )
                else:
                    transcript.transcript = transcription.transcript
                    transcript.language = transcription.language
                    transcript.status = TranscriptStatus.COMPLETE

                await db.commit()
                logger.info(
                    "Transcription completed for video %s", video_id
                )

            except Exception:
                logger.exception(
                    "Transcription failed for video %s", video_id
                )
                await db.rollback()
                await _mark_transcript_failed(db, video_id)

        except Exception:
            logger.exception(
                "Unexpected error during background processing of video %s",
                video_id,
            )


@router.get(
    "/",
    response_model=list[VideoRead],
)
async def list_videos(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    videos = await get_videos_by_user(db, current_user.id)
    return videos


@router.get(
    "/{video_id}",
    response_model=VideoRead,
)
async def get_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await get_video_by_id(db, video_id)

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    return video


@router.post(
    "/upload",
    response_model=VideoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_video(
    title: str = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: .{ext}",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    unique_filename = f"{uuid.uuid4()}.{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_filename)

    file_size = 0

    try:
        with open(dest, "wb") as buffer:
            while chunk := await file.read(64 * 1024):
                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    buffer.close()
                    os.remove(dest)

                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds maximum size of 500 MB",
                    )

                buffer.write(chunk)

        # Save video in DB
        video = await create_video(
            db=db,
            title=title,
            description=description,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=dest,
            uploaded_by=current_user.id,
        )

        await db.commit()
        await db.refresh(video)

        # Processing started
        video.upload_status = UploadStatus.PROCESSING
        await db.commit()
        await db.refresh(video)

        # Process & transcribe in background
        background_tasks.add_task(
            _process_video_in_background,
            video.id,
            dest,
            file_size,
        )

        return video

    except Exception:
        await db.rollback()

        if os.path.exists(dest):
            os.remove(dest)

        raise

    finally:
        await file.close()
