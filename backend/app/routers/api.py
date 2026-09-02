from fastapi import APIRouter

from app.routers import (
    analytics,
    auth,
    health,
    key_moments,
    keywords,
    media,
    summaries,
    transcripts,
    users,
    videos,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(videos.router)
api_router.include_router(summaries.router)
api_router.include_router(transcripts.router)
api_router.include_router(key_moments.router)
api_router.include_router(keywords.router)
api_router.include_router(analytics.router)
api_router.include_router(media.router)
