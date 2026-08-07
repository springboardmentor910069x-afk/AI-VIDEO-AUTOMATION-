import asyncio
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path
import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import whisper

WHISPER_MODEL_NAME = "base"


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


def extract_audio(video_path: str, audio_path: str) -> None:
    video = Path(video_path)

    if not video.exists():
        raise AudioExtractionError(f"Video not found: {video_path}")

    command = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        audio_path,
    ]

    try:
        subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except FileNotFoundError as exc:
        raise AudioExtractionError(
            "FFmpeg is not installed or not available in PATH."
        ) from exc
    except subprocess.CalledProcessError as exc:
        raise AudioExtractionError(
            exc.stderr.decode() if exc.stderr else "FFmpeg failed."
        ) from exc

    if not Path(audio_path).exists():
        raise AudioExtractionError("Audio extraction failed.")


async def transcribe_video(video_path: str) -> TranscriptionResult:
    video = Path(video_path)

    if not video.exists():
        raise TranscriptionError("Video file not found.")

    audio_path = video.with_suffix(".wav")

    try:
        extract_audio(str(video), str(audio_path))

        model = get_model()

        result = await asyncio.to_thread(
            model.transcribe,
            str(audio_path),
            fp16=False,
        )

        return TranscriptionResult(
            transcript=result.get("text", "").strip(),
            language=result.get("language", "unknown"),
        )

    except Exception as exc:
        raise TranscriptionError(str(exc)) from exc

    finally:
        if audio_path.exists():
            audio_path.unlink(missing_ok=True)
