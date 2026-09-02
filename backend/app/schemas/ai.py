from datetime import datetime

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptRead(BaseModel):
    video_id: str
    full_text: str
    segments: list[TranscriptSegment]
    language: str = "en"


class SummaryRead(BaseModel):
    video_id: str
    short_summary: str
    detailed_summary: str
    generated_at: datetime


class VideoMetadata(BaseModel):
    """Trusted metadata obtained from the uploaded video or its source page."""

    source_url: str | None = None
    platform: str | None = None
    channel_name: str | None = None
    channel_url: str | None = None
    uploader: str | None = None
    artist: str | None = None
    track: str | None = None
    title: str | None = None
    description: str | None = None
    webpage_url: str | None = None


class SummaryTranslateRequest(BaseModel):
    language: str


class KeyMoment(BaseModel):
    video_id: str
    timestamp: float
    title: str
    importance_score: float
    thumbnail_url: str | None = None


class AnalyticsRead(BaseModel):
    video_id: str
    watch_time: float
    engagement_score: float
    topics: list[str]
    sentiment: str


class TutorChatRequest(BaseModel):
    question: str
    chat_history: list[dict[str, str]] = []


class TutorChatResponse(BaseModel):
    video_id: str
    answer: str
    detected_language: str
    provider_used: str
    citations: list[str] = []
