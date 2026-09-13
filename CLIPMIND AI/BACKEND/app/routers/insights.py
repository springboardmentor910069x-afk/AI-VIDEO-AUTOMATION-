from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.mongodb_models import ContentInsight, Video, Summary, User
from app.security import get_current_user_optional
from app.services.pipeline import extract_content_insights

router = APIRouter(prefix="/insights", tags=["Content Insights"])

@router.get("/{video_id}")
async def get_video_content_insights(
    video_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    ci = await ContentInsight.find_one({"video_id": video_id})
    if not ci:
        # Extract or construct default insights
        summary = await Summary.find_one({"video_id": video_id})
        sum_dict = {
            "keywords": summary.keywords if summary else [],
            "sections": summary.sections if summary else [],
            "sentiment": summary.sentiment if summary else "educational",
            "key_takeaways": summary.key_takeaways if summary else []
        }
        res = await extract_content_insights(video_id, sum_dict)
        return {
            "videoId": video_id,
            "keywords": res["keywords"],
            "topics": res["topics"],
            "sentiment": res["sentiment"],
            "namedEntities": res["named_entities"]
        }

    return {
        "videoId": ci.video_id,
        "keywords": ci.keywords,
        "topics": ci.topics,
        "sentiment": ci.sentiment,
        "namedEntities": ci.named_entities,
        "createdAt": ci.created_at
    }
