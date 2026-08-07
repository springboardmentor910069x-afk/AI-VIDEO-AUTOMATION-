import asyncio
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.whisper_service import transcribe_video
from app.auth.dependencies import get_current_user
from app.database.dependencies import get_db
from app.models.transcript import TranscriptStatus
from app.models.user import User
from app.models.video import UploadStatus
from app.schemas.video import VideoRead
from app.services.transcript_service import create_transcript
from app.services.video_processing import process_video
from app.services.video_service import create_video

router = APIRouter(prefix="/videos", tags=["Videos"])

ALLOWED_EXTENSIONS = {"mp4", "mov", "avi", "mkv", "webm"}
UPLOAD_DIR = "uploads/videos"
MAX_FILE_SIZE = 500 * 1024 * 1024


@router.post(
    "/upload",
    response_model=VideoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_video(
    title: str = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension: .{ext}",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    unique_filename = f"{uuid.uuid4()}.{ext}"
    dest = os.path.join(UPLOAD_DIR, unique_filename)

    file_size = 0

    try:
        with open(dest, "wb") as buffer:
            while chunk := await file.read(64 * 1024):
                file_size += len(chunk)

                if file_size > MAX_FILE_SIZE:
                    buffer.close()
                    os.remove(dest)

                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds maximum size of 500 MB",
                    )

                buffer.write(chunk)

        # Save video in DB
        video = await create_video(
            db=db,
            title=title,
            description=description,
            filename=unique_filename,
            original_filename=file.filename,
            file_path=dest,
            uploaded_by=current_user.id,
        )

        await db.commit()
        await db.refresh(video)

        # Processing started
        video.upload_status = UploadStatus.PROCESSING
        await db.commit()
        await db.refresh(video)

        # Generate thumbnail & duration
        result = await asyncio.to_thread(process_video, dest)

        video.thumbnail_path = result["thumbnail_path"]
        video.duration = result["duration"]
        video.file_size = file_size
        video.upload_status = UploadStatus.READY

        await db.commit()
        await db.refresh(video)

        # Whisper transcription
        try:
            transcription = await transcribe_video(dest)

            await create_transcript(
                db=db,
                video_id=video.id,
                transcript=transcription.transcript,
                language=transcription.language,
                status=TranscriptStatus.COMPLETE,
            )

            await db.commit()

        except Exception as e:
            print(f"Whisper Error: {e}")

            await create_transcript(
                db=db,
                video_id=video.id,
                status=TranscriptStatus.FAILED,
            )

            await db.commit()

        return video

    except Exception:
        await db.rollback()

        if os.path.exists(dest):
            os.remove(dest)

        raise

    finally:
        await file.close()
