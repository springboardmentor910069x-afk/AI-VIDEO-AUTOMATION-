from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.mongodb_models import Transcript, Video, User
from app.schemas import TranscriptResponse, Segment, TranscriptSearchResponse, TranscriptSearchResult
from app.security import get_current_user_optional, get_current_user

router = APIRouter(prefix="/transcripts", tags=["Transcripts"])

class SegmentUpdateRequest(BaseModel):
    text: str
    speaker: Optional[str] = None

class TranscriptSearchQuery(BaseModel):
    query: str

@router.get("/{video_id}", response_model=TranscriptResponse)
async def get_transcript_by_video_id(
    video_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    transcript = await Transcript.find_one({"video_id": video_id})
    if not transcript:
        # Check if video exists
        video = await Video.get(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        # Return empty structured transcript while processing
        return TranscriptResponse(
            id=f"ts-{video_id}",
            video_id=video_id,
            language="en",
            duration_sec=video.duration_sec,
            word_count=0,
            segments=[],
            created_at=video.created_at
        )

    segments_list = []
    for s in transcript.segments:
        segments_list.append(Segment(
            id=str(s.get("id", "0")),
            start=float(s.get("start", 0.0)),
            end=float(s.get("end", 0.0)),
            text=str(s.get("text", "")),
            speaker=s.get("speaker") or "Speaker 1"
        ))

    return TranscriptResponse(
        id=str(transcript.id),
        video_id=transcript.video_id,
        language=transcript.language,
        duration_sec=transcript.duration_sec,
        word_count=transcript.word_count,
        segments=segments_list,
        created_at=transcript.created_at
    )

@router.put("/{video_id}/segments/{segment_id}")
async def update_transcript_segment(
    video_id: str,
    segment_id: str,
    req: SegmentUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    transcript = await Transcript.find_one({"video_id": video_id})
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")

    updated = False
    new_segments = []
    for s in transcript.segments:
        if str(s.get("id")) == str(segment_id):
            s["text"] = req.text
            if req.speaker:
                s["speaker"] = req.speaker
            updated = True
        new_segments.append(s)

    if not updated:
        raise HTTPException(status_code=404, detail="Segment not found")

    transcript.segments = new_segments
    transcript.updated_at = datetime.now(timezone.utc)
    await transcript.save()

    return {"success": True, "message": "Segment updated successfully"}

@router.post("/{video_id}/search", response_model=TranscriptSearchResponse)
async def search_transcript_segments(
    video_id: str,
    query_body: TranscriptSearchQuery,
    current_user: User = Depends(get_current_user_optional)
):
    transcript = await Transcript.find_one({"video_id": video_id})
    if not transcript:
        return TranscriptSearchResponse(query=query_body.query, matches=[], total_matches=0)

    q = query_body.query.lower().strip()
    matches = []
    for s in transcript.segments:
        text = str(s.get("text", ""))
        if q in text.lower():
            matches.append(TranscriptSearchResult(
                segment_id=str(s.get("id", "0")),
                timestamp_sec=int(float(s.get("start", 0.0))),
                timestamp_str=f"{int(float(s.get('start', 0.0)) // 60):02d}:{int(float(s.get('start', 0.0)) % 60):02d}",
                text=text,
                speaker=s.get("speaker") or "Speaker 1"
            ))

    return TranscriptSearchResponse(
        query=query_body.query,
        matches=matches,
        total_matches=len(matches)
    )
