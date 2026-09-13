import os

REDIS_BROKER_URL = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
REDIS_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://localhost:6379/0"))

try:
    from celery import Celery
    celery_app = Celery(
        "clipmind_workers",
        broker=REDIS_BROKER_URL,
        backend=REDIS_RESULT_BACKEND,
        include=["app.workers.tasks"]
    )

    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_time_limit=3600,  # 1 hour max per video pipeline task
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        broker_connection_retry_on_startup=True
    )
except ImportError:
    # Lightweight mock for environments without celery installed
    class DummyCeleryTask:
        def __init__(self, func):
            self.func = func
        def delay(self, *args, **kwargs):
            return None
        def __call__(self, *args, **kwargs):
            return self.func(*args, **kwargs)

    class DummyCeleryApp:
        def task(self, *args, **kwargs):
            def decorator(func):
                return DummyCeleryTask(func)
            return decorator

    celery_app = DummyCeleryApp()
