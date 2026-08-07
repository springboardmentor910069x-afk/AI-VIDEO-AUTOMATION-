import enum
from app.models.video import Video
from sqlalchemy import Enum as SQLEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base
from app.models.base import TimestampMixin


class UserRole(str, enum.Enum):
    LEARNER = "learner"
    EDUCATOR = "educator"
    CONTENT_CREATOR = "content_creator"
    ADMINISTRATOR = "administrator"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

   
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(
            UserRole,
            name="user_role",
            values_callable=lambda x: [e.value for e in x], 
        ),
        default=UserRole.LEARNER,
        nullable=False,
    )
  

    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
    )

    videos: Mapped[list["Video"]] = relationship(
        "Video",
        back_populates="uploader",
        cascade="all, delete-orphan",
    )
