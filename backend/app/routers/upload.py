import os
import shutil
import json

from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.orm import Session

from app.config import get_db
from app.services.transcribe import transcribe_video
from app.services.summary import summarize_text
from app.services.keywords import extract_keywords
from app.services.key_moments import detect_key_moments
from app.services.video_service import save_video


router = APIRouter()

UPLOAD_FOLDER = "uploads"

os.makedirs(
    UPLOAD_FOLDER,
    exist_ok=True
)


@router.post("/upload")
async def upload_video(
    file: UploadFile = File(...),
    title: str = Form(...),
    db: Session = Depends(get_db)
):

    # =========================================================
    # 1. SAVE UPLOADED VIDEO
    # =========================================================

    file_path = os.path.join(
        UPLOAD_FOLDER,
        file.filename
    )

    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    # =========================================================
    # 2. TRANSCRIPTION + TIMESTAMPS USING WHISPER
    # =========================================================

    transcript, timestamps = transcribe_video(
        file_path
    )


    # =========================================================
    # 3. GENERATE SUMMARY
    # =========================================================

    summary = summarize_text(
        transcript
    )


    # =========================================================
    # 4. EXTRACT KEYWORDS
    # =========================================================

    keywords = extract_keywords(
        transcript
    )

    # Convert keyword list into text
    # for database storage
    keywords_text = ", ".join(
        keywords
    )


    # =========================================================
    # 5. DETECT IMPORTANT KEY MOMENTS
    # =========================================================

    key_moments = detect_key_moments(
        timestamps=timestamps,
        keywords=keywords,
        max_moments=5
    )


    # =========================================================
    # 6. CALCULATE WORD COUNT
    # =========================================================

    word_count = len(
        transcript.split()
    )


    # =========================================================
    # 7. CALCULATE VIDEO DURATION
    # =========================================================

    duration = 0

    if timestamps:
        duration = timestamps[-1]["end"]


    # =========================================================
    # 8. CONVERT TIMESTAMPS TO JSON
    # =========================================================

    timestamps_text = json.dumps(
        timestamps
    )


    # =========================================================
    # 9. SAVE VIDEO INFORMATION
    # =========================================================

    saved_video = save_video(
        db=db,
        title=title.strip(),
        filename=file.filename,
        transcript=transcript,
        summary=summary,
        keywords=keywords_text,
        duration=duration,
        word_count=word_count,
        transcript_timestamps=timestamps_text
    )


    # =========================================================
    # 10. RETURN RESULTS TO FRONTEND
    # =========================================================

    return {
        "id": saved_video.id,
        "title": saved_video.title,
        "filename": saved_video.filename,
        "transcript": saved_video.transcript,
        "summary": saved_video.summary,
        "keywords": keywords,
        "timestamps": timestamps,
        "key_moments": key_moments,
        "duration": round(
            duration,
            2
        ),
        "word_count": word_count
    }