from pathlib import Path


def extract_duration_seconds(path: str) -> float:
    try:
        from moviepy import VideoFileClip

        with VideoFileClip(path) as clip:
            return float(clip.duration or 0)
    except Exception:
        return 0.0


def thumbnail_path(video_id: str, second: float) -> str:
    return f"/static/thumbnails/{video_id}-{int(second)}.jpg"


def is_video_file(path: str) -> bool:
    return Path(path).exists()

