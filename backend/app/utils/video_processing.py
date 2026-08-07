import json
import subprocess

from pathlib import Path


def get_video_duration(file_path: str) -> float:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {file_path}")

    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=duration",
        "-of", "json",
        file_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"ffprobe failed for {file_path}: {e.stderr.strip()}"
        ) from e
    except FileNotFoundError as e:
        raise RuntimeError(
            "ffprobe not found. Ensure FFmpeg is installed and on PATH."
        ) from e

    try:
        data = json.loads(result.stdout)
        duration = float(data["streams"][0]["duration"])
    except (KeyError, IndexError, ValueError, json.JSONDecodeError) as e:
        raise RuntimeError(
            f"Could not extract duration from {file_path}: {e}"
        ) from e

    return duration


def generate_thumbnail(file_path: str, output_path: str) -> None:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Video file not found: {file_path}")

    cmd = [
        "ffmpeg",
        "-y",
        "-i", file_path,
        "-ss", "5",
        "-vframes", "1",
        "-q:v", "2",
        output_path,
    ]

    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"Thumbnail generation failed for {file_path}: {e.stderr.strip()}"
        ) from e
    except FileNotFoundError as e:
        raise RuntimeError(
            "ffmpeg not found. Ensure FFmpeg is installed and on PATH."
        ) from e

    if not Path(output_path).exists():
        raise RuntimeError(
            f"Thumbnail was not created at {output_path}"
        )
