import asyncio
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import groq
from groq import AsyncGroq

from app.core.config import get_settings
from app.core.logging import logger

# ============================================================
# Configuration
# ============================================================

GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo"
WHISPER_SAMPLE_RATE = 16000
AUDIO_CHANNELS = 1
_GROQ_MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB Groq Whisper payload limit
_GROQ_API_TIMEOUT_SECONDS = 120.0

_FFMPEG_TIMEOUT_SECONDS = 300
_FFPROBE_TIMEOUT_SECONDS = 60
_MAX_FFMPEG_STDERR_CHARS = 2000


# ============================================================
# Exceptions
# ============================================================

class WhisperServiceError(RuntimeError):
    """Base exception for transcription service."""


class ModelLoadError(WhisperServiceError):
    """Groq transcription client could not be initialized."""


class AudioExtractionError(WhisperServiceError):
    """Audio could not be extracted from the video."""


class TranscriptionError(WhisperServiceError):
    """Transcription failed."""


TranscriptQualityError = TranscriptionError


# ============================================================
# Helper Functions
# ============================================================

def _compute_unique_word_ratio(text: str) -> float:
    """
    Computes the ratio of unique words to total words in a text snippet.
    Used for assessing transcript quality / detecting loops.
    """
    if not text or not text.strip():
        return 0.0

    words = re.findall(r"\b\w+\b", text.lower())
    if not words:
        return 0.0

    unique_words = set(words)
    return len(unique_words) / len(words)


def _clean_hallucination_loops(text: str) -> str:
    """
    Cleans repeated phrase loops (hallucinations) common in Whisper output.
    """
    if not text:
        return ""

    words = text.split()
    if not words:
        return ""

    cleaned_words = []
    i = 0
    n = len(words)

    while i < n:
        found_loop = False
        for seq_len in range(1, 11):
            if i + 3 * seq_len <= n:
                seq1 = words[i : i + seq_len]
                seq2 = words[i + seq_len : i + 2 * seq_len]
                seq3 = words[i + 2 * seq_len : i + 3 * seq_len]

                if seq1 == seq2 == seq3:
                    cleaned_words.extend(seq1)
                    i += seq_len
                    while i + seq_len <= n and words[i : i + seq_len] == seq1:
                        i += seq_len
                    found_loop = True
                    break

        if not found_loop:
            cleaned_words.append(words[i])
            i += 1

    return " ".join(cleaned_words)


# ============================================================
# Result model
# ============================================================

@dataclass(slots=True)
class TranscriptionResult:
    transcript: str
    language: str
    segments: list[dict[str, float | str]] = field(default_factory=list)


# ============================================================
# Async Groq client
# ============================================================

_client: AsyncGroq | None = None


async def get_client() -> AsyncGroq:
    """Create and cache the AsyncGroq client."""
    global _client

    if _client is not None:
        return _client

    settings = get_settings()
    api_key = settings.groq_api_key

    if not api_key:
        raise ModelLoadError(
            "GROQ_API_KEY is not configured in the environment."
        )

    try:
        _client = AsyncGroq(
            api_key=api_key,
            timeout=_GROQ_API_TIMEOUT_SECONDS,
        )
        logger.info(
            "AsyncGroq transcription client initialized "
            "(timeout=%.1fs).",
            _GROQ_API_TIMEOUT_SECONDS,
        )
    except Exception as exc:
        logger.error(
            "Failed to initialize AsyncGroq client: %s",
            str(exc),
            exc_info=True,
        )
        raise ModelLoadError("Unable to initialize AsyncGroq client.") from exc

    return _client


# ============================================================
# Audio stream detection
# ============================================================

def has_audio_stream(media_path: str) -> bool:
    """Check whether the video contains an audio stream."""
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "a",
        "-show_entries",
        "stream=index",
        "-of",
        "json",
        media_path,
    ]

    logger.info("Checking audio stream: %s", media_path)

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=_FFPROBE_TIMEOUT_SECONDS,
        )
    except FileNotFoundError as exc:
        raise AudioExtractionError(
            "FFprobe is not installed or not available in PATH. "
            "Please install FFmpeg: https://ffmpeg.org/download.html"
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
    except ValueError as exc:
        raise AudioExtractionError(
            "FFprobe returned invalid JSON."
        ) from exc

    streams = data.get("streams") or []
    return len(streams) > 0


# ============================================================
# Audio extraction (video -> WAV for intermediate processing)
# ============================================================

def extract_audio(video_path: str, audio_path: str) -> None:
    """Extract mono 16 kHz WAV audio from the video."""
    video = Path(video_path)
    audio = Path(audio_path)

    logger.info("Extracting audio: %s -> %s", video_path, audio_path)

    if not video.exists():
        raise AudioExtractionError(f"Video not found: {video_path}")

    if not has_audio_stream(str(video)):
        raise AudioExtractionError(
            f"Video does not contain an audio stream: {video_path}"
        )

    command = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vn",
        "-ac",
        str(AUDIO_CHANNELS),
        "-ar",
        str(WHISPER_SAMPLE_RATE),
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        audio_path,
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
            "FFmpeg is not installed or not available in PATH. "
            "Please install FFmpeg: https://ffmpeg.org/download.html"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise AudioExtractionError(
            "FFmpeg audio extraction timed out."
        ) from exc

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip() or "unknown error"
        raise AudioExtractionError(
            f"FFmpeg failed to extract audio: {stderr[:_MAX_FFMPEG_STDERR_CHARS]}"
        )

    if not audio.exists():
        raise AudioExtractionError(
            "Audio extraction failed: output WAV was not created."
        )

    try:
        size = audio.stat().st_size
    except OSError as exc:
        raise AudioExtractionError(
            f"Cannot inspect extracted audio: {audio}"
        ) from exc

    if size == 0:
        raise AudioExtractionError(
            "Audio extraction failed: output WAV is empty."
        )

    logger.info("Audio extraction successful: %s (%d bytes)", audio_path, size)


# ============================================================
# Audio conversion (WAV -> MP3) for efficient Groq upload
# ============================================================

def _convert_wav_to_mp3(wav_path: str, mp3_path: str) -> None:
    """Convert WAV to MP3 for efficient upload to Groq."""
    logger.info("Converting WAV to MP3: %s -> %s", wav_path, mp3_path)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        wav_path,
        "-vn",
        "-ac",
        str(AUDIO_CHANNELS),
        "-ar",
        str(WHISPER_SAMPLE_RATE),
        "-b:a",
        "128k",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        mp3_path,
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
            "FFmpeg WAV-to-MP3 conversion timed out."
        ) from exc

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip() or "unknown error"
        raise AudioExtractionError(
            f"FFmpeg failed to convert WAV to MP3: "
            f"{stderr[:_MAX_FFMPEG_STDERR_CHARS]}"
        )

    mp3 = Path(mp3_path)

    if not mp3.exists():
        raise AudioExtractionError(
            "MP3 conversion failed: output file was not created."
        )

    try:
        size = mp3.stat().st_size
    except OSError as exc:
        raise AudioExtractionError(
            f"Cannot inspect converted audio: {mp3_path}"
        ) from exc

    if size == 0:
        raise AudioExtractionError(
            "MP3 conversion failed: output file is empty."
        )

    logger.info(
        "MP3 conversion successful: %s (%d bytes)",
        mp3_path,
        size,
    )


# ============================================================
# Audio compression (MP3 -> lower bitrate MP3) for 25 MB limit
# ============================================================

def _compress_mp3(mp3_path: str, compressed_path: str) -> None:
    """Compress an MP3 to a lower bitrate to fit within Groq's 25 MB limit."""
    logger.info(
        "Compressing MP3: %s -> %s",
        mp3_path,
        compressed_path,
    )

    command = [
        "ffmpeg",
        "-y",
        "-i",
        mp3_path,
        "-vn",
        "-ac",
        str(AUDIO_CHANNELS),
        "-ar",
        "16000",
        "-b:a",
        "48k",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "6",
        compressed_path,
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
            "FFmpeg MP3 compression timed out."
        ) from exc

    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip() or "unknown error"
        raise AudioExtractionError(
            f"FFmpeg failed to compress MP3: "
            f"{stderr[:_MAX_FFMPEG_STDERR_CHARS]}"
        )

    compressed = Path(compressed_path)

    if not compressed.exists():
        raise AudioExtractionError(
            "Audio compression failed: output file was not created."
        )

    try:
        size = compressed.stat().st_size
    except OSError as exc:
        raise AudioExtractionError(
            f"Cannot inspect compressed audio: {compressed_path}"
        ) from exc

    if size == 0:
        raise AudioExtractionError(
            "Audio compression failed: output file is empty."
        )

    if size > _GROQ_MAX_AUDIO_BYTES:
        raise AudioExtractionError(
            f"Compressed audio ({size / (1024*1024):.1f} MB) still exceeds "
            f"Groq's {_GROQ_MAX_AUDIO_BYTES / (1024*1024):.0f} MB limit. "
            "The recording may be too long for transcription."
        )

    logger.info(
        "Audio compression successful: %s (%d bytes)",
        compressed_path,
        size,
    )


# ============================================================
# Groq transcription (async)
# ============================================================

async def _transcribe_with_groq(audio_path: str):
    """Send audio to Groq Whisper and return the API response."""
    client = await get_client()

    audio_file = Path(audio_path)
    if not audio_file.exists():
        raise TranscriptionError(
            f"Audio file not found for transcription: {audio_path}"
        )

    suffix = audio_file.suffix.lower()
    mime_map = {
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
        ".ogg": "audio/ogg",
        ".flac": "audio/flac",
    }
    content_type = mime_map.get(suffix, "audio/mpeg")
    filename = audio_file.name

    logger.info(
        "Sending audio to Groq transcription API: %s (%d bytes, type=%s)",
        audio_path,
        audio_file.stat().st_size,
        content_type,
    )

    try:
        with open(audio_path, "rb") as audio_file_handle:
            file_tuple = (filename, audio_file_handle, content_type)
            transcription = await client.audio.transcriptions.create(
                model=GROQ_TRANSCRIPTION_MODEL,
                file=file_tuple,
                response_format="verbose_json",
                timestamp_granularities=["segment"],
            )

        logger.info("Groq transcription API call completed successfully.")
        return transcription

    except groq.APIConnectionError as e:
        logger.error(
            "Groq API Error: %s",
            str(e),
            exc_info=True,
        )
        raise TranscriptionError(
            f"Cannot connect to Groq API: {e}"
        ) from e

    except groq.RateLimitError as e:
        logger.error(
            "Groq API Error: %s",
            str(e),
            exc_info=True,
        )
        raise TranscriptionError(
            f"Groq rate limit exceeded. Please try again later: {e}"
        ) from e

    except groq.APIStatusError as e:
        logger.error(
            "Groq API Error: %s",
            str(e),
            exc_info=True,
        )
        raise TranscriptionError(
            f"Groq API error (HTTP {e.status_code}): {e.message}"
        ) from e

    except Exception as e:
        logger.error(
            "Groq API Error: %s",
            str(e),
            exc_info=True,
        )
        raise TranscriptionError(
            f"Groq transcription failed: {e}"
        ) from e


# ============================================================
# Main transcription function
# ============================================================

async def transcribe_video(video_path: str) -> TranscriptionResult:
    """Extract audio from video and transcribe it using Groq Whisper.

    Pipeline:
        1. FFmpeg extracts mono 16 kHz WAV from the video
        2. WAV is converted to MP3 (128 kbps) for efficient upload
        3. If MP3 exceeds 25 MB, compress to 48 kbps MP3
        4. Send to Groq Whisper API for transcription
        5. Clean hallucination loops from the result
    """
    video = Path(video_path)

    if not video.exists():
        raise TranscriptionError(f"Video file not found: {video_path}")

    wav_path = video.with_suffix(".wav")
    mp3_path = video.with_suffix(".mp3")
    compressed_path = video.parent / f"{video.stem}_compressed.mp3"
    final_audio = None

    logger.info("Starting transcription pipeline: %s", video_path)

    try:
        # -------------------------------------------------
        # Step 1: Extract audio to WAV (intermediate)
        # -------------------------------------------------
        logger.info("[Step 1] Extracting audio from video to WAV...")
        await asyncio.to_thread(
            extract_audio,
            str(video),
            str(wav_path),
        )

        if not wav_path.exists():
            raise TranscriptionError("Extracted audio file is missing.")

        wav_size = wav_path.stat().st_size
        if wav_size == 0:
            raise TranscriptionError("Extracted audio file is empty.")

        logger.info(
            "Audio extracted to WAV: %s (%d bytes)",
            wav_path,
            wav_size,
        )

        # -------------------------------------------------
        # Step 2: Convert WAV to MP3
        # -------------------------------------------------
        logger.info("[Step 2] Converting WAV to MP3...")
        await asyncio.to_thread(
            _convert_wav_to_mp3,
            str(wav_path),
            str(mp3_path),
        )

        mp3_size = mp3_path.stat().st_size
        logger.info(
            "Converted to MP3: %s (%d bytes)",
            mp3_path,
            mp3_size,
        )

        # -------------------------------------------------
        # Step 3: Check 25 MB limit and compress if needed
        # -------------------------------------------------
        if mp3_size <= _GROQ_MAX_AUDIO_BYTES:
            logger.info(
                "MP3 within Groq limit (%d <= %d bytes). Sending directly.",
                mp3_size,
                _GROQ_MAX_AUDIO_BYTES,
            )
            final_audio = mp3_path
        else:
            logger.info(
                "MP3 exceeds Groq limit (%d > %d bytes). "
                "Compressing to lower bitrate...",
                mp3_size,
                _GROQ_MAX_AUDIO_BYTES,
            )
            await asyncio.to_thread(
                _compress_mp3,
                str(mp3_path),
                str(compressed_path),
            )
            final_audio = compressed_path
            logger.info(
                "Using compressed audio: %s (%d bytes)",
                final_audio,
                final_audio.stat().st_size,
            )

        # -------------------------------------------------
        # Step 4: Transcribe via Groq Whisper API
        # -------------------------------------------------
        logger.info("[Step 4] Sending audio to Groq Whisper API...")
        result = await _transcribe_with_groq(str(final_audio))

        if result is None:
            raise TranscriptionError(
                "Groq returned a null response. "
                "Check your API key and network connection."
            )

        text = (getattr(result, "text", None) or "").strip()

        if not text:
            raise TranscriptionError(
                "Groq returned an empty transcript. "
                "The audio may be silent or contain no "
                "recognizable speech."
            )

        text = _clean_hallucination_loops(text)

        language = getattr(result, "language", None) or "unknown"

        raw_segments = getattr(result, "segments", None) or []
        timestamped_segments: list[dict[str, float | str]] = []

        for segment in raw_segments:
            if hasattr(segment, "text"):
                segment_text = (getattr(segment, "text", None) or "").strip()
                start_value = getattr(segment, "start", 0)
                end_value = getattr(segment, "end", start_value)
            elif isinstance(segment, dict):
                segment_text = (segment.get("text") or "").strip()
                start_value = segment.get("start", 0)
                end_value = segment.get("end", start_value)
            else:
                continue

            if not segment_text:
                continue

            segment_text = _clean_hallucination_loops(segment_text)

            try:
                start = float(start_value or 0)
                end = float(end_value or start)
            except (TypeError, ValueError):
                continue

            if end < start:
                end = start

            timestamped_segments.append(
                {
                    "start": start,
                    "end": end,
                    "text": segment_text,
                }
            )

        logger.info(
            "Transcription completed successfully: language=%s "
            "segments=%d text_length=%d",
            language,
            len(timestamped_segments),
            len(text),
        )

        return TranscriptionResult(
            transcript=text,
            language=language,
            segments=timestamped_segments,
        )

    except WhisperServiceError:
        raise

    except Exception as exc:
        logger.error(
            "Unexpected transcription error for %s: %s",
            video_path,
            str(exc),
            exc_info=True,
        )
        raise TranscriptionError(
            f"Unexpected error during transcription: {exc}"
        ) from exc

    finally:
        for tmp in (wav_path, mp3_path, compressed_path):
            try:
                if tmp.exists():
                    tmp.unlink(missing_ok=True)
                    logger.debug("Removed temporary audio: %s", tmp)
            except OSError:
                logger.warning(
                    "Could not remove temporary audio: %s", tmp
                )
