import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from app.mongodb_models import Video, Summary, KeyMoment, Transcript, Share, User
from app.security import get_current_user_optional
from app.services.downloader import video_downloader
from app.services.pipeline import process_video_pipeline

router = APIRouter(prefix="/integrations", tags=["Integrations"])

class YouTubeImportRequest(BaseModel):
    youtube_url: str
    summary_depth: Optional[str] = "Detailed Breakdown"
    domain: Optional[str] = "General"

class ShareRequest(BaseModel):
    visibility: Optional[str] = "public"
    shared_with: Optional[str] = None

@router.post("/youtube/import")
async def import_youtube_video(
    req: YouTubeImportRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Imports and standardizes a video from YouTube / web URL with deduplication constraint.
    """
    user_id = str(getattr(current_user, "id", "demo-creator"))
    from app.services.video_service import video_service
    video = await video_service.save_uploaded_file(
        file=None,
        video_url=req.youtube_url,
        title=None,
        summary_depth=req.summary_depth or "Detailed Breakdown",
        domain=req.domain or "General",
        category="Web Stream",
        user_id=user_id,
        background_tasks=background_tasks
    )

    return {
        "success": True,
        "video_id": str(video.id),
        "title": video.title,
        "status": video.status,
        "message": "Video retrieved from cache" if video.status == "completed" else "Video successfully enqueued for transcription and summarization"
    }

@router.get("/browser-extension/quick-summary/{video_id}")
async def get_browser_extension_quick_summary(video_id: str):
    """
    Fast, lightweight summary endpoint designed for Browser Extension popups.
    """
    try:
        from beanie import PydanticObjectId
        video = await Video.get(PydanticObjectId(video_id))
    except Exception:
        video = await Video.find_one(Video.id == video_id)
        
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    summary = await Summary.find_one(Summary.video_id == str(video.id))
    key_moments = await KeyMoment.find(KeyMoment.video_id == str(video.id)).sort("timestamp").to_list()
    
    return {
        "videoId": str(video.id),
        "title": video.title,
        "durationSec": video.duration_sec,
        "tldr": summary.tldr if summary else "Summary is currently generating...",
        "keyTakeaways": summary.key_takeaways if summary else [],
        "keyMoments": [
            {
                "timestamp": km.timestamp_str,
                "title": km.title,
                "importance": km.importance_score
            }
            for km in key_moments
        ]
    }
