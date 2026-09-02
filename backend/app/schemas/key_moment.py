import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.key_moment import KeyMomentSetStatus, KeyMomentType


class KeyMomentRead(BaseModel):
    id: uuid.UUID
    start_time: float
    end_time: float
    title: str
    description: str
    type: KeyMomentType
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KeyMomentSetRead(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID
    status: KeyMomentSetStatus
    model_name: str | None
    error: str | None
    moments: list[KeyMomentRead]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
