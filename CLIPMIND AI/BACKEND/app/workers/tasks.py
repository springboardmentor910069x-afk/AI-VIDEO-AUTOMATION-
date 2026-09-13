import asyncio
import logging
from app.workers.celery_app import celery_app
from app.services.pipeline import (
    pipeline_orchestrator,
    transcribe_video_audio,
    summarize_video_transcript,
    detect_video_key_moments,
    extract_content_insights,
    finalize_video_delivery
)
from app.database import init_mongodb

logger = logging.getLogger("clipmind.workers.tasks")

def run_async(coro):
    """Helper to run async coroutine synchronously in Celery worker process."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Ensure MongoDB client initialized in worker process
    try:
        loop.run_until_complete(init_mongodb())
    except Exception:
        pass

    return loop.run_until_complete(coro)

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def process_video_task(self, video_id: str):
    """
    Celery task orchestrating the full 7-stage processing pipeline for a video.
    """
    logger.info(f"[Celery Worker] Starting pipeline for video_id={video_id}")
    try:
        result = run_async(pipeline_orchestrator.run_pipeline(video_id))
        return result
    except Exception as exc:
        logger.error(f"[Celery Worker] Error processing video {video_id}: {exc}", exc_info=True)
        # Retry on transient network/system errors
        raise self.retry(exc=exc, countdown=30)

@celery_app.task(bind=True, max_retries=2)
def transcribe_video_task(self, video_id: str, audio_path: str, video_title: str):
    """Stage 3 Celery Task"""
    try:
        return run_async(transcribe_video_audio(video_id, audio_path, video_title))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)

@celery_app.task(bind=True, max_retries=2)
def summarize_video_task(self, video_id: str, depth: str = "Detailed Breakdown", domain: str = "Academic Lecture", video_title: str = "Video"):
    """Stage 4 Celery Task"""
    try:
        return run_async(summarize_video_transcript(video_id, depth=depth, domain=domain, video_title=video_title))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)

@celery_app.task(bind=True, max_retries=2)
def detect_key_moments_task(self, video_id: str):
    """Stage 5 Celery Task"""
    try:
        return run_async(detect_video_key_moments(video_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)

@celery_app.task(bind=True, max_retries=2)
def extract_insights_task(self, video_id: str):
    """Stage 6 Celery Task"""
    try:
        return run_async(extract_content_insights(video_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)

@celery_app.task(bind=True, max_retries=2)
def finalize_delivery_task(self, video_id: str):
    """Stage 7 Celery Task"""
    try:
        return run_async(finalize_video_delivery(video_id))
    except Exception as exc:
        raise self.retry(exc=exc, countdown=20)
