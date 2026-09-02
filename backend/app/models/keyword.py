import enum
import uuid

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class KeywordSetStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class KeywordSet(TimestampMixin, Base):
    __tablename__ = "keyword_sets"

    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    status: Mapped[KeywordSetStatus] = mapped_column(
        SQLEnum(
            KeywordSetStatus,
            name="keyword_set_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=KeywordSetStatus.PENDING,
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
        back_populates="keyword_set",
    )

    keywords: Mapped[list["Keyword"]] = relationship(
        "Keyword",
        back_populates="keyword_set",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Keyword.position",
    )


class Keyword(TimestampMixin, Base):
    __tablename__ = "keywords"

    set_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("keyword_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    keyword: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    keyword_set: Mapped["KeywordSet"] = relationship(
        "KeywordSet",
        back_populates="keywords",
    )