import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transcript import Transcript, TranscriptStatus


async def create_transcript(
    db: AsyncSession,
    video_id: uuid.UUID,
    transcript: str | None = None,
    language: str | None = None,
    segments: list | None = None,
    status: TranscriptStatus = TranscriptStatus.PENDING,
) -> Transcript:
    transcript_model = Transcript(
        video_id=video_id,
        transcript=transcript,
        language=language,
        segments=segments,
        status=status,
    )

    db.add(transcript_model)
    await db.flush()
    await db.refresh(transcript_model)

    return transcript_model


async def get_transcript_by_video_id(
    db: AsyncSession,
    video_id: uuid.UUID, 
) -> Transcript | None:
    result = await db.execute(
        select(Transcript).where(Transcript.video_id == video_id)
    )
    return result.scalar_one_or_none()


async def get_transcript_by_id(
    db: AsyncSession,
    transcript_id: uuid.UUID,
) -> Transcript | None:
    result = await db.execute(
        select(Transcript).where(Transcript.id == transcript_id)
    )
    return result.scalar_one_or_none()


async def update_transcript(
    db: AsyncSession,
    transcript_id: uuid.UUID,
    *,
    transcript: str | None = None,
    language: str | None = None,
    segments: list | None = None,
) -> Transcript | None:
    transcript_model = await get_transcript_by_id(db, transcript_id)

    if not transcript_model:
        return None

    if transcript is not None:
        transcript_model.transcript = transcript

    if language is not None:
        transcript_model.language = language

    if segments is not None:
        transcript_model.segments = segments

    await db.flush()
    await db.refresh(transcript_model)

    return transcript_model


async def update_transcript_status(
    db: AsyncSession,
    transcript_id: uuid.UUID,
    status: TranscriptStatus,
) -> Transcript | None:
    transcript_model = await get_transcript_by_id(db, transcript_id)

    if not transcript_model:
        return None

    transcript_model.status = status

    await db.flush()
    await db.refresh(transcript_model)

    return transcript_model


async def delete_transcript(
    db: AsyncSession,
    transcript_id: uuid.UUID,
) -> bool:
    transcript_model = await get_transcript_by_id(db, transcript_id)

    if not transcript_model:
        return False

    await db.delete(transcript_model)

    return True
