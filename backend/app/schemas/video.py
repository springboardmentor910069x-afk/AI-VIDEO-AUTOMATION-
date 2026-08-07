import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.video import UploadStatus


class VideoBase(BaseModel):
    title: str
    description: str | None = None
    filename: str
    original_filename: str


class VideoCreate(VideoBase):
    pass


class VideoRead(VideoBase):
    id: uuid.UUID
    file_path: str
    thumbnail_path: str | None = None
    duration: float | None = None
    file_size: int | None = None
    upload_status: UploadStatus
    uploaded_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VideoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    filename: str | None = None
    original_filename: str | None = None
    file_path: str | None = None
    thumbnail_path: str | None = None
    duration: float | None = None
    file_size: int | None = None
    upload_status: UploadStatus | None = None
