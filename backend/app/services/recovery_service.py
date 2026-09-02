"""Startup recovery for jobs stuck in a non-terminal state.

Background tasks (transcription, key-moment/keyword generation) run inside the
process and do not survive a restart or a crash. If the process dies while a
job is mid-flight, the database rows are left in PROCESSING/PENDING forever.
On startup we claim any such stale rows and move them to a terminal FAILED
state so the UI never polls an in-flight job that can never finish.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.database import async_session
from app.models.key_moment import KeyMomentSet, KeyMomentSetStatus
from app.models.keyword import KeywordSet, KeywordSetStatus
from app.models.transcript import Transcript, TranscriptStatus
from app.models.video import UploadStatus, Video

STALE_PROCESSING_MESSAGE = "Processing was interrupted (service restarted)."


async def _fail_video(db: AsyncSession, video_id: uuid.UUID) -> None:
    video = await db.get(Video, video_id)
    if video is not None and video.upload_status in (
        UploadStatus.PROCESSING,
        UploadStatus.PENDING,
    ):
        video.upload_status = UploadStatus.FAILED


async def recover_stale_processing() -> int:
    """Mark stale in-flight jobs as FAILED. Returns the number of rows fixed."""
    fixed = 0

    async with async_session() as db:
        try:
            # 1) Transcripts stuck in PROCESSING (the primary job).
            transcripts = (
                (
                    await db.execute(
                        select(Transcript).where(
                            Transcript.status.in_(
                                [TranscriptStatus.PROCESSING, TranscriptStatus.PENDING]
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
            for transcript in transcripts:
                transcript.status = TranscriptStatus.FAILED
                transcript.error_message = STALE_PROCESSING_MESSAGE
                await _fail_video(db, transcript.video_id)
                fixed += 1

            # 2) Key-moment sets stuck in PROCESSING/PENDING.
            km_sets = (
                (
                    await db.execute(
                        select(KeyMomentSet).where(
                            KeyMomentSet.status.in_(
                                [
                                    KeyMomentSetStatus.PROCESSING,
                                    KeyMomentSetStatus.PENDING,
                                ]
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
            for km_set in km_sets:
                km_set.status = KeyMomentSetStatus.FAILED
                km_set.error = STALE_PROCESSING_MESSAGE
                await _fail_video(db, km_set.video_id)
                fixed += 1

            # 3) Keyword sets stuck in PROCESSING/PENDING.
            kw_sets = (
                (
                    await db.execute(
                        select(KeywordSet).where(
                            KeywordSet.status.in_(
                                [
                                    KeywordSetStatus.PROCESSING,
                                    KeywordSetStatus.PENDING,
                                ]
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
            for kw_set in kw_sets:
                kw_set.status = KeywordSetStatus.FAILED
                kw_set.error = STALE_PROCESSING_MESSAGE
                await _fail_video(db, kw_set.video_id)
                fixed += 1

            # 4) Videos still PROCESSING/PENDING with no transcript should also
            #    be failed (a video-level task died before creating a transcript).
            videos = (
                (
                    await db.execute(
                        select(Video).where(
                            Video.upload_status.in_(
                                [UploadStatus.PROCESSING, UploadStatus.PENDING]
                            )
                        )
                    )
                )
                .scalars()
                .all()
            )
            for video in videos:
                await _fail_video(db, video.id)
                fixed += 1

            await db.commit()
        except Exception:
            await db.rollback()
            logger.exception("Recovery of stale processing jobs failed")
            raise

    if fixed:
        logger.info("Recovery marked %d stale processing job(s) as failed", fixed)
    return fixed
