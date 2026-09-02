import asyncio
import os
import time
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

from app.ai.whisper_service import (
    TranscriptQualityError,
    WhisperServiceError,
    transcribe_video,
)
from app.auth.dependencies import get_current_user
from app.core.logging import logger
from app.database import async_session
from app.database.dependencies import get_db
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.models.video import UploadStatus
from app.schemas.video import VideoRead
from app.services.key_moment_service import run_key_moment_generation
from app.services.keyword_service import run_keyword_generation
from app.services.transcript_service import (
    create_transcript,
    get_transcript_by_video_id,
)
from app.services.video_processing import process_video
from app.services.video_service import (
    create_video,
    delete_video,
    get_video_by_id,
    get_videos_by_user,
)

router = APIRouter(prefix="/videos", tags=["Videos"])

ALLOWED_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm"}
UPLOAD_DIR = "uploads/videos"
MAX_FILE_SIZE = 500 * 1024 * 1024


async def _mark_transcript_failed(
    db: AsyncSession,
    video_id: uuid.UUID,
    error_message: str | None = None,
) -> None:
    transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is None:
        await create_transcript(
            db=db,
            video_id=video_id,
            status=TranscriptStatus.FAILED,
        )
        transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is not None:
        transcript.status = TranscriptStatus.FAILED
        transcript.error_message = error_message

    await db.commit()


async def _process_video_in_background(
    video_id: uuid.UUID,
    file_path: str,
    file_size: int,
) -> None:
    total_start = time.monotonic()
    async with async_session() as db:
        try:
            video = await get_video_by_id(db, video_id)

            if video is None:
                logger.error(
                    "[BG] Video %s not found for background processing",
                    video_id,
                )
                return

            logger.info(
                "[BG] Processing started: id=%s file_path=%s "
                "file_size=%.1fMB",
                video_id,
                file_path,
                file_size / (1024 * 1024),
            )

            # ------------------------------------------------
            # Stage 1: Video processing (thumbnail + duration)
            # ------------------------------------------------

            video.upload_status = UploadStatus.PROCESSING
            await db.commit()

            try:
                result = await asyncio.to_thread(process_video, file_path)
            except Exception as exc:
                logger.error(
                    "[BG] Video processing failed for video %s: %s",
                    video_id,
                    str(exc),
                    exc_info=True,
                )
                video.upload_status = UploadStatus.FAILED
                transcript = await get_transcript_by_video_id(db, video_id)
                if transcript is not None and transcript.status in (
                    TranscriptStatus.PENDING,
                    TranscriptStatus.PROCESSING,
                ):
                    transcript.status = TranscriptStatus.FAILED
                    transcript.error_message = f"Video processing failed: {exc}"
                await db.commit()
                return

            video.thumbnail_path = result["thumbnail_path"]
            video.duration = result["duration"]
            video.file_size = file_size
            await db.commit()

            logger.info(
                "[BG] Video processing completed: id=%s "
                "duration=%.1fs",
                video_id,
                video.duration or 0,
            )

            # ------------------------------------------------
            # Stage 2: Transcription
            #
            # Create transcript record BEFORE starting
            # transcription so the frontend can poll it
            # immediately instead of getting a 404.
            # This fixes the race condition where the UI
            # initially shows an error then shows results
            # after page reload.
            # ------------------------------------------------

            transcript = await get_transcript_by_video_id(db, video_id)

            if transcript is None:
                transcript = await create_transcript(
                    db=db,
                    video_id=video_id,
                    status=TranscriptStatus.PROCESSING,
                )
            else:
                transcript.transcript = None
                transcript.language = None
                transcript.segments = None
                transcript.error_message = None
                transcript.status = TranscriptStatus.PROCESSING

            await db.commit()
            await db.refresh(transcript)

            logger.info(
                "[BG] Transcript record created/updated: "
                "video_id=%s transcript_id=%s status=processing",
                video_id,
                transcript.id,
            )

            try:
                transcription = await transcribe_video(file_path)

                transcript.transcript = transcription.transcript
                transcript.language = transcription.language
                transcript.segments = transcription.segments
                transcript.status = TranscriptStatus.COMPLETE

                await db.commit()
                await db.refresh(transcript)

                logger.info(
                    "[BG] Transcription completed: "
                    "video_id=%s language=%s "
                    "transcript_length=%d",
                    video_id,
                    transcription.language,
                    len(transcription.transcript),
                )

            except TranscriptQualityError as exc:
                error_msg = f"Transcript quality check failed: {exc}"
                logger.warning(
                    "[BG] Transcript quality check failed "
                    "for video %s: %s",
                    video_id,
                    str(exc),
                )
                await db.rollback()
                await _mark_transcript_failed(db, video_id, error_msg)
                video.upload_status = UploadStatus.FAILED
                await db.commit()
                return

            except WhisperServiceError as exc:
                error_msg = f"Transcription failed: {exc}"
                logger.error(
                    "[BG] Transcription failed for video %s: %s",
                    video_id,
                    str(exc),
                    exc_info=True,
                )
                await db.rollback()
                await _mark_transcript_failed(db, video_id, error_msg)
                video.upload_status = UploadStatus.FAILED
                await db.commit()
                return

            except Exception as exc:
                error_msg = f"Unexpected transcription error: {exc}"
                logger.error(
                    "[BG] Unexpected transcription error for video %s: %s",
                    video_id,
                    str(exc),
                    exc_info=True,
                )
                await db.rollback()
                await _mark_transcript_failed(db, video_id, error_msg)
                video.upload_status = UploadStatus.FAILED
                await db.commit()
                return

            # ------------------------------------------------
            # Stage 3: Mark video ready
            #
            # NOW the transcript is complete, so mark the
            # video as ready.  This prevents the frontend
            # from seeing "ready" before the transcript
            # exists.
            # ------------------------------------------------

            video.upload_status = UploadStatus.READY
            await db.commit()

            logger.info(
                "[BG] Video marked as ready: id=%s",
                video_id,
            )

            # ------------------------------------------------
            # Stage 4: Key moments (background, best effort)
            # ------------------------------------------------

            try:
                await run_key_moment_generation(video_id)
            except Exception as exc:
                # Non-fatal: the transcript & video are already complete.
                logger.error(
                    "[BG] Key-moment generation failed for video %s (non-fatal): %s",
                    video_id,
                    exc,
                    exc_info=True,
                )

            # ------------------------------------------------
            # Stage 5: Keywords (background, best effort)
            #
            # Lightweight local TF-IDF extraction over the stored
            # transcript; idempotent and safe to run repeatedly.
            # ------------------------------------------------

            try:
                await run_keyword_generation(video_id)
            except Exception as exc:
                # Non-fatal: the transcript & video are already complete.
                logger.error(
                    "[BG] Keyword generation failed for video %s (non-fatal): %s",
                    video_id,
                    exc,
                    exc_info=True,
                )

            total_elapsed = time.monotonic() - total_start
            logger.info(
                "[BG] All processing completed for video %s "
                "in %.2fs (total)",
                video_id,
                total_elapsed,
            )

        except Exception as exc:
            logger.error(
                "[BG] Unexpected error during background "
                "processing of video %s: %s",
                video_id,
                str(exc),
                exc_info=True,
            )
            try:
                video.upload_status = UploadStatus.FAILED
                # Ensure the transcript also reaches a terminal FAILED state so
                # the frontend never polls it indefinitely.
                transcript = await get_transcript_by_video_id(db, video_id)
                if transcript is not None and transcript.status in (
                    TranscriptStatus.PENDING,
                    TranscriptStatus.PROCESSING,
                ):
                    transcript.status = TranscriptStatus.FAILED
                    transcript.error_message = (
                        f"Processing was interrupted: {exc}"
                    )
                await db.commit()
            except Exception:
                logger.error(
                    "[BG] Failed to mark video %s as FAILED",
                    video_id,
                    exc_info=True,
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

        # Processing started — the frontend polls this status
        video.upload_status = UploadStatus.PROCESSING
        await db.commit()
        await db.refresh(video)

        logger.info(
            "[UPLOAD] Video uploaded: id=%s title=%s "
            "filename=%s size=%.1fMB",
            video.id,
            title,
            file.filename,
            file_size / (1024 * 1024),
        )

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


@router.delete(
    "/{video_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_video(
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

    # Remove physical media files (best effort — never block deletion on them).
    for path in (video.file_path, video.thumbnail_path):
        if not path:
            continue
        try:
            if os.path.exists(path):
                os.remove(path)
        except OSError:
            logger.warning("Could not remove media file: %s", path)

    deleted = await delete_video(db, video_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    return None
