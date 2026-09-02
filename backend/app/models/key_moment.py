import enum
import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class KeyMomentType(str, enum.Enum):
    HIGHLIGHT = "highlight"
    CHAPTER = "chapter"
    IMPORTANT = "important"


class KeyMomentSetStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class KeyMomentSet(TimestampMixin, Base):
    __tablename__ = "key_moment_sets"

    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    status: Mapped[KeyMomentSetStatus] = mapped_column(
        SQLEnum(
            KeyMomentSetStatus,
            name="key_moment_set_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=KeyMomentSetStatus.PENDING,
        nullable=False,
        index=True,
    )

    model_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    video: Mapped["Video"] = relationship(
        "Video",
        back_populates="key_moment_set",
    )

    moments: Mapped[list["KeyMoment"]] = relationship(
        "KeyMoment",
        back_populates="key_moment_set",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="KeyMoment.position",
    )


class KeyMoment(TimestampMixin, Base):
    __tablename__ = "key_moments"

    set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("key_moment_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    start_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    end_time: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    type: Mapped[KeyMomentType] = mapped_column(
        SQLEnum(
            KeyMomentType,
            name="key_moment_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )

    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    key_moment_set: Mapped["KeyMomentSet"] = relationship(
        "KeyMomentSet",
        back_populates="moments",
    )
