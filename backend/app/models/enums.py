from enum import StrEnum


class UserRole(StrEnum):
    creator = "creator"
    learner = "learner"
    educator = "educator"
    admin = "admin"


class VideoStatus(StrEnum):
    uploaded = "uploaded"
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"

