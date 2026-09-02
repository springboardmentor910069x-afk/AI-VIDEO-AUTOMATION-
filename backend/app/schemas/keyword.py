import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.keyword import KeywordSetStatus


class KeywordRead(BaseModel):
    id: uuid.UUID
    keyword: str
    score: float
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KeywordSetRead(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID
    status: KeywordSetStatus
    model_name: str | None
    error: str | None
    keywords: list[KeywordRead]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}