from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Creator")
    plan = Column(String, nullable=True, default="pro")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    verification_status = Column(String, default="verified")
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Video(Base):
    __tablename__ = "relational_videos"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    duration_sec = Column(Integer, default=0)
    status = Column(String, default="uploading")
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
