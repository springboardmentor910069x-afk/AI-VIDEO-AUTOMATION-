import subprocess
import tempfile
import shutil
from pathlib import Path

from app.core.config import get_settings
from app.schemas.ai import TranscriptRead, TranscriptSegment


def _clean_title(path: str) -> str:
    title = Path(path).stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(title.split()) or "uploaded video"


def _probe_duration(path: str) -> float:
    try:
        ffprobe = shutil.which("ffprobe")
        if ffprobe is None:
            raise RuntimeError("ffprobe not installed")
        result = subprocess.run(
            [
                ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        return max(0.0, float(result.stdout.strip() or 0))
    except Exception:
        pass
    try:
        import cv2

        capture = cv2.VideoCapture(path)
        frames = float(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        capture.release()
        return frames / fps if frames and fps else 0.0
    except Exception:
        return 0.0


def _sample_visual_profile(path: str) -> str:
    try:
        import cv2

        capture = cv2.VideoCapture(path)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        sample_positions = [0.15, 0.5, 0.85]
        brightness: list[float] = []
        motion_scores: list[float] = []
        previous_gray = None
        for position in sample_positions:
            if frame_count:
                capture.set(cv2.CAP_PROP_POS_FRAMES, int(frame_count * position))
            ok, frame = capture.read()
            if not ok:
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness.append(float(gray.mean()))
            if previous_gray is not None:
                diff = cv2.absdiff(gray, previous_gray)
                motion_scores.append(float(diff.mean()))
            previous_gray = gray
        capture.release()
        if not brightness:
            return "The visual track could not be sampled clearly."
        light = "bright" if sum(brightness) / len(brightness) > 120 else "low-light"
        motion = "noticeable scene changes" if motion_scores and sum(motion_scores) / len(motion_scores) > 18 else "steady visuals"
        return f"The video appears {light} with {motion} across sampled frames."
    except Exception:
        return "Visual sampling was unavailable, so the analysis focuses on metadata and audio."


def _split_segments(video_id: str, full_text: str, duration: float) -> TranscriptRead:
    sentences = [item.strip() for item in full_text.replace("\n", " ").split(".") if item.strip()]
    if not sentences:
        sentences = [full_text]
    total = max(duration, float(len(sentences) * 12))
    step = max(6.0, total / len(sentences))
    segments = [
        TranscriptSegment(start=round(index * step, 2), end=round(min(total, (index + 1) * step), 2), text=sentence + ".")
        for index, sentence in enumerate(sentences)
    ]
    return TranscriptRead(video_id=video_id, full_text=" ".join(segment.text for segment in segments), segments=segments, language="en")


def _duration_label(duration: float) -> str:
    if not duration:
        return "unknown"
    if duration < 90:
        return f"{round(duration)} seconds"
    return f"{round(duration / 60)} minutes"


class TranscriptionService:
    def __init__(self) -> None:
        self.last_provider_error: str | None = None

    async def transcribe(self, video_id: str, file_path: str, title: str | None = None) -> TranscriptRead:
        settings = get_settings()
        duration = _probe_duration(file_path)
        if settings.ai_provider.lower() == "groq" and settings.groq_api_key:
            transcript = await self._transcribe_with_groq(video_id, file_path, duration)
            if transcript:
                return transcript
        if settings.ai_provider.lower() == "openai" and settings.openai_api_key:
            transcript = await self._transcribe_with_openai(video_id, file_path, duration)
            if transcript:
                return transcript
        title = title or _clean_title(file_path)
        visual_profile = _sample_visual_profile(file_path)
        runtime = _duration_label(duration)
        provider = settings.ai_provider.upper()
        provider_note = (
            f" {provider} transcription was configured but could not run: {self.last_provider_error}."
            if self.last_provider_error
            else " No speech transcript provider is configured, so this is a metadata and visual-analysis draft."
        )
        fallback = (
            f"This uploaded video is titled {title}. Its runtime is approximately {runtime}. "
            f"{visual_profile}{provider_note} "
            "Once the transcription provider is available, regenerate this video for a speech-accurate summary."
        )
        return _split_segments(video_id, fallback, duration)

    async def _transcribe_with_groq(self, video_id: str, file_path: str, duration: float) -> TranscriptRead | None:
        upload_path, cleanup_upload = self._prepare_upload_file(file_path)
        if upload_path is None:
            return None
        try:
            from groq import Groq

            client = Groq(api_key=get_settings().groq_api_key)
            with upload_path.open("rb") as audio:
                result = client.audio.transcriptions.create(
                    file=(upload_path.name, audio.read()),
                    model=get_settings().groq_transcription_model,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                    temperature=0.0,
                )
            return _transcript_from_provider_result(video_id, result, duration)
        except Exception as exc:
            self.last_provider_error = _provider_error(exc, provider="Groq")
            return None
        finally:
            if cleanup_upload:
                upload_path.unlink(missing_ok=True)

    async def _transcribe_with_openai(self, video_id: str, file_path: str, duration: float) -> TranscriptRead | None:
        upload_path, cleanup_upload = self._prepare_upload_file(file_path)
        if upload_path is None:
            return None
        try:
            from openai import OpenAI

            client = OpenAI(api_key=get_settings().openai_api_key)
            with upload_path.open("rb") as audio:
                result = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )
            return _transcript_from_provider_result(video_id, result, duration)
        except Exception as exc:
            self.last_provider_error = _provider_error(exc, provider="OpenAI")
            return None
        finally:
            if cleanup_upload:
                upload_path.unlink(missing_ok=True)
        return None

    def _prepare_upload_file(self, file_path: str) -> tuple[Path | None, bool]:
        audio_path = self._extract_audio(file_path)
        if audio_path is not None:
            return audio_path, True
        source = Path(file_path)
        if source.exists() and source.suffix.lower() in {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"} and source.stat().st_size <= 25 * 1024 * 1024:
            return source, False
        self.last_provider_error = "audio extraction failed and the file is too large or unsupported for direct upload"
        return None, False

    def _extract_audio(self, file_path: str) -> Path | None:
        try:
            ffmpeg = _ffmpeg_binary()
            target = Path(tempfile.gettempdir()) / f"{Path(file_path).stem}-clipmind-audio.mp3"
            subprocess.run(
                [ffmpeg, "-y", "-i", file_path, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", str(target)],
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )
            return target if target.exists() and target.stat().st_size > 0 else None
        except Exception:
            return None


def _transcript_from_provider_result(video_id: str, result: object, duration: float) -> TranscriptRead | None:
    raw_segments = getattr(result, "segments", None) or []
    if isinstance(raw_segments, list):
        segments = [
            TranscriptSegment(
                start=float(_segment_value(item, "start", 0)),
                end=float(_segment_value(item, "end", 0)),
                text=str(_segment_value(item, "text", "")).strip(),
            )
            for item in raw_segments
            if str(_segment_value(item, "text", "")).strip()
        ]
    else:
        segments = []
    full_text = str(getattr(result, "text", "") or "").strip()
    if not full_text and segments:
        full_text = " ".join(segment.text for segment in segments)
    if not segments and full_text:
        return _split_segments(video_id, full_text, duration)
    if full_text:
        return TranscriptRead(video_id=video_id, full_text=full_text, segments=segments, language=str(getattr(result, "language", "en") or "en"))
    return None


def _segment_value(item: object, key: str, default: object) -> object:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _provider_error(exc: Exception, provider: str) -> str:
    text = str(exc)
    lowered = text.lower()
    if "insufficient_quota" in lowered or "exceeded your current quota" in lowered:
        return f"{provider} quota is exhausted. Check billing, free-tier limits, or add credits"
    if "rate limit" in lowered or "429" in text:
        return f"{provider} rate limit reached. Wait a bit and regenerate"
    if "401" in text or "invalid_api_key" in lowered:
        return f"{provider} API key is invalid"
    if "connection error" in lowered:
        return f"{provider} network connection failed"
    return text[:240]


def _ffmpeg_binary() -> str:
    binary = shutil.which("ffmpeg")
    if binary:
        return binary
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError("ffmpeg is not installed") from exc
