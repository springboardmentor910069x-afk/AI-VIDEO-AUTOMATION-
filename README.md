# ClipMind AI: Video Summarization & Key Moments Detection Platform

ClipMind AI is an AI-powered video summarization, transcript generation, key moments detection, and analytics platform.

---

## 🚀 Features by Milestone

### Milestone 1: Core Setup & Media Processing
- **Authentication & RBAC**: Secure JWT authentication with role-based access for `creator`, `learner`, `educator`, and `admin`.
- **Video Upload Pipeline**: Validated multi-part uploads with FFmpeg/ffprobe inspection (duration, resolution, thumbnail extraction).
- **SQLite / PostgreSQL Schema**: Structured database schema with zero-setup SQLite for development.

### Milestone 2: Speech-to-Text & AI Summaries
- **OpenAI Whisper STT**: Automated speech-to-text transcription engine.
- **Editable Transcripts**: Store, edit, and export transcripts with language detection.
- **NLP Summarization**: Short, Detailed, and Educational summaries.

### Milestone 3: Key Moments Detection & Analytics Dashboard
- **Key Moments Detection**: AI engine detecting important video segments, calculating importance scores, and tagging categories (`Key Takeaway`, `Core Concept`, `Action Item`, `Highlight`, `Discussion`).
- **Interactive Timeline Visualizer**: Color-coded interactive timeline bar with seek-to-timestamp capability.
- **Keyword & Topic Extraction**: RAKE + TF-IDF hybrid keyword extractor categorizing terms into Technology, Process, Concept, and Topic.
- **Content & Speech Insights**: Real-time calculation of speaking pace (WPM), reading time, lexical diversity (Type-Token Ratio), readability complexity, and tone analysis.
- **Highlight Reports & Multi-Format Exports**: Automated executive highlight reports with export to Markdown (`.md`), Text (`.txt`), Subtitles (`.srt`, `.vtt`), and structured JSON (`.json`).
- **Transcript Search**: Interactive in-transcript search with highlighted occurrences and one-click timestamp jumps.
- **Learner Hub & Bookmarks**: Save key moments and summaries for quick reference and study.
- **Educator Hub**: Automated flashcard generation and classroom lecture insights.
- **Role-Based Analytics Dashboards**: Dedicated metrics and analytics views for Creators, Learners, Educators, and Admins.
- **Admin Console**: User role management, AI processing job monitor, and system audit logs.

---

## 🛠️ Run Locally

### 1. Backend API

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Web Application

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user account |
| `POST` | `/api/auth/login` | Login and receive JWT |
| `GET` | `/api/auth/me` | Fetch authenticated profile |
| `POST` | `/api/videos/upload` | Upload video media file |
| `GET` | `/api/videos` | List accessible videos |
| `GET` | `/api/videos/{id}` | Video details |
| `GET` | `/api/videos/{id}/stream` | Stream video with HTTP Range seeking support |
| `POST` | `/api/videos/{id}/transcript` | Trigger Whisper transcription |
| `GET` | `/api/videos/{id}/transcript` | Get transcript & timestamped segments |
| `PUT` | `/api/videos/{id}/transcript` | Update transcript content |
| `POST` | `/api/videos/{id}/summaries` | Generate Short/Detailed/Educational summary |
| `GET` | `/api/videos/{id}/summaries` | List summaries |
| `POST` | `/api/videos/{id}/key-moments` | Trigger Key Moments detection |
| `GET` | `/api/videos/{id}/key-moments` | List detected key moments & timestamps |
| `POST` | `/api/videos/{id}/keywords` | Extract keywords & topical tags |
| `GET` | `/api/videos/{id}/keywords` | List extracted keywords |
| `GET` | `/api/videos/{id}/insights` | Content insights (speech pace, complexity, tone) |
| `GET` | `/api/videos/{id}/report` | Structured highlight report |
| `GET` | `/api/videos/{id}/export` | Export data (`txt`, `md`, `srt`, `vtt`, `json`) |
| `GET` | `/api/videos/{id}/search` | Search transcript with timestamps |
| `GET` | `/api/bookmarks` | List bookmarks |
| `POST` | `/api/bookmarks` | Save bookmark |
| `DELETE`| `/api/bookmarks/{id}` | Remove bookmark |
| `GET` | `/api/analytics/system` | Admin system metrics |
| `GET` | `/api/analytics/creator` | Creator uploads & speech metrics |
| `GET` | `/api/analytics/educator` | Educator lecture & engagement metrics |
| `GET` | `/api/analytics/learner` | Learner study & history metrics |
| `GET` | `/api/admin/users` | List users (Admin) |
| `PUT` | `/api/admin/users/{id}/role` | Update user role (Admin) |
| `GET` | `/api/admin/activity` | System audit logs (Admin) |
| `GET` | `/api/admin/jobs` | AI job queues (Admin) |

---

## 📁 Project Structure

```
app/
  ├── main.py          # FastAPI application, REST endpoints, database schema
  ├── analysis.py      # AI Key Moments, Keywords (RAKE+TF-IDF), Content Insights, Reports
src/
  ├── main.jsx         # React application with Studio, Analytics, and Role Hubs
  ├── styles.css       # Premium dark glassmorphism styling & design system
docs/
  ├── week-1-2-design.md # Milestone 1 architecture & design
  ├── week-3-4-design.md # Milestone 2 design
  ├── week-5-6-design.md # Milestone 3 design & algorithms
tests/
  ├── test_milestone3.py # Backend test suite for Milestone 3
```
