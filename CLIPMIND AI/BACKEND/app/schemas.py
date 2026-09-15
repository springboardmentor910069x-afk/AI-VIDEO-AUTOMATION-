from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class APIKeyCreate(BaseModel):
    name: str

class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: str
    status: Optional[str] = 'active'
    created_at: str
    last_used: str
    requests_count: Optional[int] = 0

class AuditLogResponse(BaseModel):
    id: str
    user_email: Optional[str]
    action: str
    resource: str
    details: Optional[str]
    ip_address: str
    status: str
    created_at: datetime

class Body_upload_video_api_v1_videos_upload_post(BaseModel):
    file: Optional[str] = None
    title: Optional[str] = None
    video_url: Optional[str] = None
    youtube_api_key: Optional[str] = None
    summary_depth: Optional[str] = 'Detailed Breakdown'
    domain: Optional[str] = None
    category: Optional[str] = None

class BookmarkCreate(BaseModel):
    video_id: str
    timestamp_sec: Optional[int] = 0
    timestamp_str: Optional[str] = '00:00'
    label: Optional[str] = 'Key Moment'
    note: Optional[str] = ''

class BookmarkResponse(BaseModel):
    id: str
    user_id: str
    video_id: str
    timestamp_sec: Optional[int] = 0
    timestamp_str: Optional[str] = '00:00'
    label: Optional[str] = 'Key Moment'
    note: Optional[str] = ''
    created_at: Optional[datetime] = None
    video_title: Optional[str] = None

class CreateKeyMomentRequest(BaseModel):
    timestamp: float
    timestamp_str: str
    title: str
    description: Optional[str] = ''
    importance_score: Optional[float] = 0.8
    category: Optional[str] = 'custom'

class CreateShareRequest(BaseModel):
    visibility: Optional[str] = 'public'
    shared_with: Optional[str] = None

class WordInfo(BaseModel):
    word: str
    start: float
    end: float
    conf: float

class Segment(BaseModel):
    id: int
    start: float
    end: float
    timestamp: str
    speaker: str
    text: str
    confidence: float
    words: Optional[List[WordInfo]] = None

class EducatorTranscriptUpdate(BaseModel):
    video_id: str
    segments: List[Segment]

class EvaluationRequest(BaseModel):
    reference_transcript: Optional[str] = None
    reference_summary: Optional[str] = None

class EvaluationResponse(BaseModel):
    video_id: str
    wer_metrics: Dict[str, Any]
    rouge_metrics: Dict[str, Any]
    performance: Dict[str, Any]

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = "google_oauth_token_client_auth"
    role: Optional[str] = "Creator"
    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    new_password: Optional[str] = None



class KeyMomentItem(BaseModel):
    id: str
    timestamp: str
    timeSeconds: int
    title: str
    importance: str
    summary: str
    thumbnailUrl: Optional[str] = None
    tags: List[str]

class KeyMomentsResponse(BaseModel):
    id: str
    video_id: str
    moments: List[KeyMomentItem]

class LearnerChatRequest(BaseModel):
    video_id: str
    question: str

class LearnerChatResponse(BaseModel):
    answer: str
    relevant_timestamp: Optional[str] = None
    relevant_seconds: Optional[int] = None
    context_snippet: Optional[str] = None

class StudySessionHeartbeatRequest(BaseModel):
    video_id: str
    seconds: int
    current_position_sec: Optional[int] = 0

class FlashcardMasteryRequest(BaseModel):
    video_id: str
    card_id: str
    status: str  # 'know' | 'review'

class QuizSubmissionRequest(BaseModel):
    video_id: str
    score: int
    total: int
    answers: Optional[List[Any]] = None

class LearnerDashboardResponse(BaseModel):
    total_study_minutes: int
    lectures_studied: int
    total_lectures: int
    flashcards_mastered: int
    flashcards_total: int
    flashcard_mastery_pct: int
    quizzes_taken: int
    quiz_accuracy_pct: int
    streak_days: int
    today_study_minutes: int
    recent_lectures: List[Dict[str, Any]] = []
    recent_notes: List[Dict[str, Any]] = []
    milestones: List[Dict[str, Any]] = []

class SegmentUpdateRequest(BaseModel):
    text: str
    speaker: Optional[str] = None

class SettingSchema(BaseModel):
    whisper_model: Optional[str] = 'medium.en'
    summary_length: Optional[str] = 'detailed'
    default_export_format: Optional[str] = 'PDF'
    theme: Optional[str] = 'dark'
    email_notifications: Optional[bool] = True
    auto_indexing: Optional[bool] = True

class SpeakerRenameRequest(BaseModel):
    video_id: str
    old_speaker: str
    new_speaker: str

class SummaryRegenerateRequest(BaseModel):
    video_id: str
    depth: Optional[str] = 'Detailed Breakdown'
    focus_prompt: Optional[str] = None

class SummarySection(BaseModel):
    id: Optional[str] = "sec-1"
    title: str = "Overview"
    timeRange: Optional[str] = "00:00 - 00:00"
    summary: Optional[str] = ""
    bulletPoints: Optional[List[str]] = Field(default_factory=list)
    keyEquations: Optional[List[str]] = None

class SummaryResponse(BaseModel):
    id: str
    video_id: str
    depth: str
    tldr: str
    sections: List[SummarySection]
    key_takeaways: List[str]
    keywords: List[str]
    sentiment: str
    created_at: Optional[datetime] = None

class SystemHealthResponse(BaseModel):
    uptime_hours: float
    active_workers: int
    queue_depth: int
    avg_wer: float
    gpu_memory_used_gb: float
    storage_used_gb: float
    storage_total_gb: float
    total_videos_processed: int

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    is_active: Optional[bool] = True
    is_verified: Optional[bool] = True
    verification_status: Optional[str] = "verified"
    avatar_url: Optional[str] = None
    created_at: datetime

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Optional[str] = 'bearer'
    user: UserResponse

class TranscriptResponse(BaseModel):
    id: str
    video_id: str
    language: str
    duration_sec: int
    word_count: int
    segments: List[Segment]
    created_at: Optional[datetime] = None

class TranscriptSearchQuery(BaseModel):
    query: str

class TranscriptSearchResult(BaseModel):
    segment_id: int
    timestamp: str
    start: float
    end: float
    speaker: str
    text: str
    match_snippet: str

class TranscriptSearchResponse(BaseModel):
    video_id: str
    query: str
    total_matches: int
    matches: List[TranscriptSearchResult]

class UserLogin(BaseModel):
    email: str
    password: str

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: Optional[str] = 'Creator'

class VideoResponse(BaseModel):
    id: str
    user_id: Optional[str] = 'demo-user'
    title: str
    filename: Optional[str] = ''
    duration_sec: Optional[int] = 0
    file_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    thumbnail_url: Optional[str] = None
    keyframes: Optional[List[object]] = None
    file_size_mb: Optional[float] = 0.0
    status: Optional[str] = 'completed'
    processing_stage: Optional[str] = None
    processing_progress: Optional[float] = 100.0
    wer_accuracy: Optional[float] = 96.0
    word_count: Optional[int] = 0
    category: Optional[str] = 'Academic'
    summary_depth: Optional[str] = 'Detailed Breakdown'
    domain: Optional[str] = 'Academic Lecture'
    views_count: Optional[int] = 0
    language: Optional[str] = 'en'
    created_at: Optional[datetime] = None
    stage: Optional[str] = None
    progress: Optional[float] = None
    size_bytes: Optional[int] = 0

class YouTubeImportRequest(BaseModel):
    youtube_url: str
    summary_depth: Optional[str] = 'Detailed Breakdown'
    domain: Optional[str] = 'General'
