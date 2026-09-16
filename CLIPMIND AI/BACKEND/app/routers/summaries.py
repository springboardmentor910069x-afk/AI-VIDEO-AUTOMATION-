from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel

from app.mongodb_models import Summary, Video, Transcript, User
from app.schemas import SummaryResponse, SummarySection, SummaryRegenerateRequest
from app.security import get_current_user_optional, get_current_user
from app.services.pipeline import summarize_video_transcript

router = APIRouter(prefix="/summaries", tags=["Summaries"])

@router.get("/{video_id}", response_model=SummaryResponse)
async def get_summary_by_video_id(
    video_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    summary = await Summary.find_one({"video_id": video_id})
    if not summary:
        video = await Video.get(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        return SummaryResponse(
            id=f"sum-{video_id}",
            video_id=video_id,
            depth="Detailed Breakdown",
            tldr="Summary is currently generating. Please check back shortly...",
            sections=[],
            key_takeaways=[],
            keywords=[],
            sentiment="educational",
            created_at=video.created_at
        )

    sections_list = []
    for s in summary.sections:
        sections_list.append(SummarySection(
            heading=str(s.get("heading", "Topic")),
            bullet_points=s.get("bullet_points") or s.get("points") or [],
            timestamp_range=s.get("timestamp_range") or s.get("timestamp") or "00:00 - 05:00"
        ))

    return SummaryResponse(
        id=str(summary.id),
        video_id=summary.video_id,
        depth=summary.depth,
        tldr=summary.tldr,
        sections=sections_list,
        key_takeaways=summary.key_takeaways,
        keywords=summary.keywords,
        sentiment=summary.sentiment,
        created_at=summary.created_at
    )

@router.post("/{video_id}/regenerate", response_model=SummaryResponse)
async def regenerate_summary(
    video_id: str,
    req: SummaryRegenerateRequest,
    current_user: User = Depends(get_current_user)
):
    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    sum_res = await summarize_video_transcript(
        video_id=video_id,
        depth=req.depth or "Detailed Breakdown",
        domain=req.domain or "Academic Lecture",
        video_title=video.title
    )

    summary = await Summary.find_one({"video_id": video_id})
    sections_list = [
        SummarySection(
            heading=str(s.get("heading", "Topic")),
            bullet_points=s.get("bullet_points") or s.get("points") or [],
            timestamp_range=s.get("timestamp_range") or "00:00 - 05:00"
        )
        for s in (summary.sections if summary else [])
    ]

    return SummaryResponse(
        id=str(summary.id) if summary else f"sum-{video_id}",
        video_id=video_id,
        depth=summary.depth if summary else req.depth,
        tldr=summary.tldr if summary else "",
        sections=sections_list,
        key_takeaways=summary.key_takeaways if summary else [],
        keywords=summary.keywords if summary else [],
        sentiment=summary.sentiment if summary else "educational",
        created_at=summary.created_at if summary else datetime.now(timezone.utc)
    )

@router.get("/{video_id}/mindmap")
async def get_video_mindmap(
    video_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Generates and returns an interactive, timestamped concept mind map for the video.
    """
    from app.mongodb_models import KeyMoment
    from app.services.mindmap_service import mindmap_service

    video = await Video.get(video_id)
    if not video:
        try:
            video = await Video.find_one({"_id": video_id})
        except Exception:
            pass
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    summary = await Summary.find_one({"video_id": video_id})
    key_moments = await KeyMoment.find({"video_id": video_id}).sort("timestamp").to_list()

    summary_sections = summary.sections if summary else []
    key_takeaways = summary.key_takeaways if summary else []
    moments_data = [
        {
            "timestamp": km.timestamp,
            "timestamp_str": km.timestamp_str,
            "title": km.title,
            "importance_score": km.importance_score
        }
        for km in key_moments
    ]

    mindmap = mindmap_service.build_mindmap(
        video_title=video.title,
        summary_sections=summary_sections,
        key_moments=moments_data,
        key_takeaways=key_takeaways
    )

    return {
        "success": True,
        "video_id": video_id,
        "title": video.title,
        "mindmap": mindmap
    }
