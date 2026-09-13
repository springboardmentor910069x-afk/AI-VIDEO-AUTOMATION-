import os
import json
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_mongodb, close_mongodb
from app.middleware import RequestLoggingAndErrorMiddleware
from app.routers import (
    auth, videos, transcripts, summaries, key_moments, insights,
    sharing, websocket, search, analytics, learner, educator,
    bookmarks, admin, settings as settings_router, integrations
)

START_TIME = time.time()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — Database Initialization
    try:
        from app.database import init_postgres
        init_postgres()
    except Exception as e:
        print(f"[WARN] PostgreSQL table init warning: {e}")
    await init_mongodb()
    yield
    # Shutdown
    await close_mongodb()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="ClipMind AI — Video Summarization & Key Moments Detection Backend Platform",
    lifespan=lifespan
)

# Custom Request Logging & Standard Error Middleware
app.add_middleware(RequestLoggingAndErrorMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length", "Content-Type"],
)

# Mount uploads directory for videos, thumbnails, and exports (supports HTTP Range requests for video playback)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Core API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(videos.router, prefix=settings.API_V1_STR)
app.include_router(transcripts.router, prefix=settings.API_V1_STR)
app.include_router(summaries.router, prefix=settings.API_V1_STR)
app.include_router(key_moments.router, prefix=settings.API_V1_STR)
app.include_router(insights.router, prefix=settings.API_V1_STR)
app.include_router(sharing.router, prefix=settings.API_V1_STR)
app.include_router(search.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(learner.router, prefix=settings.API_V1_STR)
app.include_router(educator.router, prefix=settings.API_V1_STR)
app.include_router(bookmarks.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(settings_router.router, prefix=settings.API_V1_STR)
app.include_router(integrations.router, prefix=settings.API_V1_STR)
app.include_router(websocket.router)

# Public Sharing Route at root prefix
app.include_router(sharing.router)


@app.get("/")
def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs"
    }

@app.get("/health")
async def health_check():
    now_utc = datetime.now(timezone.utc).isoformat()
    uptime_sec = round(time.time() - START_TIME, 2)

    # 1. Database Health & Roundtrip Latency (Safe ping, no credentials exposed)
    db_status = "connected"
    db_latency_ms = None
    try:
        t0 = time.time()
        from app.database import mongodb_client, sql_engine
        if mongodb_client:
            await mongodb_client.admin.command('ping')
            db_latency_ms = round((time.time() - t0) * 1000, 2)
        elif sql_engine:
            with sql_engine.connect() as conn:
                pass
            db_status = "relational_active"
            db_latency_ms = round((time.time() - t0) * 1000, 2)
        else:
            db_status = "offline"
    except Exception:
        db_status = "relational_fallback"

    # 2. Storage Writability Health Check
    storage_status = "ready"
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        test_file = os.path.join(settings.UPLOAD_DIR, ".health_probe")
        with open(test_file, "w") as f:
            f.write("probe")
        if os.path.exists(test_file):
            os.remove(test_file)
    except Exception:
        storage_status = "read_only"

    # 3. System Metrics (Safe hardware utilization)
    system_metrics = {
        "cpu_usage_percent": 0.0,
        "memory_usage_percent": 0.0,
        "disk_free_gb": 0.0
    }
    try:
        import psutil
        system_metrics["cpu_usage_percent"] = psutil.cpu_percent(interval=None)
        system_metrics["memory_usage_percent"] = psutil.virtual_memory().percent
        system_metrics["disk_free_gb"] = round(psutil.disk_usage(settings.UPLOAD_DIR).free / (1024 ** 3), 2)
    except Exception:
        pass

    # 4. AI Engine Configuration Readiness
    llm_configured = bool(getattr(settings, "GROQ_API_KEY", "") or getattr(settings, "GROK_API_KEY", ""))

    overall_status = "healthy" if db_status in ("connected", "relational_active", "relational_fallback") and storage_status == "ready" else "degraded"

    return {
        "status": overall_status,
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": getattr(settings, "ENVIRONMENT", "production"),
        "timestamp": now_utc,
        "uptime_seconds": uptime_sec,
        "services": {
            "database": {
                "status": db_status,
                "latency_ms": db_latency_ms
            },
            "storage": {
                "status": storage_status,
                "writable": storage_status == "ready"
            },
            "ai_engine": {
                "status": "ready",
                "whisper_model": settings.WHISPER_MODEL,
                "llm_ready": llm_configured
            }
        },
        "system": system_metrics
    }
