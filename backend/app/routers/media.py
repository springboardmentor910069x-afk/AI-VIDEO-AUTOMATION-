import mimetypes
import os
import uuid
from hashlib import md5

from email.utils import formatdate, parsedate_to_datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import FileResponse, Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.tokens import create_media_token, decode_media_token, decode_token
from app.core.config import get_settings
from app.core.logging import logger
from app.database.dependencies import get_db
from app.models.user import User
from app.models.video import Video
from app.schemas.media import MediaTokenRead
from app.services.video_service import get_video_by_id

settings = get_settings()

router = APIRouter(prefix="/videos", tags=["Media"])


async def _user_from_token(token: str, db: AsyncSession) -> User | None:
    """Resolve a Bearer token to an active user without reusing the request dependency."""
    payload = decode_token(token)
    if payload is None:
        return None
    user_id = payload.get("sub")
    if user_id is None:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return None
    return user


async def _authorize_media_access(
    db: AsyncSession,
    video_id: uuid.UUID,
    media_token: str | None,
    authorization: str | None,
) -> Video:
    video = await get_video_by_id(db, video_id)
    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    # Preferred path: a short-lived signed token issued by /media-token. Browsers
    # use this for <video> and <img> tags, which cannot send Authorization headers.
    if media_token:
        payload = decode_media_token(media_token)
        if payload and str(payload.get("sub")) == str(video_id):
            return video

    # Fallback for API clients: classic Bearer token + ownership check.
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        user = await _user_from_token(token, db)
        if user is not None and video.uploaded_by == user.id:
            return video

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required to access this media",
        headers={"WWW-Authenticate": "Bearer"},
    )


_UNSATISFIABLE = "unsatisfiable"


def _parse_range(range_header: str, size: int) -> tuple[int, int] | str | None:
    """Parse a single `bytes=...` Range header.

    Returns:
      - (start, end) inclusive for a satisfiable single range
      - "unsatisfiable" when the range starts past the end of the file
      - None when the header should be ignored (serve the full file)
    """
    if not range_header.lower().startswith("bytes="):
        return None
    spec = range_header[6:].strip()
    if "," in spec:
        return None
    if "-" not in spec:
        return None
    start_str, end_str = spec.split("-", 1)
    try:
        if start_str == "":
            suffix = int(end_str)
            if suffix <= 0:
                return None
            start = max(0, size - suffix)
            end = size - 1
        else:
            start = int(start_str)
            end = int(end_str) if end_str else size - 1
    except ValueError:
        return None

    if start >= size:
        return _UNSATISFIABLE
    if end >= size:
        end = size - 1
    if end < start:
        return None
    return start, end


def _if_range_matches(if_range: str, etag: str, last_modified: float) -> bool:
    """If-Range allows the Range header only when the resource is unchanged."""
    value = if_range.strip()
    if value.startswith('"') or value.startswith("W/"):
        return value == etag
    try:
        dt = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return False
    return int(dt.timestamp()) == int(last_modified)


def _stream_range(path: str, start: int, end: int):
    length = end - start + 1
    with open(path, "rb") as file:
        file.seek(start)
        remaining = length
        while remaining > 0:
            chunk = file.read(min(64 * 1024, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def _file_response(
    path: str,
    range_header: str | None = None,
    if_range_header: str | None = None,
) -> Response:
    """File response with HTTP byte-range support for video streaming.

    HTML5 <video> sends `Range: bytes=0-` and expects a 206 Partial Content
    response with Content-Range/Accept-Ranges; the installed Starlette's
    FileResponse does not handle Range headers, so it is handled here.
    """
    stat_result = os.stat(path)
    size = stat_result.st_size
    media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    etag = f'"{md5(f"{stat_result.st_mtime}-{size}".encode()).hexdigest()}"'
    last_modified = formatdate(stat_result.st_mtime, usegmt=True)

    base_headers = {
        "accept-ranges": "bytes",
        "content-type": media_type,
        "etag": etag,
        "last-modified": last_modified,
    }

    start, end, partial = 0, size - 1, False

    if range_header and if_range_header:
        if not _if_range_matches(if_range_header, etag, stat_result.st_mtime):
            range_header = None

    if range_header:
        parsed = _parse_range(range_header, size)
        if parsed == _UNSATISFIABLE:
            headers = dict(base_headers)
            headers["content-range"] = f"bytes */{size}"
            return Response(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, headers=headers)
        if parsed is not None:
            start, end = parsed
            partial = True

    if partial:
        headers = dict(base_headers)
        headers["content-range"] = f"bytes {start}-{end}/{size}"
        headers["content-length"] = str(end - start + 1)
        logger.info(
            "Serving media range %s-%s/%s for %s",
            start, end, size, path,
        )
        return StreamingResponse(
            _stream_range(path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            media_type=media_type,
            headers=headers,
        )

    headers = dict(base_headers)
    headers["content-length"] = str(size)
    logger.info("Serving full media (%s bytes) for %s", size, path)
    return FileResponse(
        path,
        media_type=media_type,
        headers=headers,
        stat_result=stat_result,
    )


@router.post(
    "/{video_id}/media-token",
    response_model=MediaTokenRead,
    status_code=status.HTTP_201_CREATED,
)
async def issue_media_token(
    video_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = await get_video_by_id(db, video_id)

    if video is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found",
        )

    if video.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this video",
        )

    token = create_media_token(str(video.id))

    return MediaTokenRead(
        token=token,
        expires_in=settings.MEDIA_TOKEN_EXPIRE_HOURS * 3600,
    )


@router.get("/{video_id}/media")
async def serve_video_media(
    video_id: uuid.UUID,
    media_token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
    range: str | None = Header(default=None),
    if_range: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    video = await _authorize_media_access(db, video_id, media_token, authorization)

    path = video.file_path
    if not path or not os.path.exists(path):
        logger.warning("Media file missing for video %s: %s", video_id, path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found",
        )

    return _file_response(path, range_header=range, if_range_header=if_range)


@router.get("/{video_id}/thumbnail")
async def serve_video_thumbnail(
    video_id: uuid.UUID,
    media_token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
    range: str | None = Header(default=None),
    if_range: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    video = await _authorize_media_access(db, video_id, media_token, authorization)

    path = video.thumbnail_path
    if not path or not os.path.exists(path):
        logger.warning("Thumbnail missing for video %s: %s", video_id, path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail not found",
        )

    return _file_response(path, range_header=range, if_range_header=if_range)
