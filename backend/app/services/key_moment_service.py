import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.key_moments_service import detect_key_moments
from app.core.logging import logger
from app.database import async_session
from app.models.key_moment import (
    KeyMoment,
    KeyMomentSet,
    KeyMomentSetStatus,
    KeyMomentType,
)
from app.models.transcript import TranscriptStatus
from app.services.transcript_service import get_transcript_by_video_id
from app.services.video_service import get_video_by_id

GENERIC_FAILURE_MESSAGE = "Key moment generation failed. Please try again."
KEY_MOMENTS_MODEL_NAME = "clipmind-key-moments-v1"


async def create_key_moment_set(
    db: AsyncSession,
    video_id: uuid.UUID,
    status: KeyMomentSetStatus = KeyMomentSetStatus.PENDING,
) -> KeyMomentSet:
    key_moment_set = KeyMomentSet(video_id=video_id, status=status)
    db.add(key_moment_set)
    await db.flush()
    await db.refresh(key_moment_set)
    return key_moment_set


async def get_key_moment_set_by_video(
    db: AsyncSession,
    video_id: uuid.UUID,
) -> KeyMomentSet | None:
    result = await db.execute(
        select(KeyMomentSet)
        .where(KeyMomentSet.video_id == video_id)
        .options(selectinload(KeyMomentSet.moments))
    )
    return result.scalar_one_or_none()


async def delete_key_moment_set_by_video(
    db: AsyncSession,
    video_id: uuid.UUID,
) -> bool:
    key_moment_set = await get_key_moment_set_by_video(db, video_id)
    if key_moment_set is None:
        return False
    await db.delete(key_moment_set)
    return True


async def persist_moments(
    db: AsyncSession,
    key_moment_set: KeyMomentSet,
    moments: list[dict],
) -> KeyMomentSet:
    await db.execute(
        delete(KeyMoment).where(KeyMoment.set_id == key_moment_set.id)
    )
    db.add_all(
        [
            KeyMoment(
                set_id=key_moment_set.id,
                start_time=moment["start_time"],
                end_time=moment["end_time"],
                title=moment["title"],
                description=moment["description"],
                type=KeyMomentType(moment["type"]),
                position=moment["position"],
            )
            for moment in moments
        ]
    )
    key_moment_set.status = KeyMomentSetStatus.COMPLETE
    key_moment_set.model_name = KEY_MOMENTS_MODEL_NAME
    key_moment_set.error = None
    await db.commit()
    await db.refresh(key_moment_set, attribute_names=["moments"])
    return key_moment_set


async def run_key_moment_generation(video_id: uuid.UUID) -> None:
    """Generate and persist key moments for a video in its own session.

    Idempotent: skips if a set already exists and is complete or already being
    processed. Runs in a background task so the page never blocks on it.
    """
    key_moment_set: KeyMomentSet | None = None
    async with async_session() as db:
        try:
            video = await get_video_by_id(db, video_id)
            if video is None:
                logger.warning("Video %s not found for key moments", video_id)
                return

            key_moment_set = await get_key_moment_set_by_video(db, video_id)
            if key_moment_set is None:
                key_moment_set = await create_key_moment_set(db, video_id)
                await db.commit()
            elif key_moment_set.status == KeyMomentSetStatus.COMPLETE:
                return
            elif key_moment_set.status == KeyMomentSetStatus.PROCESSING:
                return

            # Claim PENDING/FAILED sets so concurrent runs never double-generate.
            key_moment_set.status = KeyMomentSetStatus.PROCESSING
            key_moment_set.error = None
            await db.commit()

            transcript = await get_transcript_by_video_id(db, video_id)
            transcript_text = (transcript.transcript or "").strip() if transcript else ""

            if (
                transcript is None
                or transcript.status != TranscriptStatus.COMPLETE
                or not transcript_text
            ):
                logger.info(
                    "No complete transcript for video %s; recording empty key moments",
                    video_id,
                )
                await persist_moments(db, key_moment_set, [])
                return

            logger.info("Generating key moments for video %s", video_id)
            moments = await detect_key_moments(
                transcript_text,
                transcript.segments,
                video.duration,
            )
            await persist_moments(db, key_moment_set, moments)
            logger.info(
                "Key moments generated for video %s count=%d",
                video_id,
                len(moments),
            )

        except Exception:
            logger.exception("Key moment generation failed for video %s", video_id)
            try:
                if key_moment_set is not None:
                    key_moment_set.status = KeyMomentSetStatus.FAILED
                    key_moment_set.error = GENERIC_FAILURE_MESSAGE
                    await db.commit()
            except Exception:
                logger.exception(
                    "Could not mark key moments as failed for video %s",
                    video_id,
                )
