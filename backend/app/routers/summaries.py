import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.summarization_service import (
    SummarizationError,
    generate_summary,
)
from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.summary import SummaryStatus, SummaryType
from app.models.user import User
from app.schemas.summary import SummaryRead
from app.services.summary_service import (
    create_summary,
    delete_summary,
    get_summaries_by_video_id,
    get_summary_by_id,
)
from app.services.transcript_service import get_transcript_by_video_id
from app.services.video_service import get_video_by_id


router = APIRouter(
    prefix="/summaries",
    tags=["Summaries"],
)


@router.post(
    "/video/{video_id}",
    response_model=SummaryRead,
    status_code=status.HTTP_201_CREATED,
)
async def generate_video_summary(
    video_id: uuid.UUID,
    summary_type: SummaryType = SummaryType.SHORT,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Check video exists
    video = await get_video_by_id(db, video_id)

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # 2. Check video belongs to current user
    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    # 3. Get transcript
    transcript = await get_transcript_by_video_id(db, video_id)

    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transcript not found",
        )

    if not transcript.transcript:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript is empty",
        )

    # 4. Generate summary using Groq
    try:
        result = await generate_summary(
            transcript.transcript,
            summary_type,
        )
    except SummarizationError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    # 5. Save summary in database
    summary = await create_summary(
        db=db,
        video_id=video_id,
        summary=result.summary,
        summary_type=summary_type,
        model_name=result.model_name,
        status=SummaryStatus.COMPLETE,
    )

    await db.commit()
    await db.refresh(summary)

    return summary


@router.get(
    "/{summary_id}",
    response_model=SummaryRead,
)
async def get_summary(
    summary_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = await get_summary_by_id(db, summary_id)

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found",
        )

    video = await get_video_by_id(db, summary.video_id)

    if video is None or video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this summary",
        )

    return summary


@router.get(
    "/video/{video_id}",
    response_model=list[SummaryRead],
)
async def get_video_summaries(
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

    summaries = await get_summaries_by_video_id(db, video_id)

    return summaries


@router.delete(
    "/{summary_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_summary(
    summary_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summary = await get_summary_by_id(db, summary_id)

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found",
        )

    video = await get_video_by_id(db, summary.video_id)

    if video is None or video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this summary",
        )

    deleted = await delete_summary(db, summary_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found",
        )

    await db.commit()