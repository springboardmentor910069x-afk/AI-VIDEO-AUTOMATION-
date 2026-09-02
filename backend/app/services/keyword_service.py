import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.keyword_service import DEFAULT_KEYWORD_LIMIT, extract_keywords
from app.core.logging import logger
from app.database import async_session
from app.models.keyword import Keyword, KeywordSet, KeywordSetStatus
from app.models.transcript import TranscriptStatus
from app.services.transcript_service import get_transcript_by_video_id
from app.services.video_service import get_video_by_id

GENERIC_FAILURE_MESSAGE = "Keyword extraction failed. Please try again."
KEYWORDS_MODEL_NAME = "clipmind-keywords-tfidf-v1"


async def create_keyword_set(
    db: AsyncSession,
    video_id: uuid.UUID,
    status: KeywordSetStatus = KeywordSetStatus.PENDING,
) -> KeywordSet:
    keyword_set = KeywordSet(video_id=video_id, status=status)
    db.add(keyword_set)
    await db.flush()
    await db.refresh(keyword_set)
    return keyword_set


async def get_keyword_set_by_video(
    db: AsyncSession,
    video_id: uuid.UUID,
) -> KeywordSet | None:
    result = await db.execute(
        select(KeywordSet)
        .where(KeywordSet.video_id == video_id)
        .options(selectinload(KeywordSet.keywords))
    )
    return result.scalar_one_or_none()


async def delete_keyword_set_by_video(
    db: AsyncSession,
    video_id: uuid.UUID,
) -> bool:
    keyword_set = await get_keyword_set_by_video(db, video_id)
    if keyword_set is None:
        return False
    await db.delete(keyword_set)
    return True


async def persist_keywords(
    db: AsyncSession,
    keyword_set: KeywordSet,
    keywords: list[dict],
) -> KeywordSet:
    await db.execute(
        delete(Keyword).where(Keyword.set_id == keyword_set.id)
    )
    db.add_all(
        [
            Keyword(
                set_id=keyword_set.id,
                keyword=keyword["keyword"],
                score=keyword["score"],
                position=position,
            )
            for position, keyword in enumerate(keywords)
        ]
    )
    keyword_set.status = KeywordSetStatus.COMPLETE
    keyword_set.model_name = KEYWORDS_MODEL_NAME
    keyword_set.error = None
    await db.commit()
    await db.refresh(keyword_set, attribute_names=["keywords"])
    return keyword_set


async def run_keyword_generation(
    video_id: uuid.UUID,
    limit: int = DEFAULT_KEYWORD_LIMIT,
) -> None:
    """Extract and persist keywords for a video in its own session.

    Idempotent: skips if a set already exists and is complete or already being
    processed. Runs in its own background session so the event loop never
    blocks on the (fast, local) extraction.
    """
    keyword_set: KeywordSet | None = None
    async with async_session() as db:
        try:
            video = await get_video_by_id(db, video_id)
            if video is None:
                logger.warning("Video %s not found for keywords", video_id)
                return

            keyword_set = await get_keyword_set_by_video(db, video_id)
            if keyword_set is None:
                keyword_set = await create_keyword_set(db, video_id)
                await db.commit()
            elif keyword_set.status == KeywordSetStatus.COMPLETE:
                return
            elif keyword_set.status == KeywordSetStatus.PROCESSING:
                return

            # Claim PENDING/FAILED sets so concurrent runs never double-run.
            keyword_set.status = KeywordSetStatus.PROCESSING
            keyword_set.error = None
            await db.commit()

            transcript = await get_transcript_by_video_id(db, video_id)
            transcript_text = (transcript.transcript or "").strip() if transcript else ""

            if (
                transcript is None
                or transcript.status != TranscriptStatus.COMPLETE
                or not transcript_text
            ):
                logger.info(
                    "No complete transcript for video %s; recording empty keywords",
                    video_id,
                )
                await persist_keywords(db, keyword_set, [])
                return

            logger.info("Extracting keywords for video %s", video_id)
            keywords = extract_keywords(transcript_text, limit=limit)
            await persist_keywords(db, keyword_set, keywords)
            logger.info(
                "Keywords extracted for video %s count=%d",
                video_id,
                len(keywords),
            )

        except Exception:
            logger.exception("Keyword extraction failed for video %s", video_id)
            try:
                if keyword_set is not None:
                    keyword_set.status = KeywordSetStatus.FAILED
                    keyword_set.error = GENERIC_FAILURE_MESSAGE
                    await db.commit()
            except Exception:
                logger.exception(
                    "Could not mark keywords as failed for video %s",
                    video_id,
                )