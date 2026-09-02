from pathlib import Path
import re
import shutil
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import UploadFile
import httpx

from app.core.config import get_settings
from app.schemas.ai import VideoMetadata

ALLOWED_VIDEO_MIME = {
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
}

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def validate_video(file: UploadFile) -> None:
    if file.content_type not in ALLOWED_VIDEO_MIME:
        raise ValueError("Unsupported video format")


async def save_upload(file: UploadFile) -> tuple[str, int]:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    target = settings.upload_dir / f"{uuid4()}{suffix}"
    size = 0
    max_bytes = settings.max_upload_mb * 1024 * 1024
    with target.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > max_bytes:
                target.unlink(missing_ok=True)
                raise ValueError("Upload exceeds size limit")
            output.write(chunk)
    return str(target), size


async def save_video_link(video_url: str) -> tuple[str, int, str, VideoMetadata]:
    parsed = urlparse(video_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Valid video link daalo. Link http/https se start hona chahiye.")

    try:
        return await _save_with_ytdlp(video_url)
    except ImportError as exc:
        return await _save_direct_video_url(video_url, str(exc))
    except Exception as exc:
        yt_dlp_error = _clean_error(str(exc))
        if "403" in yt_dlp_error or "Forbidden" in yt_dlp_error:
            raise ValueError(
                "YouTube ne is video download request ko block kar diya (HTTP 403). "
                "Backend restart karke dobara try karo; agar phir bhi aaye to ye video cookies/login-protected ho sakti hai. "
                "Tab video file manually upload karo ya direct .mp4/.webm link use karo."
            ) from exc
        try:
            return await _save_direct_video_url(video_url, yt_dlp_error)
        except ValueError as fallback_exc:
            raise ValueError(f"Video link download nahi ho paaya: {_clean_error(str(fallback_exc))}") from exc


async def _save_with_ytdlp(video_url: str) -> tuple[str, int, str, VideoMetadata]:
    from yt_dlp import YoutubeDL

    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    output_template = str(settings.upload_dir / f"{uuid4()}.%(ext)s")
    max_bytes = settings.max_upload_mb * 1024 * 1024

    def download() -> tuple[str, int, str, VideoMetadata]:
        options = {
            "outtmpl": output_template,
            "format": "18/best[height<=720][ext=mp4]/best[ext=mp4]/best/bv*[ext=mp4]+ba[ext=m4a]/bv*+ba/b",
            "ffmpeg_location": _ffmpeg_binary(),
            "merge_output_format": "mp4",
            "noplaylist": True,
            "geo_bypass": True,
            "force_ipv4": True,
            "quiet": True,
            "no_warnings": True,
            "retries": 3,
            "fragment_retries": 3,
            "max_filesize": max_bytes,
            "http_headers": {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/127.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.youtube.com/",
            },
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"],
                }
            },
        }
        with YoutubeDL(options) as downloader:
            info = downloader.extract_info(video_url, download=True)
            path = Path(downloader.prepare_filename(info))
            if not path.exists():
                merged = path.with_suffix(".mp4")
                if merged.exists():
                    path = merged
            if not path.exists():
                raise ValueError("Downloaded video file nahi mila.")
            size = path.stat().st_size
            if size > max_bytes:
                path.unlink(missing_ok=True)
                raise ValueError("Downloaded video size limit se zyada hai.")
            suffix = path.suffix.lower()
            if suffix not in ALLOWED_VIDEO_EXTENSIONS:
                raise ValueError("Downloaded link ka video format supported nahi hai.")
            mime_type = "video/mp4" if suffix == ".mp4" else f"video/{suffix.lstrip('.')}"
            metadata = VideoMetadata(
                source_url=video_url,
                platform="youtube" if "youtube" in (info.get("extractor_key", "").lower()) else info.get("extractor_key"),
                channel_name=info.get("channel") or info.get("uploader"),
                channel_url=info.get("channel_url") or info.get("uploader_url"),
                uploader=info.get("uploader"),
                artist=info.get("artist") or info.get("creator"),
                track=info.get("track"),
                title=info.get("title"),
                description=(info.get("description") or "")[:4000] or None,
                webpage_url=info.get("webpage_url") or video_url,
            )
            return str(path), size, mime_type, metadata

    import asyncio

    return await asyncio.to_thread(download)


def _ffmpeg_binary() -> str:
    binary = shutil.which("ffmpeg")
    if binary:
        return binary
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise RuntimeError("ffmpeg is not installed") from exc


def _clean_error(message: str) -> str:
    message = re.sub(r"\x1b\[[0-9;]*m", "", message)
    return " ".join(message.split())


async def _save_direct_video_url(video_url: str, reason: str = "") -> tuple[str, int, str, VideoMetadata]:
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(urlparse(video_url).path).suffix.lower()
    if suffix not in ALLOWED_VIDEO_EXTENSIONS:
        details = f" ({reason})" if reason else ""
        raise ValueError(f"Direct video file link ya yt-dlp supported link chahiye{details}")

    target = settings.upload_dir / f"{uuid4()}{suffix}"
    max_bytes = settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
            async with client.stream("GET", video_url) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "video/mp4").split(";")[0]
                with target.open("wb") as output:
                    async for chunk in response.aiter_bytes(1024 * 1024):
                        size += len(chunk)
                        if size > max_bytes:
                            target.unlink(missing_ok=True)
                            raise ValueError("Downloaded video size limit se zyada hai.")
                        output.write(chunk)
    except httpx.HTTPError as exc:
        target.unlink(missing_ok=True)
        raise ValueError("Direct video link reachable nahi hai.") from exc
    return str(target), size, content_type, VideoMetadata(source_url=video_url, platform="direct-link", webpage_url=video_url)
