import os
import json
import uuid
import subprocess
import re
import html

import yt_dlp

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import SessionLocal
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


# =========================================================
# REQUEST MODEL
# =========================================================

class YouTubeRequest(BaseModel):
    title: str
    url: str


# =========================================================
# YOUTUBE URL VALIDATION
# =========================================================

def is_youtube_url(url):

    return (
        "youtube.com/" in url
        or "youtu.be/" in url
    )


# =========================================================
# TRANSCRIPT VALIDATION
# =========================================================

def is_valid_transcript(transcript):

    if not transcript:
        return False

    words = transcript.split()

    if len(words) < 3:
        return False

    return True


# =========================================================
# VTT TIMESTAMP
# =========================================================

def parse_vtt_timestamp(value):

    value = value.strip()

    parts = value.split(":")

    try:

        if len(parts) == 3:

            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])

            return (
                hours * 3600
                + minutes * 60
                + seconds
            )

        if len(parts) == 2:

            minutes = float(parts[0])
            seconds = float(parts[1])

            return (
                minutes * 60
                + seconds
            )

    except ValueError:

        return None

    return None


# =========================================================
# CLEAN VTT TEXT
# =========================================================

def clean_vtt_text(text):

    text = re.sub(
        r"<[^>]+>",
        "",
        text
    )

    text = html.unescape(text)

    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


# =========================================================
# READ VTT CAPTIONS
# =========================================================

def parse_vtt_file(vtt_path):

    timestamps = []

    try:

        with open(
            vtt_path,
            "r",
            encoding="utf-8"
        ) as file:

            lines = file.readlines()

    except Exception as error:

        print(
            "Could not read VTT file:",
            error
        )

        return "", []


    index = 0

    while index < len(lines):

        line = lines[index].strip()

        # Look for a timestamp line
        if "-->" not in line:

            index += 1
            continue

        parts = line.split("-->")

        if len(parts) != 2:

            index += 1
            continue

        start_text = parts[0].strip()

        end_text = parts[1].strip()

        # Remove cue settings after end timestamp
        end_text = end_text.split()[0]

        start = parse_vtt_timestamp(
            start_text
        )

        end = parse_vtt_timestamp(
            end_text
        )

        if start is None or end is None:

            index += 1
            continue

        index += 1

        text_lines = []

        while (
            index < len(lines)
            and lines[index].strip()
        ):

            current = lines[index].strip()

            # Ignore VTT positioning/settings
            if current:

                text_lines.append(
                    current
                )

            index += 1

        text = clean_vtt_text(
            " ".join(text_lines)
        )

        if text:

            # Avoid duplicate consecutive captions
            if (
                not timestamps
                or timestamps[-1]["text"] != text
            ):

                timestamps.append(
                    {
                        "start": round(
                            start,
                            2
                        ),
                        "end": round(
                            end,
                            2
                        ),
                        "text": text
                    }
                )

        index += 1


    transcript_parts = [
        item["text"]
        for item in timestamps
    ]

    transcript = " ".join(
        transcript_parts
    ).strip()

    return transcript, timestamps


# =========================================================
# FIND CAPTION FILE
# =========================================================

def find_caption_file(unique_id):

    prefix = f"youtube_{unique_id}"

    candidates = []

    for filename in os.listdir(
        UPLOAD_FOLDER
    ):

        if not filename.startswith(prefix):

            continue

        lower_name = filename.lower()

        if lower_name.endswith(".vtt"):

            candidates.append(
                os.path.join(
                    UPLOAD_FOLDER,
                    filename
                )
            )

    if not candidates:

        return None

    # Prefer English captions
    english = [
        path
        for path in candidates
        if ".en" in os.path.basename(
            path
        ).lower()
    ]

    if english:

        return english[0]

    return candidates[0]


# =========================================================
# ANALYZE YOUTUBE VIDEO
# =========================================================

@router.post("/youtube")
async def analyze_youtube(
    request: YouTubeRequest
):

    title = request.title.strip()
    url = request.url.strip()

    # =====================================================
    # VALIDATE TITLE
    # =====================================================

    if not title:

        raise HTTPException(
            status_code=400,
            detail="Video title is required."
        )

    # =====================================================
    # VALIDATE URL
    # =====================================================

    if not url:

        raise HTTPException(
            status_code=400,
            detail="YouTube URL is required."
        )

    if not is_youtube_url(url):

        raise HTTPException(
            status_code=400,
            detail="Please enter a valid YouTube URL."
        )

    # =====================================================
    # 1. CREATE UNIQUE FILE NAMES
    # =====================================================

    unique_id = uuid.uuid4().hex

    output_template = os.path.join(
        UPLOAD_FOLDER,
        f"youtube_{unique_id}.%(ext)s"
    )

    audio_file = os.path.join(
        UPLOAD_FOLDER,
        f"youtube_{unique_id}_audio.wav"
    )

    # =====================================================
    # 2. DOWNLOAD VIDEO + AVAILABLE CAPTIONS
    # =====================================================

    ydl_options = {
    "format": "bv*+ba/b",
    "outtmpl": output_template,
    "noplaylist": True,
    "quiet": True,
    "no_warnings": True,
    "merge_output_format": "mp4",
}

    try:

        with yt_dlp.YoutubeDL(
            ydl_options
        ) as ydl:

            info = ydl.extract_info(
                url,
                download=True
            )

            youtube_title = info.get(
                "title",
                "YouTube Video"
            )

            # =================================================
            # COLLECT AVAILABLE METADATA
            # =================================================

            youtube_metadata = {
                "youtube_title": youtube_title,
                "uploader": info.get(
                    "uploader"
                ),
                "channel": info.get(
                    "channel"
                ),
                "creator": info.get(
                    "creator"
                ),
                "artist": info.get(
                    "artist"
                ),
                "artists": info.get(
                    "artists"
                ),
                "track": info.get(
                    "track"
                ),
                "album": info.get(
                    "album"
                ),
                "description": info.get(
                    "description"
                ),
                "duration": info.get(
                    "duration"
                ),
                "video_id": info.get(
                    "id"
                )
            }
            print("YOUTUBE METADATA:", youtube_metadata)
    except Exception as error:

        print(
            "YouTube download error:",
            error
        )

        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to download this YouTube video. "
                "Make sure the URL is public and valid."
            )
        )

    # =====================================================
    # 3. FIND DOWNLOADED VIDEO
    # =====================================================

    downloaded_file = None

    prefix = f"youtube_{unique_id}"

    for filename in os.listdir(
        UPLOAD_FOLDER
    ):

        lower_name = filename.lower()

        if (
            filename.startswith(prefix)
            and not lower_name.endswith(".vtt")
            and not lower_name.endswith("_audio.wav")
            and not lower_name.endswith(".part")
            and not lower_name.endswith(".ytdl")
        ):

            downloaded_file = filename

            break

    if not downloaded_file:

        raise HTTPException(
            status_code=500,
            detail=(
                "YouTube video was downloaded "
                "but the video file was not found."
            )
        )

    video_path = os.path.join(
        UPLOAD_FOLDER,
        downloaded_file
    )

    # =====================================================
    # 4. TRY CAPTIONS FIRST
    # =====================================================

    caption_file = find_caption_file(
        unique_id
    )

    transcript = ""
    timestamps = []
    used_captions = False

    if caption_file:

        print(
            "YouTube captions found:",
            caption_file
        )

        caption_transcript, caption_timestamps = (
            parse_vtt_file(
                caption_file
            )
        )

        if is_valid_transcript(
            caption_transcript
        ):

            transcript = caption_transcript

            timestamps = caption_timestamps

            used_captions = True

            print(
                "Using YouTube captions. "
                "Whisper transcription skipped."
            )

    # =====================================================
    # 5. FALLBACK TO WHISPER IF NO CAPTIONS
    # =====================================================

    if not used_captions:

        print(
            "No usable YouTube captions found. "
            "Falling back to Whisper."
        )

        # ---------------------------------------------
        # EXTRACT CLEAN AUDIO
        # ---------------------------------------------

        try:

            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    video_path,
                    "-vn",
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    "-c:a",
                    "pcm_s16le",
                    audio_file
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE
            )

        except FileNotFoundError:

            raise HTTPException(
                status_code=500,
                detail=(
                    "FFmpeg was not found. "
                    "Please make sure FFmpeg is installed "
                    "and available in PATH."
                )
            )

        except subprocess.CalledProcessError as error:

            print(
                "FFmpeg audio extraction error:",
                error.stderr.decode(
                    errors="ignore"
                )
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to extract audio "
                    "from the YouTube video."
                )
            )

        # ---------------------------------------------
        # WHISPER
        # ---------------------------------------------

        try:

            transcript, timestamps = (
                transcribe_video(
                    audio_file
                )
            )

        except Exception as error:

            print(
                "Transcription error:",
                error
            )

            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to transcribe "
                    "the YouTube video."
                )
            )

    # =====================================================
    # 6. VALIDATE TRANSCRIPT
    # =====================================================

    if not is_valid_transcript(
        transcript
    ):

        print(
            "Invalid YouTube transcript:",
            transcript
        )

        raise HTTPException(
            status_code=422,
            detail=(
                "ClipMind could not detect clear speech "
                "or usable captions in this YouTube video."
            )
        )

    # =====================================================
    # 7. GENERATE SUMMARY
    # =====================================================

    try:

        summary_text = transcript

        words = transcript.split()

        if len(words) > 900:

            summary_text = " ".join(
                words[:900]
            )

        summary = summarize_text(
            summary_text
        )

    except Exception as error:

        print(
            "Summary error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to generate "
                "video summary."
            )
        )

    # =====================================================
    # 8. EXTRACT KEYWORDS
    # =====================================================

    keywords = extract_keywords(
        transcript
    )

    keywords_text = ", ".join(
        keywords
    )

    # =====================================================
    # 9. DETECT KEY MOMENTS
    # =====================================================

    key_moments = detect_key_moments(
        timestamps=timestamps,
        keywords=keywords,
        max_moments=5
    )

    # =====================================================
    # 10. WORD COUNT
    # =====================================================

    word_count = len(
        transcript.split()
    )

    # =====================================================
    # 11. VIDEO DURATION
    # =====================================================

    duration = 0

    if timestamps:

        duration = timestamps[-1]["end"]

    elif youtube_metadata.get(
        "duration"
    ):

        duration = youtube_metadata[
            "duration"
        ]

    # =====================================================
    # 12. TIMESTAMPS JSON
    # =====================================================

    timestamps_text = json.dumps(
        timestamps
    )

    # =====================================================
    # 13. SAVE TO POSTGRESQL
    # =====================================================

    db = SessionLocal()

    try:
        print("YOUTUBE URL BEFORE SAVE:", url)
        saved_video = save_video(
            db=db,
            title=title,
            filename=downloaded_file,
            transcript=transcript,
            summary=summary,
            keywords=keywords_text,
            duration=duration,
            word_count=word_count,
            transcript_timestamps=timestamps_text,
            youtube_url=url
        )
        print("YOUTUBE URL AFTER SAVE:", saved_video.youtube_url)
    finally:

        db.close()

    # =====================================================
    # 14. REMOVE TEMPORARY AUDIO
    # =====================================================

    try:

        if os.path.exists(
            audio_file
        ):

            os.remove(
                audio_file
            )

    except Exception as error:

        print(
            "Could not remove temporary audio:",
            error
        )

    # =====================================================
    # 15. REMOVE CAPTION FILE
    # =====================================================

    try:

        if caption_file and os.path.exists(
            caption_file
        ):

            os.remove(
                caption_file
            )

    except Exception as error:

        print(
            "Could not remove caption file:",
            error
        )

    # =====================================================
    # 16. RETURN RESULTS
    # =====================================================

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

        "word_count": word_count,

        "youtube_metadata": youtube_metadata,

        "transcript_source": (
            "youtube_captions"
            if used_captions
            else "whisper"
        )
    }