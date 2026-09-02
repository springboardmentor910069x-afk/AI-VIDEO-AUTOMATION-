import json
from pathlib import Path
import shutil

from pydantic import BaseModel

from app.core.config import get_settings
from app.schemas.ai import AnalyticsRead, KeyMoment, SummaryRead, TranscriptRead, VideoMetadata

TRANSCRIPTS: dict[str, TranscriptRead] = {}
SUMMARIES: dict[str, SummaryRead] = {}
KEY_MOMENTS: dict[str, list[KeyMoment]] = {}
ANALYTICS: dict[str, AnalyticsRead] = {}
VIDEO_METADATA: dict[str, VideoMetadata] = {}


def save_video_metadata(video_id: str, metadata: VideoMetadata) -> None:
    VIDEO_METADATA[video_id] = metadata
    directory = _document_dir(video_id)
    directory.mkdir(parents=True, exist_ok=True)
    _write_model(directory / "metadata.json", metadata)


def get_video_metadata(video_id: str) -> VideoMetadata | None:
    item = VIDEO_METADATA.get(video_id)
    if item is not None:
        return item
    item = _read_model(_document_dir(video_id) / "metadata.json", VideoMetadata)
    if item is not None:
        VIDEO_METADATA[video_id] = item
    return item


def save_video_documents(
    video_id: str,
    transcript: TranscriptRead,
    summary: SummaryRead,
    key_moments: list[KeyMoment],
    analytics: AnalyticsRead,
) -> None:
    TRANSCRIPTS[video_id] = transcript
    SUMMARIES[video_id] = summary
    KEY_MOMENTS[video_id] = key_moments
    ANALYTICS[video_id] = analytics

    directory = _document_dir(video_id)
    directory.mkdir(parents=True, exist_ok=True)
    _write_model(directory / "transcript.json", transcript)
    _write_model(directory / "summary.json", summary)
    _write_models(directory / "key_moments.json", key_moments)
    _write_model(directory / "analytics.json", analytics)


def get_transcript(video_id: str) -> TranscriptRead | None:
    item = TRANSCRIPTS.get(video_id)
    if item is not None:
        return item
    item = _read_model(_document_dir(video_id) / "transcript.json", TranscriptRead)
    if item is not None:
        TRANSCRIPTS[video_id] = item
    return item


def get_summary(video_id: str) -> SummaryRead | None:
    item = SUMMARIES.get(video_id)
    if item is not None:
        return item
    item = _read_model(_document_dir(video_id) / "summary.json", SummaryRead)
    if item is not None:
        SUMMARIES[video_id] = item
    return item


def get_key_moments(video_id: str) -> list[KeyMoment]:
    item = KEY_MOMENTS.get(video_id)
    if item is not None:
        return item
    item = _read_models(_document_dir(video_id) / "key_moments.json", KeyMoment)
    KEY_MOMENTS[video_id] = item
    return item


def get_analytics(video_id: str) -> AnalyticsRead | None:
    item = ANALYTICS.get(video_id)
    if item is not None:
        return item
    item = _read_model(_document_dir(video_id) / "analytics.json", AnalyticsRead)
    if item is not None:
        ANALYTICS[video_id] = item
    return item


def delete_video_documents(video_id: str) -> None:
    TRANSCRIPTS.pop(video_id, None)
    SUMMARIES.pop(video_id, None)
    KEY_MOMENTS.pop(video_id, None)
    ANALYTICS.pop(video_id, None)
    VIDEO_METADATA.pop(video_id, None)
    shutil.rmtree(_document_dir(video_id), ignore_errors=True)


def _document_dir(video_id: str) -> Path:
    safe_video_id = "".join(char for char in video_id if char.isalnum() or char in {"-", "_"})
    return get_settings().upload_dir / "ai_results" / safe_video_id


def _write_model(path: Path, model: BaseModel) -> None:
    path.write_text(model.model_dump_json(indent=2), encoding="utf-8")


def _write_models(path: Path, models: list[BaseModel]) -> None:
    path.write_text(json.dumps([model.model_dump(mode="json") for model in models], indent=2), encoding="utf-8")


def _read_model[T: BaseModel](path: Path, model_type: type[T]) -> T | None:
    if not path.exists():
        return None
    try:
        return model_type.model_validate_json(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _read_models[T: BaseModel](path: Path, model_type: type[T]) -> list[T]:
    if not path.exists():
        return []
    try:
        raw_items = json.loads(path.read_text(encoding="utf-8"))
        return [model_type.model_validate(item) for item in raw_items]
    except Exception:
        return []
