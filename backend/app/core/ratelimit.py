"""Lightweight, in-process brute-force / abuse protection for auth endpoints.

This is a simple sliding-window counter keyed by (IP, username) and by IP
alone. It is intentionally dependency-free and resets when the process
restarts, which is acceptable protection for a single-instance deployment.
For multi-instance setups, replace this with a shared store (Redis) or a
dedicated API gateway rate limiter.
"""

import time
import threading
from collections import deque

from fastapi import HTTPException, Request, status


_WINDOW_SECONDS = 300  # 5 minutes
_MAX_PER_IP = 20       # login+register attempts per 5 min per IP
_MAX_PER_USER = 8      # failed attempts per 5 min per username

_lock = threading.Lock()
_by_ip: dict[str, deque[float]] = {}
_by_user: dict[str, deque[float]] = {}


def _record(counter: dict[str, deque[float]], key: str, limit: int) -> None:
    now = time.monotonic()
    with _lock:
        bucket = counter.setdefault(key, deque())
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please try again later.",
            )
        bucket.append(now)


def _client_ip(request: Request) -> str:
    # Trust the proxy-forwarded address when present (set by nginx).
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_ip(request: Request) -> None:
    _record(_by_ip, _client_ip(request), _MAX_PER_IP)


def auth_ip_rate_limit(request: Request) -> None:
    """FastAPI-compatible dependency: throttle a source IP on auth endpoints."""
    _enforce_ip(request)


def rate_limit_username(username: str) -> None:
    """Throttle attempts for a single username (call inside the handler)."""
    if not username:
        return
    _record(_by_user, username.lower(), _MAX_PER_USER)


def reset_username(username: str) -> None:
    """Clear the throttle for a username after a successful login."""
    if not username:
        return
    with _lock:
        _by_user.pop(username.lower(), None)
