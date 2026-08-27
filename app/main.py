from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import shutil
import sqlite3
import subprocess
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import jwt
from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.analysis import (
    analyze_content_insights,
    detect_key_moments,
    export_transcript_srt,
    export_transcript_vtt,
    extract_keywords_rake,
    extract_or_generate_segments,
    format_timestamp,
    generate_highlight_report,
)

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "uploads"
THUMBNAILS = ROOT / "thumbnails"
for directory in (UPLOADS, THUMBNAILS):
    directory.mkdir(exist_ok=True)

DB_PATH = Path(os.getenv("DATABASE_URL", "sqlite:///./clipmind.db").replace("sqlite:///", ""))
if not DB_PATH.is_absolute():
    DB_PATH = ROOT / DB_PATH
JWT_SECRET = os.getenv("JWT_SECRET", "development-secret-change-me")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "500")) * 1024 * 1024
ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo", "video/x-matroska"}
ALLOWED_SUFFIXES = {".mp4", ".mov", ".webm", ".avi", ".mkv"}
ROLES = {"creator", "learner", "educator", "admin"}
bearer = HTTPBearer()

app = FastAPI(title="ClipMind AI", version="0.3.0", description="Video Summarization, Key Moments Detection & Analytics Dashboard Platform")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def initialize_database() -> None:
    with db() as connection:
        connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, original_name TEXT NOT NULL,
          stored_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
          status TEXT NOT NULL, duration_seconds REAL, resolution TEXT,
          processing_error TEXT, thumbnail_name TEXT, created_at TEXT NOT NULL,
          FOREIGN KEY(owner_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_videos_owner ON videos(owner_id);
        CREATE TABLE IF NOT EXISTS transcripts (
          id TEXT PRIMARY KEY, video_id TEXT NOT NULL UNIQUE, content TEXT NOT NULL,
          language TEXT, status TEXT NOT NULL, error TEXT, segments_json TEXT, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE TABLE IF NOT EXISTS summaries (
          id TEXT PRIMARY KEY, video_id TEXT NOT NULL, summary_type TEXT NOT NULL,
          content TEXT NOT NULL, created_at TEXT NOT NULL,
          UNIQUE(video_id, summary_type), FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE TABLE IF NOT EXISTS key_moments (
          id TEXT PRIMARY KEY, video_id TEXT NOT NULL, start_time REAL NOT NULL,
          end_time REAL NOT NULL, label TEXT NOT NULL, summary TEXT NOT NULL,
          importance_score REAL NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL,
          FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE INDEX IF NOT EXISTS idx_moments_video ON key_moments(video_id);
        CREATE TABLE IF NOT EXISTS video_keywords (
          id TEXT PRIMARY KEY, video_id TEXT NOT NULL, keyword TEXT NOT NULL,
          score REAL NOT NULL, frequency INTEGER NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL,
          FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE INDEX IF NOT EXISTS idx_keywords_video ON video_keywords(video_id);
        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, video_id TEXT NOT NULL,
          item_type TEXT NOT NULL, item_id TEXT, title TEXT NOT NULL,
          content TEXT NOT NULL, timestamp_start REAL, timestamp_end REAL, created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
        CREATE TABLE IF NOT EXISTS activity_logs (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, video_id TEXT,
          activity_type TEXT NOT NULL, details TEXT, created_at TEXT NOT NULL,
          FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
        """)

        # Migration check: add segments_json column to transcripts if not exists
        cursor = connection.execute("PRAGMA table_info(transcripts)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "segments_json" not in columns:
            try:
                connection.execute("ALTER TABLE transcripts ADD COLUMN segments_json TEXT")
            except Exception:
                pass


@app.on_event("startup")
def startup() -> None:
    initialize_database()


def now() -> str:
    return datetime.now(UTC).isoformat()


def log_activity(user_id: str, activity_type: str, video_id: str | None = None, details: dict | None = None) -> None:
    """Record platform events for analytics and audit trails."""
    try:
        with db() as connection:
            connection.execute(
                "INSERT INTO activity_logs (id, user_id, video_id, activity_type, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), user_id, video_id, activity_type, json.dumps(details or {}), now())
            )
    except Exception:
        pass


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 310_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, expected = stored.split("$", 1)
    return hmac.compare_digest(password_hash(password, salt), stored)


def issue_token(user: sqlite3.Row) -> str:
    return jwt.encode({"sub": user["id"], "role": user["role"], "exp": datetime.now(UTC) + timedelta(hours=8)}, JWT_SECRET, algorithm="HS256")


def get_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> sqlite3.Row:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except (jwt.PyJWTError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    return user


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Literal["creator", "learner", "educator", "admin"] = "creator"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class RoleUpdateInput(BaseModel):
    role: Literal["creator", "learner", "educator", "admin"]


class BookmarkCreateInput(BaseModel):
    video_id: str
    item_type: Literal["summary", "key_moment", "transcript_segment", "study_note"]
    item_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10000)
    timestamp_start: float | None = None
    timestamp_end: float | None = None


def user_data(user: sqlite3.Row) -> dict:
    return {key: user[key] for key in ("id", "email", "name", "role", "created_at")}


@app.get("/api/health")
def health():
    return {"status": "ok", "milestone": "milestone-3", "version": "0.3.0"}


@app.post("/api/auth/register", status_code=201)
def register(data: RegisterInput):
    user_id = str(uuid.uuid4())
    with db() as connection:
        if connection.execute("SELECT 1 FROM users WHERE email = ?", (data.email.lower(),)).fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        connection.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", (user_id, data.email.lower(), data.name.strip(), password_hash(data.password), data.role, now()))
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    log_activity(user_id, "user_register", details={"role": data.role})
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user_data(user)}


@app.post("/api/auth/login")
def login(data: LoginInput):
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    log_activity(user["id"], "user_login")
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user_data(user)}


@app.get("/api/auth/me")
def me(user: sqlite3.Row = Depends(get_user)):
    return user_data(user)


def serialize_video(video: sqlite3.Row) -> dict:
    return dict(video)


def process_video(video_id: str, source: Path) -> None:
    """Use FFmpeg/ffprobe to produce media metadata and a thumbnail."""
    status_value, duration, resolution, thumbnail, error = "ready", None, None, None, None
    try:
        probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,duration", "-of", "json", str(source)], capture_output=True, text=True, check=True, timeout=60)
        stream = json.loads(probe.stdout).get("streams", [{}])[0]
        duration = float(stream.get("duration") or 0)
        if stream.get("width") and stream.get("height"):
            resolution = f"{stream['width']}x{stream['height']}"
        thumbnail = f"{video_id}.jpg"
        subprocess.run(["ffmpeg", "-y", "-ss", "00:00:01", "-i", str(source), "-frames:v", "1", "-q:v", "3", str(THUMBNAILS / thumbnail)], capture_output=True, check=True, timeout=120)
    except FileNotFoundError:
        status_value, error = "needs_ffmpeg", "FFmpeg is not installed or is not on PATH."
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, json.JSONDecodeError, ValueError) as exc:
        status_value, error = "failed", f"Media processing failed: {str(exc)[:180]}"
    with db() as connection:
        connection.execute("UPDATE videos SET status=?, duration_seconds=?, resolution=?, thumbnail_name=?, processing_error=? WHERE id=?", (status_value, duration, resolution, thumbnail, error, video_id))


@app.post("/api/videos/upload", status_code=201)
async def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...), user: sqlite3.Row = Depends(get_user)):
    if user["role"] not in {"creator", "educator", "admin"}:
        raise HTTPException(status_code=403, detail="Your role cannot upload videos")
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES or (file.content_type and file.content_type not in ALLOWED_TYPES):
        raise HTTPException(status_code=415, detail="Only MP4, MOV, WebM, AVI, and MKV video files are supported")
    video_id = str(uuid.uuid4())
    stored_name = f"{video_id}{suffix}"
    target = UPLOADS / stored_name
    written = 0
    try:
        with target.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail=f"File exceeds the {MAX_UPLOAD_BYTES // 1024 // 1024} MB limit")
                destination.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    with db() as connection:
        connection.execute("INSERT INTO videos (id, owner_id, original_name, stored_name, mime_type, size_bytes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (video_id, user["id"], Path(file.filename).name, stored_name, file.content_type or "application/octet-stream", written, "processing", now()))
        video = connection.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()
    log_activity(user["id"], "video_upload", video_id=video_id, details={"filename": file.filename, "size_bytes": written})
    background_tasks.add_task(process_video, video_id, target)
    return serialize_video(video)


@app.get("/api/videos")
def list_videos(user: sqlite3.Row = Depends(get_user)):
    with db() as connection:
        if user["role"] in {"creator", "educator"}:
            rows = connection.execute("SELECT * FROM videos WHERE owner_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()
        else:
            rows = connection.execute("SELECT * FROM videos ORDER BY created_at DESC").fetchall()
    return [serialize_video(row) for row in rows]


def get_video_or_404(video_id: str) -> sqlite3.Row:
    with db() as connection:
        video = connection.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


def ensure_video_access(video: sqlite3.Row, user: sqlite3.Row, edit: bool = False) -> None:
    if user["role"] == "admin":
        return
    if edit and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only manage your own uploads")
    if not edit and user["role"] in {"creator", "educator"} and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own uploads")


def transcript_row(video_id: str) -> sqlite3.Row | None:
    with db() as connection:
        return connection.execute("SELECT * FROM transcripts WHERE video_id=?", (video_id,)).fetchone()


def run_full_nlp_analysis(video_id: str, transcript_text: str, segments: list[dict[str, Any]], duration_seconds: float) -> None:
    """Perform Key Moments detection, Keyword Extraction, and store into DB."""
    try:
        moments = detect_key_moments(transcript_text, segments, duration_seconds)
        keywords = extract_keywords_rake(transcript_text, top_n=20)
        with db() as connection:
            # Upsert moments
            connection.execute("DELETE FROM key_moments WHERE video_id=?", (video_id,))
            for m in moments:
                connection.execute(
                    "INSERT INTO key_moments (id, video_id, start_time, end_time, label, summary, importance_score, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), video_id, m["start_time"], m["end_time"], m["label"], m["summary"], m["importance_score"], m["category"], now())
                )
            # Upsert keywords
            connection.execute("DELETE FROM video_keywords WHERE video_id=?", (video_id,))
            for k in keywords:
                connection.execute(
                    "INSERT INTO video_keywords (id, video_id, keyword, score, frequency, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), video_id, k["keyword"], k["score"], k["frequency"], k["category"], now())
                )
    except Exception as exc:
        print(f"Error in automated NLP analysis for video {video_id}: {exc}")


def transcribe_video(video_id: str, source: Path) -> None:
    try:
        import whisper
        model = whisper.load_model(os.getenv("WHISPER_MODEL", "base"))
        result = model.transcribe(str(source), fp16=False)
        content = result.get("text", "").strip()
        if not content:
            raise ValueError("Whisper returned an empty transcript")

        raw_segments = result.get("segments", [])
        clean_segments = [
            {"start": round(float(s["start"]), 2), "end": round(float(s["end"]), 2), "text": s["text"].strip()}
            for s in raw_segments if s.get("text")
        ]
        if not clean_segments:
            with db() as connection:
                v = connection.execute("SELECT duration_seconds FROM videos WHERE id=?", (video_id,)).fetchone()
                dur = (v["duration_seconds"] or 60.0) if v else 60.0
            clean_segments = extract_or_generate_segments(content, dur)

        segments_json = json.dumps(clean_segments)
        with db() as connection:
            connection.execute(
                "UPDATE transcripts SET content=?, language=?, status='ready', error=NULL, segments_json=?, updated_at=? WHERE video_id=?",
                (content, result.get("language"), segments_json, now(), video_id)
            )
            v = connection.execute("SELECT duration_seconds FROM videos WHERE id=?", (video_id,)).fetchone()
            dur = (v["duration_seconds"] or 60.0) if v else 60.0

        # Auto-run key moments and keyword extraction
        run_full_nlp_analysis(video_id, content, clean_segments, dur)

    except Exception as exc:
        hint = "Install FFmpeg and run pip install -r requirements.txt." if isinstance(exc, (ImportError, FileNotFoundError)) else str(exc)[:220]
        with db() as connection:
            connection.execute("UPDATE transcripts SET status='failed', error=?, updated_at=? WHERE video_id=?", (hint, now(), video_id))


def summarize_text(text: str, maximum_sentences: int) -> str:
    sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]
    if not sentences:
        raise HTTPException(status_code=422, detail="Transcript has no text to summarize")
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    frequency = {word: words.count(word) for word in set(words)}
    scored = [(sum(frequency.get(word, 0) for word in re.findall(r"[a-zA-Z]{3,}", sentence.lower())), index, sentence) for index, sentence in enumerate(sentences)]
    picked = sorted(sorted(scored, reverse=True)[:min(maximum_sentences, len(sentences))], key=lambda item: item[1])
    return " ".join(item[2] for item in picked)


class TranscriptUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=200_000)


class SummaryRequest(BaseModel):
    summary_type: Literal["short", "detailed", "educational"]


@app.post("/api/videos/{video_id}/transcript", status_code=202)
def generate_transcript(video_id: str, background_tasks: BackgroundTasks, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    ensure_video_access(video, user, edit=True)
    source = UPLOADS / video["stored_name"]
    if not source.exists():
        raise HTTPException(status_code=404, detail="The original uploaded file is not available")
    with db() as connection:
        existing = connection.execute("SELECT id FROM transcripts WHERE video_id=?", (video_id,)).fetchone()
        if existing:
            connection.execute("UPDATE transcripts SET status='processing', error=NULL, updated_at=? WHERE video_id=?", (now(), video_id))
        else:
            connection.execute("INSERT INTO transcripts VALUES (?, ?, '', NULL, 'processing', NULL, NULL, ?, ?)", (str(uuid.uuid4()), video_id, now(), now()))
    log_activity(user["id"], "transcript_generate", video_id=video_id)
    background_tasks.add_task(transcribe_video, video_id, source)
    return {"status": "processing", "message": "Whisper transcription has started."}


@app.get("/api/videos/{video_id}/transcript")
def get_transcript(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="No transcript has been generated yet")
    res = dict(transcript)
    segments = []
    if res.get("segments_json"):
        try:
            segments = json.loads(res["segments_json"])
        except Exception:
            segments = []
    if not segments and res.get("content"):
        segments = extract_or_generate_segments(res["content"], video["duration_seconds"] or 60.0)
    res["segments"] = segments
    return res


@app.put("/api/videos/{video_id}/transcript")
def update_transcript(video_id: str, data: TranscriptUpdate, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    ensure_video_access(video, user, edit=True)
    clean_text = data.content.strip()
    segments = extract_or_generate_segments(clean_text, video["duration_seconds"] or 60.0)
    segments_json = json.dumps(segments)
    with db() as connection:
        existing = connection.execute("SELECT id FROM transcripts WHERE video_id=?", (video_id,)).fetchone()
        if existing:
            connection.execute("UPDATE transcripts SET content=?, status='ready', error=NULL, segments_json=?, updated_at=? WHERE video_id=?", (clean_text, segments_json, now(), video_id))
        else:
            connection.execute("INSERT INTO transcripts VALUES (?, ?, ?, 'manual', 'ready', NULL, ?, ?, ?)", (str(uuid.uuid4()), video_id, clean_text, segments_json, now(), now()))
    # Auto-run key moments and keywords for updated transcript
    run_full_nlp_analysis(video_id, clean_text, segments, video["duration_seconds"] or 60.0)
    log_activity(user["id"], "transcript_update", video_id=video_id)
    return get_transcript(video_id, user)


@app.post("/api/videos/{video_id}/summaries", status_code=201)
def generate_summary(video_id: str, data: SummaryRequest, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    if not transcript or transcript["status"] != "ready":
        raise HTTPException(status_code=409, detail="A ready transcript is required before generating a summary")
    
    sentence_count = 3 if data.summary_type == "short" else (12 if data.summary_type == "educational" else 8)
    content = summarize_text(transcript["content"], sentence_count)
    if data.summary_type == "educational":
        content = f"Educational Summary & Key Study Notes:\n{content}"
    
    with db() as connection:
        connection.execute("INSERT INTO summaries VALUES (?, ?, ?, ?, ?) ON CONFLICT(video_id, summary_type) DO UPDATE SET content=excluded.content, created_at=excluded.created_at", (str(uuid.uuid4()), video_id, data.summary_type, content, now()))
        summary = connection.execute("SELECT * FROM summaries WHERE video_id=? AND summary_type=?", (video_id, data.summary_type)).fetchone()
    log_activity(user["id"], "summary_generate", video_id=video_id, details={"type": data.summary_type})
    return dict(summary)


@app.get("/api/videos/{video_id}/summaries")
def get_summaries(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    with db() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM summaries WHERE video_id=? ORDER BY summary_type", (video_id,)).fetchall()]


# ==========================================
# MILESTONE 3: KEY MOMENTS & HIGHLIGHTS API
# ==========================================

@app.post("/api/videos/{video_id}/key-moments", status_code=200)
def extract_key_moments_endpoint(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Trigger Key Moments Detection workflow."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    if not transcript or transcript["status"] != "ready":
        raise HTTPException(status_code=409, detail="A ready transcript is required to detect key moments")
    
    segments = []
    if transcript["segments_json"]:
        try:
            segments = json.loads(transcript["segments_json"])
        except Exception:
            segments = []
    if not segments:
        segments = extract_or_generate_segments(transcript["content"], video["duration_seconds"] or 60.0)

    moments = detect_key_moments(transcript["content"], segments, video["duration_seconds"] or 60.0)
    with db() as connection:
        connection.execute("DELETE FROM key_moments WHERE video_id=?", (video_id,))
        for m in moments:
            connection.execute(
                "INSERT INTO key_moments (id, video_id, start_time, end_time, label, summary, importance_score, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), video_id, m["start_time"], m["end_time"], m["label"], m["summary"], m["importance_score"], m["category"], now())
            )
    log_activity(user["id"], "moments_detect", video_id=video_id, details={"count": len(moments)})
    return get_key_moments(video_id, user)


@app.get("/api/videos/{video_id}/key-moments")
def get_key_moments(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Retrieve detected key moments and timestamp boundaries."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    with db() as connection:
        rows = connection.execute("SELECT * FROM key_moments WHERE video_id=? ORDER BY start_time ASC", (video_id,)).fetchall()
        if not rows:
            # Check if transcript is ready, if so auto-generate
            transcript = transcript_row(video_id)
            if transcript and transcript["status"] == "ready" and transcript["content"]:
                segments = json.loads(transcript["segments_json"]) if transcript["segments_json"] else extract_or_generate_segments(transcript["content"], video["duration_seconds"] or 60.0)
                moments = detect_key_moments(transcript["content"], segments, video["duration_seconds"] or 60.0)
                for m in moments:
                    connection.execute(
                        "INSERT INTO key_moments (id, video_id, start_time, end_time, label, summary, importance_score, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), video_id, m["start_time"], m["end_time"], m["label"], m["summary"], m["importance_score"], m["category"], now())
                    )
                rows = connection.execute("SELECT * FROM key_moments WHERE video_id=? ORDER BY start_time ASC", (video_id,)).fetchall()

    moments = []
    for r in rows:
        item = dict(r)
        item["formatted_time"] = f"{format_timestamp(item['start_time'])} - {format_timestamp(item['end_time'])}"
        moments.append(item)
    return moments


# ==========================================
# MILESTONE 3: KEYWORDS & CONTENT INSIGHTS
# ==========================================

@app.post("/api/videos/{video_id}/keywords", status_code=200)
def extract_keywords_endpoint(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Trigger keyword & topic extraction."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    if not transcript or transcript["status"] != "ready":
        raise HTTPException(status_code=409, detail="A ready transcript is required to extract keywords")
    
    keywords = extract_keywords_rake(transcript["content"], top_n=20)
    with db() as connection:
        connection.execute("DELETE FROM video_keywords WHERE video_id=?", (video_id,))
        for k in keywords:
            connection.execute(
                "INSERT INTO video_keywords (id, video_id, keyword, score, frequency, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), video_id, k["keyword"], k["score"], k["frequency"], k["category"], now())
            )
    log_activity(user["id"], "keywords_extract", video_id=video_id, details={"count": len(keywords)})
    return get_keywords(video_id, user)


@app.get("/api/videos/{video_id}/keywords")
def get_keywords(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Get extracted keywords and topical tags."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    with db() as connection:
        rows = connection.execute("SELECT * FROM video_keywords WHERE video_id=? ORDER BY score DESC, frequency DESC", (video_id,)).fetchall()
        if not rows:
            transcript = transcript_row(video_id)
            if transcript and transcript["status"] == "ready" and transcript["content"]:
                keywords = extract_keywords_rake(transcript["content"], top_n=20)
                for k in keywords:
                    connection.execute(
                        "INSERT INTO video_keywords (id, video_id, keyword, score, frequency, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (str(uuid.uuid4()), video_id, k["keyword"], k["score"], k["frequency"], k["category"], now())
                    )
                rows = connection.execute("SELECT * FROM video_keywords WHERE video_id=? ORDER BY score DESC, frequency DESC", (video_id,)).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/videos/{video_id}/insights")
def get_content_insights_endpoint(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Retrieve comprehensive speech pace, reading time, lexical diversity, and sentiment insights."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    content = transcript["content"] if (transcript and transcript["status"] == "ready") else ""
    duration = video["duration_seconds"] or 0.0
    insights = analyze_content_insights(content, duration)
    return insights


# ==========================================
# MILESTONE 3: HIGHLIGHT REPORTS & EXPORTS
# ==========================================

@app.get("/api/videos/{video_id}/report")
def get_highlight_report_endpoint(video_id: str, user: sqlite3.Row = Depends(get_user)):
    """Generate structured highlight report."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    content = transcript["content"] if (transcript and transcript["status"] == "ready") else ""
    duration = video["duration_seconds"] or 0.0

    summaries = get_summaries(video_id, user)
    moments = get_key_moments(video_id, user)
    keywords = get_keywords(video_id, user)
    insights = analyze_content_insights(content, duration)

    report = generate_highlight_report(
        video_title=video["original_name"],
        duration_seconds=duration,
        transcript=content,
        summaries=summaries,
        key_moments=moments,
        keywords=keywords,
        insights=insights
    )
    log_activity(user["id"], "report_view", video_id=video_id)
    return report


@app.get("/api/videos/{video_id}/export")
def export_video_data_endpoint(
    video_id: str,
    format: Literal["txt", "md", "srt", "vtt", "json"] = "md",
    user: sqlite3.Row = Depends(get_user)
):
    """Export video content, summaries, key moments, or subtitles."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    content = transcript["content"] if (transcript and transcript["status"] == "ready") else ""
    duration = video["duration_seconds"] or 0.0

    segments = []
    if transcript and "segments_json" in transcript.keys() and transcript["segments_json"]:
        try:
            segments = json.loads(transcript["segments_json"])
        except Exception:
            segments = []
    if not segments and content:
        segments = extract_or_generate_segments(content, duration)

    summaries = get_summaries(video_id, user)
    moments = get_key_moments(video_id, user)
    keywords = get_keywords(video_id, user)
    insights = analyze_content_insights(content, duration)

    log_activity(user["id"], "content_export", video_id=video_id, details={"format": format})
    base_name = Path(video["original_name"]).stem

    if format == "srt":
        srt_text = export_transcript_srt(segments)
        return PlainTextResponse(content=srt_text, media_type="text/plain", headers={"Content-Disposition": f'attachment; filename="{base_name}.srt"'})
    elif format == "vtt":
        vtt_text = export_transcript_vtt(segments)
        return PlainTextResponse(content=vtt_text, media_type="text/vtt", headers={"Content-Disposition": f'attachment; filename="{base_name}.vtt"'})
    elif format == "json":
        data = {
            "video": dict(video),
            "transcript": content,
            "segments": segments,
            "summaries": summaries,
            "key_moments": moments,
            "keywords": keywords,
            "insights": insights
        }
        return Response(content=json.dumps(data, indent=2), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{base_name}_clipmind.json"'})
    elif format == "txt":
        lines = [
            f"CLIPMIND AI REPORT: {video['original_name']}",
            f"Duration: {format_timestamp(duration)}",
            "=" * 50,
            "\n[TRANSCRIPT]\n",
            content,
            "\n" + "=" * 50,
            "\n[SUMMARIES]\n"
        ]
        for s in summaries:
            lines.append(f"--- {s['summary_type'].upper()} SUMMARY ---\n{s['content']}\n")
        lines.append("\n" + "=" * 50 + "\n[KEY MOMENTS]\n")
        for m in moments:
            lines.append(f"[{m['formatted_time']}] {m['label']} (Score: {int(m['importance_score']*100)}%)\n{m['summary']}\n")
        return PlainTextResponse(content="\n".join(lines), media_type="text/plain", headers={"Content-Disposition": f'attachment; filename="{base_name}_summary.txt"'})
    else: # markdown default
        report = generate_highlight_report(video["original_name"], duration, content, summaries, moments, keywords, insights)
        return PlainTextResponse(content=report["markdown"], media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{base_name}_highlight_report.md"'})


# ==========================================
# MILESTONE 3: TRANSCRIPT SEARCH & JUMP
# ==========================================

@app.get("/api/videos/{video_id}/search")
def search_transcript_endpoint(video_id: str, q: str = Query(min_length=1), user: sqlite3.Row = Depends(get_user)):
    """Search for keywords/phrases inside transcript with timestamps and context snippets."""
    video = get_video_or_404(video_id)
    ensure_video_access(video, user)
    transcript = transcript_row(video_id)
    if not transcript or transcript["status"] != "ready":
        return {"query": q, "results": []}

    segments = []
    if transcript and "segments_json" in transcript.keys() and transcript["segments_json"]:
        try:
            segments = json.loads(transcript["segments_json"])
        except Exception:
            segments = []
    if not segments and transcript["content"]:
        segments = extract_or_generate_segments(transcript["content"], video["duration_seconds"] or 60.0)

    query_lower = q.lower().strip()
    results = []
    for seg in segments:
        if query_lower in seg["text"].lower():
            # Highlight snippet
            pattern = re.compile(re.escape(query_lower), re.IGNORECASE)
            highlighted = pattern.sub(lambda m: f"<mark>{m.group(0)}</mark>", seg["text"])
            results.append({
                "start": seg["start"],
                "end": seg["end"],
                "formatted_time": f"{format_timestamp(seg['start'])} - {format_timestamp(seg['end'])}",
                "text": seg["text"],
                "highlighted": highlighted
            })
    log_activity(user["id"], "transcript_search", video_id=video_id, details={"query": q, "matches": len(results)})
    return {"query": q, "total_matches": len(results), "results": results}


# ==========================================
# MILESTONE 3: BOOKMARKS & LEARNING HISTORY
# ==========================================

@app.get("/api/bookmarks")
def list_bookmarks(video_id: str | None = None, user: sqlite3.Row = Depends(get_user)):
    """List all saved bookmarks for learner/user."""
    with db() as connection:
        if video_id:
            rows = connection.execute("SELECT b.*, v.original_name as video_name FROM bookmarks b JOIN videos v ON b.video_id = v.id WHERE b.user_id=? AND b.video_id=? ORDER BY b.created_at DESC", (user["id"], video_id)).fetchall()
        else:
            rows = connection.execute("SELECT b.*, v.original_name as video_name FROM bookmarks b JOIN videos v ON b.video_id = v.id WHERE b.user_id=? ORDER BY b.created_at DESC", (user["id"],)).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/bookmarks", status_code=201)
def create_bookmark(data: BookmarkCreateInput, user: sqlite3.Row = Depends(get_user)):
    """Create a bookmark for a summary, key moment, or transcript."""
    video = get_video_or_404(data.video_id)
    ensure_video_access(video, user)
    bookmark_id = str(uuid.uuid4())
    with db() as connection:
        connection.execute(
            "INSERT INTO bookmarks (id, user_id, video_id, item_type, item_id, title, content, timestamp_start, timestamp_end, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (bookmark_id, user["id"], data.video_id, data.item_type, data.item_id, data.title.strip(), data.content.strip(), data.timestamp_start, data.timestamp_end, now())
        )
        row = connection.execute("SELECT b.*, v.original_name as video_name FROM bookmarks b JOIN videos v ON b.video_id = v.id WHERE b.id=?", (bookmark_id,)).fetchone()
    log_activity(user["id"], "bookmark_create", video_id=data.video_id, details={"item_type": data.item_type, "title": data.title})
    return dict(row)


@app.delete("/api/bookmarks/{bookmark_id}", status_code=204)
def delete_bookmark(bookmark_id: str, user: sqlite3.Row = Depends(get_user)):
    with db() as connection:
        row = connection.execute("SELECT * FROM bookmarks WHERE id=?", (bookmark_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        if user["role"] != "admin" and row["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Forbidden")
        connection.execute("DELETE FROM bookmarks WHERE id=?", (bookmark_id,))


# ==========================================
# MILESTONE 3: ROLE-BASED ANALYTICS DASHBOARDS
# ==========================================

@app.get("/api/analytics/system")
def get_system_analytics(user: sqlite3.Row = Depends(get_user)):
    """Administrator level platform analytics."""
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    with db() as connection:
        total_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        role_counts = dict(connection.execute("SELECT role, COUNT(*) FROM users GROUP BY role").fetchall())
        total_videos = connection.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
        status_counts = dict(connection.execute("SELECT status, COUNT(*) FROM videos GROUP BY status").fetchall())
        total_storage_bytes = connection.execute("SELECT SUM(size_bytes) FROM videos").fetchone()[0] or 0
        total_duration_sec = connection.execute("SELECT SUM(duration_seconds) FROM videos").fetchone()[0] or 0.0
        total_transcripts = connection.execute("SELECT COUNT(*) FROM transcripts WHERE status='ready'").fetchone()[0]
        total_summaries = connection.execute("SELECT COUNT(*) FROM summaries").fetchone()[0]
        total_moments = connection.execute("SELECT COUNT(*) FROM key_moments").fetchone()[0]
        total_bookmarks = connection.execute("SELECT COUNT(*) FROM bookmarks").fetchone()[0]
        recent_activity = [dict(r) for r in connection.execute("SELECT a.*, u.name as user_name, u.email as user_email FROM activity_logs a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 30").fetchall()]
        
        # Video list with owners
        videos_summary = [dict(r) for r in connection.execute("SELECT v.id, v.original_name, v.size_bytes, v.duration_seconds, v.status, v.created_at, u.name as owner_name FROM videos v JOIN users u ON v.owner_id = u.id ORDER BY v.created_at DESC LIMIT 10").fetchall()]

    return {
        "total_users": total_users,
        "role_breakdown": role_counts,
        "total_videos": total_videos,
        "video_status_breakdown": status_counts,
        "total_storage_mb": round(total_storage_bytes / (1024 * 1024), 2),
        "total_duration_hours": round(total_duration_sec / 3600.0, 2),
        "total_transcripts_ready": total_transcripts,
        "total_summaries_generated": total_summaries,
        "total_moments_detected": total_moments,
        "total_bookmarks_saved": total_bookmarks,
        "recent_activity": recent_activity,
        "recent_videos": videos_summary
    }


@app.get("/api/analytics/creator")
def get_creator_analytics(user: sqlite3.Row = Depends(get_user)):
    """Creator analytics view: video catalog metrics, speech pace, top keywords."""
    with db() as connection:
        videos = [dict(r) for r in connection.execute("SELECT * FROM videos WHERE owner_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()]
        video_ids = [v["id"] for v in videos]
        total_uploads = len(videos)
        total_storage = sum(v["size_bytes"] for v in videos)
        total_duration = sum(v["duration_seconds"] or 0.0 for v in videos)

        transcripts_count = 0
        summaries_count = 0
        moments_count = 0
        top_keywords = []

        if video_ids:
            placeholders = ",".join("?" * len(video_ids))
            transcripts_count = connection.execute(f"SELECT COUNT(*) FROM transcripts WHERE video_id IN ({placeholders}) AND status='ready'", video_ids).fetchone()[0]
            summaries_count = connection.execute(f"SELECT COUNT(*) FROM summaries WHERE video_id IN ({placeholders})", video_ids).fetchone()[0]
            moments_count = connection.execute(f"SELECT COUNT(*) FROM key_moments WHERE video_id IN ({placeholders})", video_ids).fetchone()[0]
            kw_rows = connection.execute(f"SELECT keyword, COUNT(*) as appearances, AVG(score) as avg_score FROM video_keywords WHERE video_id IN ({placeholders}) GROUP BY keyword ORDER BY appearances DESC, avg_score DESC LIMIT 12", video_ids).fetchall()
            top_keywords = [dict(r) for r in kw_rows]

    return {
        "total_uploads": total_uploads,
        "total_storage_mb": round(total_storage / (1024 * 1024), 2),
        "total_duration_minutes": round(total_duration / 60.0, 1),
        "avg_duration_minutes": round((total_duration / max(1, total_uploads)) / 60.0, 1),
        "transcripts_generated": transcripts_count,
        "summaries_generated": summaries_count,
        "moments_detected": moments_count,
        "top_keywords": top_keywords,
        "recent_videos": videos[:5]
    }


@app.get("/api/analytics/educator")
def get_educator_analytics(user: sqlite3.Row = Depends(get_user)):
    """Educator analytics: classroom lectures, student engagement, study resources."""
    with db() as connection:
        lectures = [dict(r) for r in connection.execute("SELECT * FROM videos WHERE owner_id=? ORDER BY created_at DESC", (user["id"],)).fetchall()]
        lecture_ids = [l["id"] for l in lectures]
        total_lectures = len(lectures)
        total_duration_hours = round(sum(l["duration_seconds"] or 0.0 for l in lectures) / 3600.0, 2)

        study_materials_count = 0
        key_concepts_count = 0
        student_searches_count = 0
        if lecture_ids:
            placeholders = ",".join("?" * len(lecture_ids))
            study_materials_count = connection.execute(f"SELECT COUNT(*) FROM summaries WHERE video_id IN ({placeholders})", lecture_ids).fetchone()[0]
            key_concepts_count = connection.execute(f"SELECT COUNT(*) FROM key_moments WHERE video_id IN ({placeholders}) AND category IN ('core_concept', 'key_takeaway')", lecture_ids).fetchone()[0]
            student_searches_count = connection.execute(f"SELECT COUNT(*) FROM activity_logs WHERE video_id IN ({placeholders}) AND activity_type='transcript_search'", lecture_ids).fetchone()[0]

    return {
        "total_lectures": total_lectures,
        "total_lecture_hours": total_duration_hours,
        "study_materials_ready": study_materials_count,
        "key_concepts_extracted": key_concepts_count,
        "student_interaction_events": student_searches_count,
        "lectures": lectures
    }


@app.get("/api/analytics/learner")
def get_learner_analytics(user: sqlite3.Row = Depends(get_user)):
    """Learner analytics: learning history, bookmarks count, study minutes accrued."""
    with db() as connection:
        bookmarks = [dict(r) for r in connection.execute("SELECT b.*, v.original_name as video_name FROM bookmarks b JOIN videos v ON b.video_id = v.id WHERE b.user_id=? ORDER BY b.created_at DESC", (user["id"],)).fetchall()]
        activities = [dict(r) for r in connection.execute("SELECT a.*, v.original_name as video_name FROM activity_logs a LEFT JOIN videos v ON a.video_id = v.id WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 20", (user["id"],)).fetchall()]
        videos_explored = connection.execute("SELECT COUNT(DISTINCT video_id) FROM activity_logs WHERE user_id=? AND video_id IS NOT NULL", (user["id"],)).fetchone()[0]
        searches_performed = connection.execute("SELECT COUNT(*) FROM activity_logs WHERE user_id=? AND activity_type='transcript_search'", (user["id"],)).fetchone()[0]

    return {
        "videos_explored": videos_explored,
        "total_bookmarks": len(bookmarks),
        "searches_performed": searches_performed,
        "bookmarks": bookmarks,
        "recent_activities": activities
    }


# ==========================================
# ADMIN OPERATIONS
# ==========================================

@app.get("/api/admin/users")
def list_admin_users(user: sqlite3.Row = Depends(get_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    with db() as connection:
        rows = connection.execute("SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


@app.put("/api/admin/users/{user_id}/role")
def update_user_role(user_id: str, data: RoleUpdateInput, user: sqlite3.Row = Depends(get_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    with db() as connection:
        target = connection.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        connection.execute("UPDATE users SET role=? WHERE id=?", (data.role, user_id))
        updated = connection.execute("SELECT id, email, name, role, created_at FROM users WHERE id=?", (user_id,)).fetchone()
    log_activity(user["id"], "user_role_change", details={"target_user": user_id, "new_role": data.role})
    return dict(updated)


@app.get("/api/admin/activity")
def get_admin_audit_logs(limit: int = 50, user: sqlite3.Row = Depends(get_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    with db() as connection:
        rows = connection.execute("SELECT a.*, u.name as user_name, u.email as user_email, v.original_name as video_name FROM activity_logs a JOIN users u ON a.user_id = u.id LEFT JOIN videos v ON a.video_id = v.id ORDER BY a.created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/admin/jobs")
def get_ai_processing_jobs(user: sqlite3.Row = Depends(get_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    with db() as connection:
        videos = [dict(r) for r in connection.execute("SELECT v.id, v.original_name, v.status, v.processing_error, v.created_at, u.name as owner_name FROM videos v JOIN users u ON v.owner_id = u.id ORDER BY v.created_at DESC").fetchall()]
        transcripts = [dict(r) for r in connection.execute("SELECT t.video_id, t.status, t.error, t.updated_at, v.original_name FROM transcripts t JOIN videos v ON t.video_id = v.id ORDER BY t.updated_at DESC").fetchall()]
    return {
        "video_jobs": videos,
        "transcript_jobs": transcripts
    }


# ==========================================
# MEDIA STREAMING & THUMBNAILS
# ==========================================

@app.get("/api/thumbnails/{thumbnail_name}")
def get_thumbnail(thumbnail_name: str):
    file_path = THUMBNAILS / thumbnail_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(file_path, media_type="image/jpeg")


@app.get("/api/videos/{video_id}/stream")
async def stream_video(video_id: str, request: Request):
    """Serve video with HTTP Range header support for seeking."""
    video = get_video_or_404(video_id)
    file_path = UPLOADS / video["stored_name"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    if not range_header:
        def iterfile():
            with open(file_path, mode="rb") as file_like:
                yield from file_like
        return StreamingResponse(
            iterfile(),
            media_type=video["mime_type"] or "video/mp4",
            headers={"Content-Length": str(file_size), "Accept-Ranges": "bytes"}
        )

    # Parse range header (e.g., 'bytes=1000-2000' or 'bytes=1000-')
    try:
        range_value = range_header.replace("bytes=", "").strip()
        parts = range_value.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        start = max(0, start)
        end = min(file_size - 1, end)
        content_length = end - start + 1
    except Exception:
        start = 0
        end = file_size - 1
        content_length = file_size

    def range_generator():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = content_length
            chunk_size = 1024 * 512
            while bytes_left > 0:
                read_size = min(chunk_size, bytes_left)
                data = f.read(read_size)
                if not data:
                    break
                bytes_left -= len(data)
                yield data

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Type": video["mime_type"] or "video/mp4",
    }
    return StreamingResponse(range_generator(), status_code=206, headers=headers)


@app.get("/api/videos/{video_id}")
def video_detail(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    if user["role"] in {"creator", "educator"} and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own uploads")
    return serialize_video(video)


@app.delete("/api/videos/{video_id}", status_code=204)
def delete_video(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id)
    if user["role"] != "admin" and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own uploads")
    with db() as connection:
        connection.execute("DELETE FROM key_moments WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM video_keywords WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM bookmarks WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM summaries WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM transcripts WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM activity_logs WHERE video_id=?", (video_id,))
        connection.execute("DELETE FROM videos WHERE id=?", (video_id,))
    log_activity(user["id"], "video_delete", details={"video_name": video["original_name"]})
    (UPLOADS / video["stored_name"]).unlink(missing_ok=True)
    if video["thumbnail_name"]:
        (THUMBNAILS / video["thumbnail_name"]).unlink(missing_ok=True)
