import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.whisper_service import WhisperServiceError, transcribe_video
from app.auth.dependencies import get_current_user
from app.core.logging import logger
from app.database.dependencies import get_db
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.schemas.transcript import TranscriptRead
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


@router.get(
    "/{transcript_id}",
    response_model=TranscriptRead,
)
async def get_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = await get_transcript_by_id(db, transcript_id)

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    return transcript


@router.get(
    "/video/{video_id}",
    response_model=TranscriptRead,
)
async def get_transcript_by_video(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    return transcript


@router.post(
    "/video/{video_id}",
    response_model=TranscriptRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_transcript(
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

    if not os.path.exists(video.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found on server",
        )

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
        transcript.status = TranscriptStatus.PROCESSING

    await db.commit()

    try:
        transcription = await transcribe_video(video.file_path)
    except WhisperServiceError as exc:
        logger.error("Transcript generation failed for video %s: %s", video_id, exc)
        transcript.status = TranscriptStatus.FAILED
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate transcript",
        ) from exc

    if not transcription.transcript:
        transcript.status = TranscriptStatus.FAILED
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcription produced an empty result",
        )

    transcript.transcript = transcription.transcript
    transcript.language = transcription.language
    transcript.status = TranscriptStatus.COMPLETE

    await db.commit()
    await db.refresh(transcript)

    return transcript


@router.delete(
    "/{transcript_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_transcript(
    transcript_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await delete_transcript(db, transcript_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    await db.commit()

    return None
