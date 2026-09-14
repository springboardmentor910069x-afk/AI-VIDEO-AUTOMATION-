from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from datetime import datetime

from app.config import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)

    video_id = Column(
        Integer,
        ForeignKey("videos.id"),
        nullable=False
    )

    question = Column(Text, nullable=False)

    answer = Column(Text, nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )