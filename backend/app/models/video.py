from sqlalchemy import Column, Integer, String, Text, Float
from app.config import Base


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    filename = Column(String)
    youtube_url = Column(String, nullable=True)
    transcript = Column(Text)
    summary = Column(Text)
    keywords = Column(Text)

    duration = Column(Float, default=0)
    word_count = Column(Integer, default=0)
    transcript_timestamps = Column(Text)