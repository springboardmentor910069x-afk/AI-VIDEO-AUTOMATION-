import enum
import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class TranscriptStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class Transcript(TimestampMixin, Base):
    __tablename__ = "transcripts"

    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    transcript: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    language: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    # Timestamped segments from Whisper: [{"start": float, "end": float, "text": str}].
    # Used by the key-moments pipeline for accurate timestamps.
    segments: Mapped[list | None] = mapped_column(
        JSON,
        nullable=True,
    )

    status: Mapped[TranscriptStatus] = mapped_column(
        SQLEnum(
            TranscriptStatus,
            name="transcript_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=TranscriptStatus.PENDING,
        nullable=False,
        index=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    video: Mapped["Video"] = relationship(
        "Video",
        back_populates="transcript",
    )
