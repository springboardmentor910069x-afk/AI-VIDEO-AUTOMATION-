from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.mongodb_models import KeyMoment, Video, User
from app.schemas import KeyMomentsResponse, KeyMomentItem
from app.security import get_current_user_optional, get_current_user

router = APIRouter(prefix="/key-moments", tags=["Key Moments"])

class CreateKeyMomentRequest(BaseModel):
    timestamp: float
    timestamp_str: str
    title: str
    description: Optional[str] = ""
    importance_score: Optional[float] = 0.8
    category: Optional[str] = "custom"

@router.get("/{video_id}", response_model=KeyMomentsResponse)
async def get_key_moments_by_video_id(
    video_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    moments = await KeyMoment.find({"video_id": video_id}).sort("timestamp").to_list()
    items = []
    for km in moments:
        items.append(KeyMomentItem(
            id=str(km.id),
            timestamp_sec=int(km.timestamp),
            timestamp_str=km.timestamp_str,
            label=km.title,
            title=km.title,
            summary=km.description,
            importance="High" if km.importance_score >= 0.8 else "Medium",
            importance_score=km.importance_score,
            topic=km.category,
            category=km.category,
            timeSeconds=km.timestamp
        ))

    return KeyMomentsResponse(
        id=f"km-{video_id}",
        video_id=video_id,
        moments=items,
        created_at=video.created_at
    )

@router.post("/{video_id}", response_model=KeyMomentItem, status_code=status.HTTP_201_CREATED)
async def add_custom_key_moment(
    video_id: str,
    req: CreateKeyMomentRequest,
    current_user: User = Depends(get_current_user)
):
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    km = KeyMoment(
        video_id=video_id,
        timestamp=req.timestamp,
        timestamp_str=req.timestamp_str,
        title=req.title,
        description=req.description or "",
        importance_score=req.importance_score or 0.8,
        category=req.category or "custom"
    )
    await km.insert()

    return KeyMomentItem(
        id=str(km.id),
        timestamp_sec=int(km.timestamp),
        timestamp_str=km.timestamp_str,
        label=km.title,
        title=km.title,
        summary=km.description,
        importance="High" if km.importance_score >= 0.8 else "Medium",
        importance_score=km.importance_score,
        topic=km.category,
        category=km.category,
        timeSeconds=km.timestamp
    )
