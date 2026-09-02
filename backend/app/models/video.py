import enum
import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class UploadStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Video(TimestampMixin, Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    file_path: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )

    thumbnail_path: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    duration: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    file_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    upload_status: Mapped[UploadStatus] = mapped_column(
        SQLEnum(
            UploadStatus,
            name="upload_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=UploadStatus.PENDING,
        nullable=False,
        index=True,
    )

    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    uploader: Mapped["User"] = relationship(
        "User",
        back_populates="videos",
    )

    transcript: Mapped["Transcript | None"] = relationship(
        "Transcript",
        back_populates="video",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    summaries: Mapped[list["Summary"]] = relationship(
        "Summary",
        back_populates="video",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    key_moment_set: Mapped["KeyMomentSet | None"] = relationship(
        "KeyMomentSet",
        back_populates="video",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    keyword_set: Mapped["KeywordSet | None"] = relationship(
        "KeywordSet",
        back_populates="video",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
