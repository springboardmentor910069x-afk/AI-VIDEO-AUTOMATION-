from fastapi import APIRouter

from app.routers import auth, health, users, videos, summaries, transcripts

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(videos.router)
api_router.include_router(summaries.router)
api_router.include_router(transcripts.router)
