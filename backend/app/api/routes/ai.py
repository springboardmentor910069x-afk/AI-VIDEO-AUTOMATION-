from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.routes.videos import get_video
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai import AnalyticsRead, KeyMoment, SummaryRead, SummaryTranslateRequest, TranscriptRead, TutorChatRequest, TutorChatResponse
from app.services.document_store import get_analytics, get_key_moments, get_summary, get_transcript, get_video_metadata
from app.services.summarization import SummarizationService
from app.services.tutor import TutorService

router = APIRouter(prefix="/videos/{video_id}", tags=["ai"])
tutor_service = TutorService()
summarization_service = SummarizationService()


@router.get("/transcript", response_model=TranscriptRead)
async def transcript(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> TranscriptRead:
    await get_video(video_id, user, db)
    item = get_transcript(video_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Transcript is not ready")
    return item


@router.get("/summary", response_model=SummaryRead)
async def summary(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SummaryRead:
    video = await get_video(video_id, user, db)
    item = get_summary(video_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Summary is not ready")
    return item


@router.post("/summary/translate", response_model=SummaryRead)
async def translate_summary(
    video_id: str,
    payload: SummaryTranslateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SummaryRead:
    await get_video(video_id, user, db)
    item = get_summary(video_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Summary is not ready")
    return await summarization_service.translate_summary(item, payload.language)


@router.get("/key-moments", response_model=list[KeyMoment])
async def key_moments(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[KeyMoment]:
    await get_video(video_id, user, db)
    return get_key_moments(video_id)


@router.get("/analytics", response_model=AnalyticsRead)
async def analytics(video_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> AnalyticsRead:
    await get_video(video_id, user, db)
    item = get_analytics(video_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Analytics are not ready")
    return item


@router.post("/tutor", response_model=TutorChatResponse)
async def tutor_chat(
    video_id: str,
    payload: TutorChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TutorChatResponse:
    await get_video(video_id, user, db)
    question = payload.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")
    transcript = get_transcript(video_id)
    summary = get_summary(video_id)
    if transcript is None and summary is None:
        raise HTTPException(status_code=404, detail="Tutor needs the transcript or summary first")
    return await tutor_service.answer(
        video_id=video_id,
        question=question,
        transcript=transcript,
        summary=summary,
        metadata=get_video_metadata(video_id),
        chat_history=payload.chat_history,
    )
