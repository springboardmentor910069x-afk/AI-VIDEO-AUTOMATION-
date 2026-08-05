# ClipMind AI - Week 1 & 2

This repository implements **only Milestone 1**: project setup, architecture, role-based authentication, video upload, and an FFmpeg processing pipeline. Transcription, summaries, key-moment detection, analytics, deployment, and other later-milestone features are deliberately out of scope.

## Included

- FastAPI REST API with JWT login and registration
- Roles: `creator`, `learner`, `educator`, and `admin`
- SQLite for zero-setup development, with a PostgreSQL-ready relational schema documented for production migration
- Validated multipart video upload and per-owner access rules
- Background FFmpeg probe + thumbnail extraction workflow with clear failure status if FFmpeg is unavailable
- React + Vite interface for registration, login, upload, and video-library management
- Architecture, database schema, and screen wireframes in [`docs/week-1-2-design.md`](docs/week-1-2-design.md)

## Run locally

### API

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Install [FFmpeg](https://ffmpeg.org/download.html) and make sure `ffmpeg` and `ffprobe` are on `PATH` to enable media inspection and thumbnails. Uploads remain recorded with an actionable status if it is not installed.

### Web app

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The first registered account is a creator by default; use the role selector for the other Week 1–2 roles.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Receive a JWT |
| GET | `/api/auth/me` | Get signed-in profile |
| POST | `/api/videos/upload` | Upload an MP4, MOV, WebM, AVI, or MKV file |
| GET | `/api/videos` | List videos visible to the signed-in role |
| GET | `/api/videos/{id}` | View one video |
| DELETE | `/api/videos/{id}` | Delete an owned upload (or any upload as admin) |

## Project layout

```
backend/     FastAPI application and data/upload directories
frontend/    React + Vite interface
docs/        Week 1–2 architecture, schema, workflows, and wireframes
```
