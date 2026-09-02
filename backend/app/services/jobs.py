from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import VideoStatus
from app.models.video import Video
from app.services.document_store import save_video_documents
from app.services.insights import InsightService
from app.services.summarization import SummarizationService
from app.services.transcription import TranscriptionService


async def process_video(video_id: str, db: AsyncSession) -> None:
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if video is None:
        return
    try:
        video.status = VideoStatus.processing
        await db.commit()
        transcript = await TranscriptionService().transcribe(video.id, video.file_url, video.title)
        summary = await SummarizationService().summarize(video.id, transcript.full_text)
        insights = InsightService()
        key_moments = await insights.key_moments(transcript)
        analytics = await insights.analytics(transcript)
        save_video_documents(video.id, transcript, summary, key_moments, analytics)
        video.status = VideoStatus.completed
    except Exception:
        video.status = VideoStatus.failed
    await db.commit()
