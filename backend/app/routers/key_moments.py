import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.key_moment import KeyMomentSetStatus
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.schemas.key_moment import KeyMomentSetRead
from app.services.key_moment_service import (
    create_key_moment_set,
    get_key_moment_set_by_video,
    run_key_moment_generation,
)
from app.services.transcript_service import get_transcript_by_video_id
from app.services.video_service import get_video_by_id


router = APIRouter(
    prefix="/key-moments",
    tags=["Key moments"],
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
    response_model=KeyMomentSetRead,
)
async def get_video_key_moments(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_owned_video(db, video_id, current_user)

    key_moment_set = await get_key_moment_set_by_video(db, video_id)

    if key_moment_set is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Key moments not found",
        )

    return key_moment_set


@router.post(
    "/video/{video_id}",
    response_model=KeyMomentSetRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_video_key_moments(
    video_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await _get_owned_video(db, video_id, current_user)

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
            detail="A complete transcript is required before generating key moments",
        )

    key_moment_set = await get_key_moment_set_by_video(db, video_id)

    if key_moment_set is not None and key_moment_set.status in (
        KeyMomentSetStatus.COMPLETE,
        KeyMomentSetStatus.PROCESSING,
        KeyMomentSetStatus.PENDING,
    ):
        return key_moment_set

    if key_moment_set is None:
        key_moment_set = await create_key_moment_set(
            db,
            video_id,
            status=KeyMomentSetStatus.PENDING,
        )
    else:
        key_moment_set.status = KeyMomentSetStatus.PENDING
        key_moment_set.error = None

    await db.commit()

    background_tasks.add_task(run_key_moment_generation, video_id)

    key_moment_set = await get_key_moment_set_by_video(db, video_id)

    return key_moment_set
