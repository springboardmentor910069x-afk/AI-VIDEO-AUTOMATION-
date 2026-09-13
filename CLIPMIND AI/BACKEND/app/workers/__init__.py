"""
ClipMind AI — Celery Worker & Background Tasks Package
"""
from .celery_app import celery_app
from .tasks import process_video_task

__all__ = ["celery_app", "process_video_task"]
