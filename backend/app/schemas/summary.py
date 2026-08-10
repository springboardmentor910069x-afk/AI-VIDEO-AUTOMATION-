import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.summary import SummaryStatus, SummaryType


class SummaryBase(BaseModel):
    summary: str | None = None
    summary_type: SummaryType
    model_name: str | None = None


class SummaryCreate(BaseModel):
    video_id: uuid.UUID
    summary: str | None = None
    summary_type: SummaryType
    model_name: str | None = None


class SummaryRead(BaseModel):
    id: uuid.UUID
    video_id: uuid.UUID
    summary: str | None
    summary_type: SummaryType
    model_name: str | None
    status: SummaryStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SummaryUpdate(BaseModel):
    summary: str | None = None
    summary_type: SummaryType | None = None
    model_name: str | None = None
    status: SummaryStatus | None = None
