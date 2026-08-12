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
from typing import Literal

import jwt
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

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

app = FastAPI(title="ClipMind AI", version="0.2.0", description="Weeks 1-4 video processing, transcripts, and summaries")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
          language TEXT, status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        CREATE TABLE IF NOT EXISTS summaries (
          id TEXT PRIMARY KEY, video_id TEXT NOT NULL, summary_type TEXT NOT NULL,
          content TEXT NOT NULL, created_at TEXT NOT NULL,
          UNIQUE(video_id, summary_type), FOREIGN KEY(video_id) REFERENCES videos(id)
        );
        """)


@app.on_event("startup")
def startup() -> None:
    initialize_database()


def now() -> str:
    return datetime.now(UTC).isoformat()


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


def user_data(user: sqlite3.Row) -> dict:
    return {key: user[key] for key in ("id", "email", "name", "role", "created_at")}


@app.get("/api/health")
def health():
    return {"status": "ok", "scope": "weeks-1-4"}


@app.post("/api/auth/register", status_code=201)
def register(data: RegisterInput):
    user_id = str(uuid.uuid4())
    with db() as connection:
        if connection.execute("SELECT 1 FROM users WHERE email = ?", (data.email.lower(),)).fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        connection.execute("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", (user_id, data.email.lower(), data.name.strip(), password_hash(data.password), data.role, now()))
        user = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user_data(user)}


@app.post("/api/auth/login")
def login(data: LoginInput):
    with db() as connection:
        user = connection.execute("SELECT * FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return {"access_token": issue_token(user), "token_type": "bearer", "user": user_data(user)}


@app.get("/api/auth/me")
def me(user: sqlite3.Row = Depends(get_user)):
    return user_data(user)


def serialize_video(video: sqlite3.Row) -> dict:
    return dict(video)


def process_video(video_id: str, source: Path) -> None:
    """Use FFmpeg/ffprobe to produce Week 1-2 media metadata and a thumbnail."""
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
    if user["role"] == "admin": return
    if edit and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only manage your own uploads")
    if not edit and user["role"] in {"creator", "educator"} and video["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own uploads")


def transcript_row(video_id: str) -> sqlite3.Row | None:
    with db() as connection:
        return connection.execute("SELECT * FROM transcripts WHERE video_id=?", (video_id,)).fetchone()


def transcribe_video(video_id: str, source: Path) -> None:
    try:
        import whisper
        model = whisper.load_model(os.getenv("WHISPER_MODEL", "base"))
        result = model.transcribe(str(source), fp16=False)
        content = result.get("text", "").strip()
        if not content: raise ValueError("Whisper returned an empty transcript")
        with db() as connection:
            connection.execute("UPDATE transcripts SET content=?, language=?, status='ready', error=NULL, updated_at=? WHERE video_id=?", (content, result.get("language"), now(), video_id))
    except Exception as exc:
        hint = "Install FFmpeg and run pip install -r requirements.txt." if isinstance(exc, (ImportError, FileNotFoundError)) else str(exc)[:220]
        with db() as connection:
            connection.execute("UPDATE transcripts SET status='failed', error=?, updated_at=? WHERE video_id=?", (hint, now(), video_id))


def summarize_text(text: str, maximum_sentences: int) -> str:
    sentences = [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]
    if not sentences: raise HTTPException(status_code=422, detail="Transcript has no text to summarize")
    words = re.findall(r"[a-zA-Z]{3,}", text.lower()); frequency = {word: words.count(word) for word in set(words)}
    scored = [(sum(frequency.get(word, 0) for word in re.findall(r"[a-zA-Z]{3,}", sentence.lower())), index, sentence) for index, sentence in enumerate(sentences)]
    picked = sorted(sorted(scored, reverse=True)[:min(maximum_sentences, len(sentences))], key=lambda item: item[1])
    return " ".join(item[2] for item in picked)


class TranscriptUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=200_000)


class SummaryRequest(BaseModel):
    summary_type: Literal["short", "detailed"]


@app.post("/api/videos/{video_id}/transcript", status_code=202)
def generate_transcript(video_id: str, background_tasks: BackgroundTasks, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id); ensure_video_access(video, user, edit=True); source = UPLOADS / video["stored_name"]
    if not source.exists(): raise HTTPException(status_code=404, detail="The original uploaded file is not available")
    with db() as connection:
        existing = connection.execute("SELECT id FROM transcripts WHERE video_id=?", (video_id,)).fetchone()
        if existing: connection.execute("UPDATE transcripts SET status='processing', error=NULL, updated_at=? WHERE video_id=?", (now(), video_id))
        else: connection.execute("INSERT INTO transcripts VALUES (?, ?, '', NULL, 'processing', NULL, ?, ?)", (str(uuid.uuid4()), video_id, now(), now()))
    background_tasks.add_task(transcribe_video, video_id, source)
    return {"status": "processing", "message": "Whisper transcription has started."}


@app.get("/api/videos/{video_id}/transcript")
def get_transcript(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id); ensure_video_access(video, user); transcript = transcript_row(video_id)
    if not transcript: raise HTTPException(status_code=404, detail="No transcript has been generated yet")
    return dict(transcript)


@app.put("/api/videos/{video_id}/transcript")
def update_transcript(video_id: str, data: TranscriptUpdate, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id); ensure_video_access(video, user, edit=True)
    with db() as connection:
        existing = connection.execute("SELECT id FROM transcripts WHERE video_id=?", (video_id,)).fetchone()
        if existing: connection.execute("UPDATE transcripts SET content=?, status='ready', error=NULL, updated_at=? WHERE video_id=?", (data.content.strip(), now(), video_id))
        else: connection.execute("INSERT INTO transcripts VALUES (?, ?, ?, 'manual', 'ready', NULL, ?, ?)", (str(uuid.uuid4()), video_id, data.content.strip(), now(), now()))
    return get_transcript(video_id, user)


@app.post("/api/videos/{video_id}/summaries", status_code=201)
def generate_summary(video_id: str, data: SummaryRequest, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id); ensure_video_access(video, user); transcript = transcript_row(video_id)
    if not transcript or transcript["status"] != "ready": raise HTTPException(status_code=409, detail="A ready transcript is required before generating a summary")
    content = summarize_text(transcript["content"], 3 if data.summary_type == "short" else 8)
    with db() as connection:
        connection.execute("INSERT INTO summaries VALUES (?, ?, ?, ?, ?) ON CONFLICT(video_id, summary_type) DO UPDATE SET content=excluded.content, created_at=excluded.created_at", (str(uuid.uuid4()), video_id, data.summary_type, content, now()))
        summary = connection.execute("SELECT * FROM summaries WHERE video_id=? AND summary_type=?", (video_id, data.summary_type)).fetchone()
    return dict(summary)


@app.get("/api/videos/{video_id}/summaries")
def get_summaries(video_id: str, user: sqlite3.Row = Depends(get_user)):
    video = get_video_or_404(video_id); ensure_video_access(video, user)
    with db() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM summaries WHERE video_id=? ORDER BY summary_type", (video_id,)).fetchall()]


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
        connection.execute("DELETE FROM videos WHERE id=?", (video_id,))
    (UPLOADS / video["stored_name"]).unlink(missing_ok=True)
    if video["thumbnail_name"]:
        (THUMBNAILS / video["thumbnail_name"]).unlink(missing_ok=True)
