from datetime import datetime

from pydantic import BaseModel

from app.models.enums import VideoStatus


class VideoRead(BaseModel):
    id: str
    user_id: str
    title: str
    file_url: str
    duration: float
    size_bytes: int
    mime_type: str
    status: VideoStatus
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class JobStatus(BaseModel):
    video_id: str
    status: VideoStatus
    message: str

