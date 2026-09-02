import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.video import UploadStatus


class ProcessingCounts(BaseModel):
    pending: int = 0
    processing: int = 0
    ready: int = 0
    failed: int = 0


class SummaryTypeCounts(BaseModel):
    short: int = 0
    detailed: int = 0


class RecentVideo(BaseModel):
    id: uuid.UUID
    title: str
    status: UploadStatus
    duration: float | None = None
    file_size: int | None = None
    created_at: datetime


class RecentActivity(BaseModel):
    type: str
    video_id: uuid.UUID
    video_title: str
    status: str
    occurred_at: datetime


class AnalyticsDashboard(BaseModel):
    total_videos: int
    processed_videos: int
    total_transcripts: int
    total_summaries: int
    total_key_moments: int
    total_keywords: int
    processing: ProcessingCounts
    summary_types: SummaryTypeCounts
    failed_transcripts: int
    failed_summaries: int
    failed_key_moment_sets: int
    failed_keyword_sets: int
    recent_videos: list[RecentVideo]
    recent_activity: list[RecentActivity]