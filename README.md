# ClipMind AI — AI-Powered Video Intelligence Platform

ClipMind AI is an enterprise-grade AI-powered video intelligence platform designed to ingest raw video assets and automatically transform them into rich, actionable multi-modal insights.

```
Uploaded Video 
  ──> FFmpeg Media Extraction 
  ──> Whisper Speech-to-Text 
  ──> Multi-tier AI Summarization 
  ──> Key Moment Detection 
  ──> Keyword & Topic Extraction 
  ──> Content Analytics 
  ──> Downloadable Intelligence Reports
```

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Objectives](#3-objectives)
4. [Features](#4-features)
5. [Technology Stack](#5-technology-stack)
6. [System Architecture](#6-system-architecture)
7. [Database Architecture](#7-database-architecture)
8. [AI Workflow](#8-ai-workflow)
9. [Video Processing Workflow](#9-video-processing-workflow)
10. [Frontend Structure](#10-frontend-structure)
11. [Backend Structure](#11-backend-structure)
12. [API Documentation](#12-api-documentation)
13. [Installation](#13-installation)
14. [Environment Variables](#14-environment-variables)
15. [Running the Backend](#15-running-the-backend)
16. [Running the Frontend](#16-running-the-frontend)
17. [Running with Docker](#17-running-with-docker)
18. [Testing & Quality Assurance](#18-testing--quality-assurance)
19. [Deployment Guide](#19-deployment-guide)
20. [Future Enhancements](#20-future-enhancements)

---

## 1. Project Overview
ClipMind AI provides an end-to-end video analytics solution for creators, educators, analysts, and organizations. Instead of manually watching hours of footage, users can upload video files and instantly receive transcripts with timestamp precision, executive summaries, semantic chapter markers, topic keywords, speaking pace telemetry, and downloadable Markdown/PDF dossiers.

## 2. Problem Statement
Modern digital content consumption is overwhelmed with large volumes of video data. Manually indexing, reviewing, summarizing, and navigating long recordings (lectures, conferences, podcasts, meetings) is time-consuming, labor-intensive, and non-searchable. ClipMind AI automates this entire pipeline into a sub-minute background workflow.

## 3. Objectives
- **Automate Video Ingestion**: Support multiple video codecs and containers (`MP4`, `MOV`, `AVI`, `MKV`, `WebM`).
- **Precision Speech Recognition**: Extract normalized audio and generate timestamped transcript segments via Whisper.
- **Synthesize Contextual Knowledge**: Generate short executive summaries, deep narrative reviews, key takeaways, and action items.
- **Timestamp Synchronized Player**: Connect transcript and key moment markers directly to the native HTML5 player.
- **Enterprise Security & Governance**: Enforce JWT authentication, BCrypt password encryption, and Role-Based Access Control (RBAC).

## 4. Features
- **Video Intelligence Hub**: All-in-one central viewer with synchronized video player, 7 interactive tabs (Overview, Transcript, AI Summary, Key Moments, Keywords, Analytics, Reports).
- **Interactive Transcript Navigator**: Instant text search, segment timestamps (`00:00 - 00:15`), one-click timestamp seeking, copy to clipboard, `.txt` export.
- **Multi-dimensional AI Summarizer**: Short summary, detailed review, bullet key points, main topics tags, and checkable action items.
- **Semantic Key Moments**: Automated chapter detection with relevance scores, start/end timestamps, and instant playback jumping.
- **Keyword Cloud & TF-IDF Extraction**: High-relevance term frequencies and occurrences.
- **Telemetry & Speaking Analytics**: Total word counts, speech speed (Words Per Minute), sentiment estimates, and duration breakdown.
- **Report Generator**: Instant Markdown (`.md`) and JSON dossier export.
- **Admin Management Portal**: Administrative user governance, role elevation (`ROLE_USER` <-> `ROLE_ADMIN`), user video deletion, and system auditing.

## 5. Technology Stack
- **Frontend**: Next.js / React 19, TypeScript/JavaScript, Tailwind CSS, Lucide React, React Router.
- **Backend**: Spring Boot 3.3.2, Java 17, Spring Security (Stateless JWT + BCrypt), Spring Data JPA, Hibernate.
- **AI / Speech-to-Text**: Whisper STT, Natural Language Processing (NLP) Summarization & Semantic Segmentation.
- **Media Engine**: FFmpeg (Audio extraction, normalization to 16kHz PCM mono WAV, scene thumbnail generation).
- **Database**: H2 (In-memory development) / MySQL 8.0 (Production containerized).
- **DevOps**: Docker, Docker Compose, Nginx.

## 6. System Architecture
```
+-------------------------------------------------------+
|                 Next.js / React UI                   |
|   (Dashboard, Hub, Player, Analytics, Admin, Reports) |
+---------------------------+---------------------------+
                            | REST API (JWT Bearer)
                            v
+-------------------------------------------------------+
|             Spring Boot Application Server            |
|  (Security Filter, Video Engine, AI Pipeline Orchestrator) |
+----+----------------------+---------------------+-----+
     |                      |                     |
     v                      v                     v
+------------+       +---------------+     +---------------+
|   FFmpeg   |       |  Whisper STT  |     |   Database    |
| Audio/Thumb|       |  & AI Engine  |     | (H2 / MySQL)  |
+------------+       +---------------+     +---------------+
```

## 7. Database Architecture
The platform maintains strict relational integrity across 8 core entities:
1. `users` (id, username, email, password, role, timestamps)
2. `videos` (id, user_id, title, description, filepath, duration, resolution, codec, status, timestamps)
3. `video_processing` (id, video_id, status, task_type, error_message, started_at, completed_at)
4. `transcripts` (id, video_id, full_text, language, confidence, word_count, created_at)
5. `transcript_segments` (id, transcript_id, start_time, end_time, text, speaker, confidence)
6. `summaries` (id, video_id, short_summary, detailed_summary, key_points, main_topics, action_items, keywords)
7. `key_moments` (id, video_id, title, description, start_time, end_time, relevance_score, keywords)
8. `keywords` (id, video_id, keyword, frequency, relevance, timestamp, category)
9. `reports` (id, video_id, report_type, content, generated_at)

## 8. AI Workflow
1. **Audio Isolation**: FFmpeg extracts mono 16kHz WAV audio.
2. **Acoustic Transcription**: Whisper STT processes acoustic buffers into timestamped segment arrays.
3. **NLP Synthesis**: Deep summarization decomposes transcripts into Short Summaries, Detailed Narratives, Key Takeaways, and Action Items.
4. **Semantic Extraction**: Chapter markers and TF-IDF keyword relevance scores are indexed with precise start/end markers.

## 9. Video Processing Workflow
Lifecycle Pipeline States:
```
UPLOADED ──> QUEUED ──> PROCESSING (FFmpeg) ──> TRANSCRIBING (Whisper) ──> SUMMARIZING (NLP) ──> ANALYZING (Moments) ──> COMPLETED
```

## 10. Frontend Structure
```
frontend/
├── src/
│   ├── components/       # Navbar, Footer, PrivateRoute
│   ├── context/          # AuthContext (JWT session management)
│   ├── pages/            # Landing, Login, Register, Dashboard, Upload,
│   │                     # MyVideos, VideoDetails (Hub), Analytics, Reports, AdminUsers, Profile
│   ├── services/         # api.js (REST client with progress tracking)
│   ├── App.jsx           # Client-side router configuration
│   └── main.jsx          # Root initialization
```

## 11. Backend Structure
```
backend/
├── src/main/java/com/clipmind/
│   ├── controller/       # Auth, Video, Transcript, Summary, KeyMoment, Keyword, Analytics, Report, Admin
│   ├── dto/              # Response & Request Data Transfer Objects
│   ├── model/            # JPA Domain Entities (User, Video, Transcript, Summary, KeyMoment, Keyword, Report)
│   ├── repository/       # Spring Data JPA Repositories
│   ├── security/         # SecurityConfig, JwtAuthenticationFilter, JwtTokenProvider, UserPrincipal
│   ├── service/          # Service interfaces & business logic implementations
│   └── ClipMindApplication.java
└── src/main/resources/   # application.properties, schema.sql
```

## 12. API Documentation
### Authentication
- `POST /api/auth/register`: Register new user account.
- `POST /api/auth/login`: Authenticate and receive JWT token.
- `GET /api/users/profile`: Get current user profile.

### Video Operations
- `POST /api/videos/upload`: Upload video file (multipart form-data).
- `GET /api/videos`: List all videos owned by user.
- `GET /api/videos/{id}`: Get video metadata and status.
- `GET /api/videos/{id}/thumbnail`: Stream video scene thumbnail.
- `GET /api/videos/{id}/stream`: Stream native video media.
- `DELETE /api/videos/{id}`: Delete video and all associated intelligence data.

### Video Intelligence
- `GET /api/videos/{id}/transcript`: Fetch full transcript and timestamped segments.
- `GET /api/videos/{id}/transcript/export`: Download transcript as `.txt`.
- `GET /api/videos/{id}/summary`: Fetch AI short/detailed summaries, key points, topics, and action items.
- `POST /api/videos/{id}/summary/regenerate`: Force AI summary re-synthesis.
- `GET /api/videos/{id}/key-moments`: Get detected semantic key moments.
- `GET /api/videos/{id}/keywords`: Get extracted keyword frequencies and relevance.
- `GET /api/videos/{id}/report`: Fetch structured Markdown intelligence dossier.
- `GET /api/videos/{id}/report/download`: Download `.md` report dossier.

### Analytics & Administration
- `GET /api/analytics/dashboard`: System-wide telemetry metrics.
- `GET /api/analytics/videos/{id}`: Video specific speech telemetry (WPM, sentiment).
- `GET /api/admin/users`: [Admin only] Manage all platform users.
- `PUT /api/admin/users/{id}/role`: [Admin only] Update user role.
- `DELETE /api/admin/users/{id}`: [Admin only] Delete platform user.

---

## 13. Installation
### Prerequisites
- Java 17+
- Node.js 18+ (Node.js 22 recommended)
- FFmpeg (automatically detected if installed via WinGet / apt)

---

## 14. Environment Variables
Create a `.env` file or export the following variables:
```bash
# Backend Configuration
CLIPMIND_JWT_SECRET=your_jwt_secret_key_here
CLIPMIND_FFMPEG_PATH=ffmpeg
CLIPMIND_FFPROBE_PATH=ffprobe

# Frontend Configuration
VITE_API_URL=http://localhost:8080/api
```

---

## 15. Running the Backend
From the `backend` directory:
```bash
# Windows
.\mvnw.cmd spring-boot:run

# Linux / macOS
./mvnw spring-boot:run
```
The backend starts on `http://localhost:8080`.

---

## 16. Running the Frontend
From the `frontend` directory:
```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Build for production
npm run build
```
The frontend starts on `http://localhost:5173`.

---

## 17. Running with Docker
To launch the entire platform (Database, Spring Boot Backend with FFmpeg, and Nginx Frontend) with one command:
```bash
docker compose up --build
```
- Access Frontend: `http://localhost:3000`
- Access Backend API: `http://localhost:8080/api`

---

## 18. Testing & Quality Assurance
Run backend automated unit and integration tests:
```bash
cd backend
.\mvnw.cmd test
```
Verify frontend build compilation:
```bash
cd frontend
npm run build
```

---

## 19. Deployment Guide
1. Configure MySQL database and specify `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`.
2. Generate a secure 512-bit string for `CLIPMIND_JWT_SECRET`.
3. Deploy containers using `docker compose up -d`.

---

## 20. Future Enhancements
- Multi-speaker diarization with visual voice separation.
- Live streaming RTSP/HLS real-time transcription feed.
- Cross-video semantic vector search with embedding databases (Milvus / Pinecone).
- Automated AI video reel generator (auto-cut 30-second shorts from key moments).