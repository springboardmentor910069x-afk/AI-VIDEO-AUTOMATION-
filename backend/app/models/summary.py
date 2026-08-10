import enum
import uuid

from sqlalchemy import Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class SummaryType(str, enum.Enum):
    SHORT = "short"
    DETAILED = "detailed"


class SummaryStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class Summary(TimestampMixin, Base):
    __tablename__ = "summaries"

    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    summary_type: Mapped[SummaryType] = mapped_column(
        SQLEnum(
            SummaryType,
            name="summary_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )

    model_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    status: Mapped[SummaryStatus] = mapped_column(
        SQLEnum(
            SummaryStatus,
            name="summary_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=SummaryStatus.PENDING,
        nullable=False,
        index=True,
    )

    video: Mapped["Video"] = relationship(
        "Video",
        back_populates="summaries",
    )
