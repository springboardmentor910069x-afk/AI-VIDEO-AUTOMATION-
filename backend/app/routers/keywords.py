import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.keyword_service import DEFAULT_KEYWORD_LIMIT, extract_keywords
from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.keyword import KeywordSetStatus
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.schemas.keyword import KeywordSetRead
from app.services.keyword_service import (
    create_keyword_set,
    get_keyword_set_by_video,
    persist_keywords,
)
from app.services.transcript_service import get_transcript_by_video_id
from app.services.video_service import get_video_by_id


router = APIRouter(
    prefix="/keywords",
    tags=["Keywords"],
)


async def _get_owned_video(db: AsyncSession, video_id: uuid.UUID, user: User):
    video = await get_video_by_id(db, video_id)

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if video.uploaded_by != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    return video


@router.get(
    "/video/{video_id}",
    response_model=KeywordSetRead,
)
async def get_video_keywords(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_video(db, video_id, current_user)

    keyword_set = await get_keyword_set_by_video(db, video_id)

    if keyword_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Keywords not found",
        )

    return keyword_set


@router.post(
    "/video/{video_id}",
    response_model=KeywordSetRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_video_keywords(
    video_id: uuid.UUID,
    limit: int = Query(
        default=DEFAULT_KEYWORD_LIMIT,
        ge=1,
        le=50,
        description="Maximum number of keywords to return",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_video(db, video_id, current_user)

    transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    if transcript.status != TranscriptStatus.COMPLETE or not (
        transcript.transcript or ""
    ).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A complete transcript is required before extracting keywords",
        )

    keyword_set = await get_keyword_set_by_video(db, video_id)

    if keyword_set is not None and keyword_set.status in (
        KeywordSetStatus.COMPLETE,
        KeywordSetStatus.PROCESSING,
        KeywordSetStatus.PENDING,
    ):
        return keyword_set

    if keyword_set is None:
        keyword_set = await create_keyword_set(
            db,
            video_id,
            status=KeywordSetStatus.PENDING,
        )
    else:
        keyword_set.status = KeywordSetStatus.PENDING
        keyword_set.error = None

    await db.commit()

    keywords = extract_keywords(transcript.transcript, limit=limit)
    keyword_set = await persist_keywords(db, keyword_set, keywords)

    return keyword_set