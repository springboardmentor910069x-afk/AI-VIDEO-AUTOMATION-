from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class UserRole(str, Enum):
    CREATOR = "Creator"
    LEARNER = "Learner"
    EDUCATOR = "Educator"
    ADMIN = "Admin"


class VideoStatus(str, Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class User(Document):
    email: Indexed(str, unique=True)
    name: str
    hashed_password: str
    role: UserRole = UserRole.CREATOR
    plan: Optional[str] = None
    is_active: bool = True
    is_verified: bool = True
    verification_status: str = "verified"
    avatar_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [
            "email",
            "role",
            "created_at"
        ]


class APIKey(Document):
    user_id: str
    name: str
    key_hash: str
    key_prefix: Optional[str] = None
    is_active: bool = True
    last_used: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def prefix(self) -> str:
        return self.key_prefix or (self.key_hash[:12] if self.key_hash else "cm_live_")

    class Settings:
        name = "api_keys"


class Video(Document):
    title: str
    filename: Optional[str] = None
    file_path: Optional[str] = None
    content_hash: Optional[str] = None
    thumbnail_url: Optional[str] = None
    thumbnail_path: Optional[str] = None
    keyframes: Optional[List[Any]] = Field(default_factory=list)
    duration_sec: Optional[int] = 0
    file_size_mb: Optional[float] = 0.0
    status: str = "uploading"
    processing_stage: Optional[str] = "stage1_ingestion"
    processing_progress: Optional[float] = 0.0
    word_count: Optional[int] = 0
    wer_accuracy: Optional[float] = 98.0
    user_id: Optional[str] = None
    category: Optional[str] = "Academic"
    summary_depth: Optional[str] = "Detailed Breakdown"
    domain: Optional[str] = "Academic Lecture"
    views_count: Optional[int] = 0
    language: Optional[str] = "en"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "videos"
        indexes = ["user_id", "status", "category", "created_at"]


class Transcript(Document):
    video_id: str
    language: Optional[str] = "en"
    duration_sec: Optional[int] = 0
    word_count: Optional[int] = 0
    segments: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transcripts"
        indexes = ["video_id"]


class Summary(Document):
    video_id: str
    depth: Optional[str] = "Detailed Breakdown"
    tldr: Optional[str] = ""
    sections: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    key_takeaways: Optional[List[str]] = Field(default_factory=list)
    keywords: Optional[List[str]] = Field(default_factory=list)
    sentiment: Optional[str] = "Neutral"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "summaries"
        indexes = ["video_id"]


class KeyMoment(Document):
    video_id: str
    timestamp: Optional[float] = 0.0
    timestamp_str: Optional[str] = "00:00"
    title: Optional[str] = ""
    description: Optional[str] = ""
    importance_score: Optional[float] = 0.8
    category: Optional[str] = "Key Moment"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "key_moments"
        indexes = ["video_id", "timestamp"]


class Bookmark(Document):
    user_id: str
    video_id: str
    video_title: Optional[str] = ""
    timestamp_sec: int = 0
    timestamp_str: str = "00:00"
    timestamp: Optional[Union[str, float]] = "00:00"
    note: Optional[str] = ""
    label: Optional[str] = "Key Highlight"
    type: Optional[str] = "note"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "bookmarks"
        indexes = ["user_id", "video_id"]


class AuditLog(Document):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str = ""
    resource: Optional[str] = ""
    resource_id: Optional[str] = None
    details: Optional[str] = ""
    ip_address: Optional[str] = "127.0.0.1"
    status: str = "SUCCESS"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "audit_logs"
        indexes = ["user_id", "action", "created_at"]


class Setting(Document):
    user_id: Optional[str] = "default"
    whisper_model: str = "tiny.en"
    summary_length: str = "medium"
    default_export_format: str = "pdf"
    theme: str = "dark"
    email_notifications: bool = True
    auto_indexing: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "settings"
        indexes = ["user_id"]


class ProcessingJob(Document):
    video_id: str
    status: str = "pending"
    progress: float = 0.0
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "processing_jobs"
        indexes = ["video_id", "status"]


class ContentInsight(Document):
    video_id: str
    keywords: List[str] = Field(default_factory=list)
    topics: Union[List[str], List[Dict[str, Any]]] = Field(default_factory=list)
    sentiment: Optional[Union[str, Dict[str, Any]]] = "Neutral"
    named_entities: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Settings:
        name = "content_insights"
        indexes = ["video_id"]


class Share(Document):
    video_id: str
    share_token: str
    shared_by: Optional[str] = None
    shared_with: Optional[str] = None
    visibility: str = "public"
    view_count: Optional[int] = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "shares"
        indexes = ["video_id", "share_token"]


class Quiz(Document):
    video_id: str
    title: Optional[str] = "Lecture Quiz"
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "quizzes"
        indexes = ["video_id", "created_by"]


class FlashcardSet(Document):
    video_id: str
    title: Optional[str] = "Lecture Flashcards"
    flashcards: List[Dict[str, Any]] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "flashcard_sets"
        indexes = ["video_id", "created_by"]


class LearnerProgress(Document):
    user_id: str
    video_id: str
    watch_seconds: Optional[int] = 0
    study_time_seconds: Optional[int] = 0
    completed: Optional[bool] = False
    flashcards_mastered: List[str] = Field(default_factory=list)
    flashcards_review: List[str] = Field(default_factory=list)
    quiz_attempts: List[Dict[str, Any]] = Field(default_factory=list)
    last_studied_at: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "learner_progress"
        indexes = ["user_id", "video_id", "last_studied_at"]

