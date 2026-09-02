import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.transcript import TranscriptStatus


class TranscriptBase(BaseModel):
    transcript: str | None = None
    language: str | None = None


class TranscriptCreate(TranscriptBase):
    video_id: uuid.UUID


class TranscriptRead(TranscriptBase):
    id: uuid.UUID
    video_id: uuid.UUID
    status: TranscriptStatus
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TranscriptUpdate(BaseModel):
    transcript: str | None = None
    language: str | None = None
    status: TranscriptStatus | None = None
    error_message: str | None = None
