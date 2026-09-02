"""One-off maintenance script: extract keywords for existing transcripts.

The background pipeline only generates keywords for uploads that complete
*before* this feature ships.  This script backfills those missing sets.
Idempotent: run_keyword_generation skips videos that already have a complete
or in-progress set, so it is safe to run any number of times.

Usage::

    python -m scripts.backfill_keywords
"""

import asyncio

from sqlalchemy import select

from app.core.logging import logger
from app.database import async_session
from app.models.transcript import Transcript, TranscriptStatus
from app.services.keyword_service import run_keyword_generation


async def main() -> None:
    async with async_session() as db:
        result = await db.execute(
            select(Transcript.video_id).where(
                Transcript.status == TranscriptStatus.COMPLETE,
            )
        )
        video_ids = [row[0] for row in result.all()]

    for index, video_id in enumerate(video_ids, start=1):
        logger.info("Backfilling keywords for video %s (%d/%d)", video_id, index, len(video_ids))
        await run_keyword_generation(video_id)

    logger.info("Backfill complete: %d videos processed", len(video_ids))


if __name__ == "__main__":
    asyncio.run(main())