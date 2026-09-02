import os
import time
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.whisper_service import (
    TranscriptQualityError,
    WhisperServiceError,
    _clean_hallucination_loops,
    _compute_unique_word_ratio,
    transcribe_video,
)
from app.auth.dependencies import get_current_user
from app.core.logging import logger
from app.database.dependencies import get_db
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.schemas.transcript import TranscriptRead
from app.services.key_moment_service import (
    delete_key_moment_set_by_video,
    run_key_moment_generation,
)
from app.services.keyword_service import (
    delete_keyword_set_by_video,
    run_keyword_generation,
)
from app.services.transcript_service import (
    create_transcript,
    delete_transcript,
    get_transcript_by_id,
    get_transcript_by_video_id,
)
from app.services.video_service import get_video_by_id


router = APIRouter(
    prefix="/transcripts",
    tags=["Transcripts"],
)


# ============================================================
# GET TRANSCRIPT BY ID
# ============================================================

@router.get(
    "/{transcript_id}",
    response_model=TranscriptRead,
)
async def get_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = await get_transcript_by_id(
        db,
        transcript_id,
    )

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    # Check video ownership
    video = await get_video_by_id(
        db,
        transcript.video_id,
    )

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this transcript",
        )

    return transcript


# ============================================================
# GET TRANSCRIPT BY VIDEO ID
# ============================================================

@router.get(
    "/video/{video_id}",
    response_model=TranscriptRead,
)
async def get_transcript_by_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # First check video
    video = await get_video_by_id(
        db,
        video_id,
    )

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Ownership check
    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    transcript = await get_transcript_by_video_id(
        db,
        video_id,
    )

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    return transcript


# ============================================================
# GENERATE TRANSCRIPT
# ============================================================

@router.post(
    "/video/{video_id}",
    response_model=TranscriptRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_transcript(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_start = time.monotonic()

    # --------------------------------------------------------
    # 1. Get video
    # --------------------------------------------------------

    video = await get_video_by_id(
        db,
        video_id,
    )

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # --------------------------------------------------------
    # 2. Check ownership
    # --------------------------------------------------------

    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    # --------------------------------------------------------
    # 3. Check physical video file
    # --------------------------------------------------------

    if not video.file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file path is missing",
        )

    if not os.path.exists(video.file_path):
        logger.error(
            "[TRANSCRIPT] Video file does not exist: %s",
            video.file_path,
        )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found on server",
        )

    # --------------------------------------------------------
    # 4. Get existing transcript
    # --------------------------------------------------------

    transcript = await get_transcript_by_video_id(
        db,
        video_id,
    )

    # --------------------------------------------------------
    # 5. Create or reset transcript
    # --------------------------------------------------------

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
        # Key moments derive from the transcript; drop the stale set so it
        # gets regenerated from the new transcription.
        await delete_key_moment_set_by_video(db, video_id)
        # Keywords derive from the transcript too; dropping them keeps the
        # stored extraction in sync with the new transcription.
        await delete_keyword_set_by_video(db, video_id)

    await db.commit()
    await db.refresh(transcript)

    logger.info(
        "[TRANSCRIPT] Starting transcription: "
        "video=%s file=%s",
        video_id,
        video.file_path,
    )

    # --------------------------------------------------------
    # 6. Run Whisper
    # --------------------------------------------------------

    try:
        transcription = await transcribe_video(
            video.file_path,
        )

    except TranscriptQualityError as exc:
        error_msg = f"Quality check failed: {exc}"
        logger.warning(
            "[TRANSCRIPT] Quality check failed for "
            "video=%s: %s",
            video_id,
            str(exc),
        )

        transcript.status = TranscriptStatus.FAILED
        transcript.error_message = error_msg

        await db.commit()
        await db.refresh(transcript)

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except WhisperServiceError as exc:
        error_msg = f"Whisper transcription failed: {exc}"
        logger.error(
            "[TRANSCRIPT] Whisper transcription failed "
            "for video=%s: %s",
            video_id,
            str(exc),
            exc_info=True,
        )

        transcript.status = TranscriptStatus.FAILED
        transcript.error_message = error_msg

        await db.commit()
        await db.refresh(transcript)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcript generation failed: {exc}",
        ) from exc

    except Exception as exc:
        error_msg = f"Unexpected error: {exc}"
        logger.error(
            "[TRANSCRIPT] Unexpected transcription error "
            "for video=%s: %s",
            video_id,
            str(exc),
            exc_info=True,
        )

        transcript.status = TranscriptStatus.FAILED
        transcript.error_message = error_msg

        await db.commit()
        await db.refresh(transcript)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected transcription error: {exc}",
        ) from exc

    # --------------------------------------------------------
    # 7. Validate result
    # --------------------------------------------------------

    if not transcription.transcript:
        transcript.status = TranscriptStatus.FAILED

        await db.commit()
        await db.refresh(transcript)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Whisper returned an empty transcript",
        )

    # --------------------------------------------------------
    # 8. Clean and save transcript
    # --------------------------------------------------------

    cleaned_text = _clean_hallucination_loops(
        transcription.transcript,
    )

    cleaned_segments = transcription.segments or []

    logger.info(
        "[TRANSCRIPT] Cleaning applied for video=%s",
        video_id,
    )

    transcript.transcript = cleaned_text
    transcript.language = transcription.language
    transcript.segments = cleaned_segments
    transcript.status = TranscriptStatus.COMPLETE

    await db.commit()
    await db.refresh(transcript)

    total_elapsed = time.monotonic() - total_start
    unique_ratio = _compute_unique_word_ratio(cleaned_text)
    logger.info(
        "[TRANSCRIPT] Generation completed: "
        "video=%s language=%s "
        "transcript_length=%d "
        "unique_word_ratio=%.3f "
        "total_duration=%.2fs",
        video_id,
        transcription.language,
        len(cleaned_text),
        unique_ratio,
        total_elapsed,
    )

    background_tasks.add_task(run_key_moment_generation, video_id)
    background_tasks.add_task(run_keyword_generation, video_id)

    return transcript


# ============================================================
# DELETE TRANSCRIPT
# ============================================================

@router.delete(
    "/{transcript_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = await get_transcript_by_id(
        db,
        transcript_id,
    )

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    # Check video ownership
    video = await get_video_by_id(
        db,
        transcript.video_id,
    )

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this transcript",
        )

    deleted = await delete_transcript(
        db,
        transcript_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    # Key moments are derived from the transcript — remove them alongside it.
    await delete_key_moment_set_by_video(db, video.id)

    # Keywords are derived from the transcript — remove them alongside it.
    await delete_keyword_set_by_video(db, video.id)

    await db.commit()

    return None
