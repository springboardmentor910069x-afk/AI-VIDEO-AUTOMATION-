from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import os
import time

from app.config import get_db
from app.models.video import Video

router = APIRouter()


# =========================================================
# GET ALL SAVED VIDEOS
# =========================================================

@router.get("/videos")
def get_videos(db: Session = Depends(get_db)):

    videos = (
        db.query(Video)
        .order_by(Video.id.desc())
        .all()
    )

    return [
        {
            "id": video.id,
            "title": video.title,
            "filename": video.filename,
            "transcript": video.transcript,
            "summary": video.summary,
            "keywords": video.keywords,
            "duration": video.duration,
            "word_count": video.word_count,
            "transcript_timestamps": video.transcript_timestamps
        }
        for video in videos
    ]


# =========================================================
# UPDATE TRANSCRIPT
# =========================================================

class TranscriptUpdate(BaseModel):
    transcript: str


@router.put("/videos/{video_id}/transcript")
def update_transcript(
    video_id: int,
    data: TranscriptUpdate,
    db: Session = Depends(get_db)
):

    video = (
        db.query(Video)
        .filter(Video.id == video_id)
        .first()
    )

    if not video:
        raise HTTPException(
            status_code=404,
            detail="Video not found"
        )

    # Update transcript
    video.transcript = data.transcript

    # Update word count
    video.word_count = len(
        data.transcript.split()
    )

    db.commit()
    db.refresh(video)

    return {
        "message": "Transcript updated successfully",
        "id": video.id,
        "transcript": video.transcript,
        "word_count": video.word_count
    }


# =========================================================
# DELETE VIDEO
# =========================================================

@router.delete("/videos/{video_id}")
def delete_video(
    video_id: int,
    db: Session = Depends(get_db)
):

    video = (
        db.query(Video)
        .filter(Video.id == video_id)
        .first()
    )

    if not video:
        raise HTTPException(
            status_code=404,
            detail="Video not found"
        )

    filename = os.path.basename(
        video.filename
    )

    file_path = os.path.join(
        "uploads",
        filename
    )

    # =====================================================
    # DELETE DATABASE RECORD FIRST
    # =====================================================

    db.delete(video)
    db.commit()

    # =====================================================
    # DELETE ACTUAL VIDEO FILE
    # =====================================================

    if os.path.exists(file_path):

        # Windows may temporarily keep the video locked.
        # Try several times before giving up.
        deleted = False

        for attempt in range(5):

            try:
                os.remove(file_path)
                deleted = True
                break

            except PermissionError:

                # Wait for browser/video player
                # to release the file.
                time.sleep(0.5)

            except OSError as error:

                print(
                    f"Error deleting file "
                    f"(attempt {attempt + 1}): {error}"
                )

                time.sleep(0.5)

        if not deleted and os.path.exists(file_path):

            raise HTTPException(
                status_code=409,
                detail=(
                    "Video record was deleted, but the "
                    "video file is still being used by "
                    "another process. Close the video "
                    "player/browser tab and try again."
                )
            )

    return {
        "message": "Video deleted successfully"
    }