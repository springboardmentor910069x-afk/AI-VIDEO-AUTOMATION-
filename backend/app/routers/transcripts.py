import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.transcript import TranscriptRead
from app.services.transcript_service import (
    delete_transcript,
    get_transcript_by_id,
    get_transcript_by_video_id,
)

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
