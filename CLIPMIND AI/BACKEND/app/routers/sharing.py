import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.mongodb_models import Share, Video, Summary, KeyMoment, Transcript, User
from app.security import get_current_user, get_current_user_optional

router = APIRouter(tags=["Sharing"])

class CreateShareRequest(BaseModel):
    visibility: Optional[str] = "public"
    shared_with: Optional[str] = None

@router.post("/videos/{video_id}/share")
async def create_video_share_link(
    video_id: str,
    req: CreateShareRequest,
    current_user: User = Depends(get_current_user)
):
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    share_token = f"cm_share_{uuid.uuid4().hex[:12]}"
    share = Share(
        video_id=video_id,
        shared_by=str(current_user.id),
        shared_with=req.shared_with,
        share_token=share_token,
        visibility=req.visibility or "public"
    )
    await share.insert()

    return {
        "success": True,
        "share_token": share_token,
        "share_url": f"/share/{share_token}",
        "visibility": share.visibility,
        "created_at": share.created_at
    }

@router.get("/share/{share_token}")
async def get_public_shared_video(share_token: str):
    """
    Public access endpoint for shared video content (no authentication required).
    """
    share = await Share.find_one({"share_token": share_token})
    if not share:
        raise HTTPException(status_code=404, detail="Shared link is invalid or expired")

    video = await Video.get(share.video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video no longer exists")

    summary = await Summary.find_one({"video_id": share.video_id})
    transcript = await Transcript.find_one({"video_id": share.video_id})
    key_moments = await KeyMoment.find({"video_id": share.video_id}).sort("timestamp").to_list()

    return {
        "video": {
            "id": str(video.id),
            "title": video.title,
            "duration_sec": video.duration_sec,
            "thumbnail_url": video.thumbnail_url,
            "category": video.category,
            "created_at": video.created_at
        },
        "summary": {
            "tldr": summary.tldr if summary else "",
            "sections": summary.sections if summary else [],
            "key_takeaways": summary.key_takeaways if summary else [],
            "keywords": summary.keywords if summary else []
        },
        "key_moments": [
            {
                "timestamp": km.timestamp_str,
                "title": km.title,
                "description": km.description,
                "importance": km.importance_score
            }
            for km in key_moments
        ],
        "transcript": {
            "language": transcript.language if transcript else "en",
            "segments": transcript.segments if transcript else []
        }
    }
