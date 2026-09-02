import json
import subprocess
import time

from pathlib import Path

from app.core.logging import logger

_FFMPEG_TIMEOUT_SECONDS = 300
_FFPROBE_TIMEOUT_SECONDS = 60


def generate_thumbnail(video_path: str, output_path: str) -> None:
    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cmd = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-ss", "2",
        "-vframes", "1",
        "-q:v", "2",
        output_path,
    ]

    try:
        subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=_FFMPEG_TIMEOUT_SECONDS,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"Thumbnail generation failed for {video_path}: {e.stderr.strip()}"
        ) from e
    except FileNotFoundError as e:
        raise RuntimeError(
            "ffmpeg not found. Ensure FFmpeg is installed and on PATH."
        ) from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(
            f"FFmpeg timed out after {_FFMPEG_TIMEOUT_SECONDS}s "
            f"generating thumbnail for {video_path}"
        ) from e

    if not Path(output_path).exists():
        raise RuntimeError(f"Thumbnail was not created at {output_path}")


def get_video_duration(video_path: str) -> float:
    path = Path(video_path)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=duration",
        "-of", "json",
        video_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=_FFPROBE_TIMEOUT_SECONDS,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"ffprobe failed for {video_path}: {e.stderr.strip()}"
        ) from e
    except FileNotFoundError as e:
        raise RuntimeError(
            "ffprobe not found. Ensure FFmpeg is installed and on PATH."
        ) from e
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(
            f"FFprobe timed out after {_FFPROBE_TIMEOUT_SECONDS}s "
            f"inspecting {video_path}"
        ) from e

    try:
        data = json.loads(result.stdout)
        duration = float(data["streams"][0]["duration"])
    except (KeyError, IndexError, ValueError, json.JSONDecodeError) as e:
        raise RuntimeError(
            f"Could not extract duration from {video_path}: {e}"
        ) from e

    return duration


def process_video(video_path: str) -> dict[str, str | float]:
    start = time.monotonic()

    path = Path(video_path)
    thumbnail_path = str(path.with_suffix(".jpg"))

    duration = get_video_duration(video_path)
    generate_thumbnail(video_path, thumbnail_path)

    elapsed = time.monotonic() - start
    logger.info(
        "[FFMPEG] Video processing (thumbnail + duration) completed in %.2fs",
        elapsed,
    )

    return {
        "thumbnail_path": thumbnail_path,
        "duration": duration,
    }
