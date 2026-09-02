from contextlib import asynccontextmanager

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings
from app.core.logging import logger
from app.routers.api import api_router


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Apply baseline security headers to every response.

    nginx also adds these in production (frontend/nginx.conf); this ensures the
    backend is protected even when reached directly (e.g. local dev, or a
    client hitting :8000 without the reverse proxy).
    """

    _HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-XSS-Protection": "0",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Permissions-Policy": (
            "camera=(), geolocation=(), microphone=(), "
            "payment=(), usb=(), sync-xhr=()"
        ),
        # Strict-Transport-Security should only be enforced once the site is
        # served over HTTPS (nginx terminates TLS and adds this in production
        # too). Applied by default; safe for local dev because clients do not
        # attempt HSTS caching over plain HTTP.
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    }

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for name, value in self._HEADERS.items():
            response.headers.setdefault(name, value)
        return response


async def _stale_processing_watchdog(interval_seconds: int) -> None:
    """Periodically fail jobs that are stuck in a non-terminal state.

    Background tasks run inside the process. If a job crashes or is abandoned
    (e.g. an exception escapes a coroutine, or the process dies mid-flight), the
    DB row can be left in PROCESSING/PENDING forever. The startup recovery
    handles the restart case; this watchdog makes sure the app also heals itself
    while it is running, so the UI never polls a job that can never finish.
    """
    from app.services.recovery_service import recover_stale_processing

    while True:
        try:
            await asyncio.sleep(interval_seconds)
            await recover_stale_processing()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Stale-processing watchdog iteration failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.PROJECT_NAME, settings.VERSION)

    # Run the recovery once immediately, then repeatedly on an interval so
    # stale jobs reach a terminal FAILED state even without a restart.
    from app.services.recovery_service import recover_stale_processing

    try:
        await recover_stale_processing()
    except Exception:
        logger.exception("Failed to run startup processing recovery")

    watchdog_task = None
    try:
        watchdog_task = asyncio.create_task(
            _stale_processing_watchdog(settings.RECOVERY_INTERVAL_SECONDS)
        )
        yield
    finally:
        if watchdog_task is not None:
            watchdog_task.cancel()
            try:
                await watchdog_task
            except asyncio.CancelledError:
                pass
    logger.info("Shutting down %s", settings.PROJECT_NAME)


settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)
