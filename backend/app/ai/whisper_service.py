import asyncio
import json
import os
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import whisper

from app.core.logging import logger

WHISPER_MODEL_NAME = "base"
WHISPER_SAMPLE_RATE = 16000

_FFMPEG_TIMEOUT_SECONDS = 300
_FFPROBE_TIMEOUT_SECONDS = 60
_MAX_FFMPEG_STDERR_CHARS = 2000


class WhisperServiceError(RuntimeError):
    """Base exception for Whisper service."""


class ModelLoadError(WhisperServiceError):
    pass


class AudioExtractionError(WhisperServiceError):
    pass


class TranscriptionError(WhisperServiceError):
    pass


@dataclass(slots=True)
class TranscriptionResult:
    transcript: str
    language: str


_model = None
_model_lock = threading.Lock()


def get_model():
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            try:
                _model = whisper.load_model(WHISPER_MODEL_NAME)
            except Exception as exc:
                raise ModelLoadError(
                    f"Unable to load Whisper model '{WHISPER_MODEL_NAME}'"
                ) from exc

    return _model


def has_audio_stream(media_path: str) -> bool:
    """Return True if the media file contains at least one audio stream."""
    command = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=index",
        "-of", "json",
        media_path,
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=_FFPROBE_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise AudioExtractionError(
            "FFprobe is not installed or not available in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise AudioExtractionError(
            "FFprobe timed out while inspecting the media file."
        ) from exc

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip() or "unknown error"
        raise AudioExtractionError(
            f"FFprobe failed to inspect the media file: {stderr}"
        )

    try:
        data = json.loads(completed.stdout or "{}")
    except json.JSONDecodeError:
        data = {}

    streams = data.get("streams") or []
    return len(streams) > 0


def extract_audio(video_path: str, audio_path: str) -> None:
    video = Path(video_path)
    audio = Path(audio_path)

    logger.info("Extracting audio from video: %s -> %s", video_path, audio_path)

    if not video.exists():
        raise AudioExtractionError(f"Video not found: {video_path}")

    if not has_audio_stream(str(video)):
        raise AudioExtractionError("Video does not contain an audio stream.")

    command = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vn",
        "-ac", "1",
        "-ar", str(WHISPER_SAMPLE_RATE),
        "-f", "wav",
        str(audio_path),
    ]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=_FFMPEG_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise AudioExtractionError(
            "FFmpeg is not installed or not available in PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise AudioExtractionError(
            "FFmpeg audio extraction timed out."
        ) from exc

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip() or "unknown error"
        raise AudioExtractionError(
            "FFmpeg failed to extract audio from "
            f"{video_path}: {stderr[:_MAX_FFMPEG_STDERR_CHARS]}"
        )

    if not audio.exists():
        raise AudioExtractionError(
            "Audio extraction failed: output WAV was not created."
        )

    try:
        size = audio.stat().st_size
    except OSError as exc:
        raise AudioExtractionError(
            f"Audio extraction failed: cannot stat {audio_path}: {exc}"
        ) from exc

    if size == 0:
        raise AudioExtractionError(
            "Audio extraction failed: output WAV is empty."
        )

    logger.info("Extracted audio: %s (%d bytes)", audio_path, size)


async def transcribe_video(video_path: str) -> TranscriptionResult:
    video = Path(video_path)

    if not video.exists():
        raise TranscriptionError(f"Video file not found: {video_path}")

    audio_path = video.with_suffix(".wav")

    try:
        extract_audio(str(video), str(audio_path))

        if not audio_path.exists():
            raise TranscriptionError(
                "Extracted audio file is missing after extraction."
            )

        try:
            wav_size = audio_path.stat().st_size
        except OSError as exc:
            raise TranscriptionError(
                f"Cannot stat extracted audio {audio_path}: {exc}"
            ) from exc

        if wav_size == 0:
            raise TranscriptionError("Extracted audio file is empty.")

        logger.info(
            "Transcribing video=%s audio=%s wav_size=%d bytes",
            video_path,
            audio_path,
            wav_size,
        )

        model = get_model()

        result = await asyncio.to_thread(
            model.transcribe,
            str(audio_path),
            fp16=False,
        )

        text = ((result or {}).get("text") or "").strip()
        language = (result or {}).get("language") or "unknown"
        segments = (result or {}).get("segments") or []

        logger.info(
            "Whisper result for %s: text=%r language=%s segments=%d",
            video_path,
            text,
            language,
            len(segments),
        )

        if not text:
            raise TranscriptionError(
                "Whisper returned no transcript text (0 segments) for audio "
                f"{audio_path} ({wav_size} bytes). The audio track is likely "
                "silent or contains no recognizable speech."
            )

        return TranscriptionResult(
            transcript=text,
            language=language,
        )

    except WhisperServiceError:
        raise

    except Exception as exc:
        logger.exception("Unexpected error during transcription of %s", video_path)
        raise TranscriptionError(
            f"Unexpected error during transcription: {exc}"
        ) from exc

    finally:
        try:
            if audio_path.exists():
                audio_path.unlink(missing_ok=True)
                logger.debug("Removed temporary audio file %s", audio_path)
        except OSError:
            logger.warning(
                "Could not remove temporary audio file %s", audio_path
            )
