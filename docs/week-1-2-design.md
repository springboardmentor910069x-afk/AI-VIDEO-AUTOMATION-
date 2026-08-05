# ClipMind AI: Week 1-2 Design

## Scope boundary

This design covers initialization, media workflow planning, UI planning, environments, authentication/roles, video uploads, and FFmpeg processing only. It intentionally excludes Whisper, transcripts, summaries, key moments, analytics, Docker/cloud deployment, and testing for those modules.

## Objectives and media workflow

1. Give creators and educators a safe, role-controlled way to upload supported videos.
2. Preserve the original media and immutable upload metadata.
3. Immediately run lightweight FFmpeg inspection to establish duration/resolution and create a thumbnail.
4. Present clear progress and error status instead of blocking the upload request.

```mermaid
flowchart LR
  A[Authenticated creator / educator] --> B[Validate file type and size]
  B --> C[Private uploads storage]
  C --> D[Create video record: processing]
  D --> E[Background FFprobe metadata]
  E --> F[FFmpeg thumbnail]
  F --> G[Video record: ready]
  E --> H[Status: needs_ffmpeg or failed]
```

## System architecture

```mermaid
flowchart TB
  UI[React + Vite web client] -->|JWT REST requests| API[FastAPI API]
  API --> AUTH[PBKDF2 passwords + JWT]
  API --> DB[(SQLite dev / PostgreSQL production)]
  API --> STORE[Private local video storage]
  API --> JOB[Background task]
  JOB --> FF[FFprobe + FFmpeg]
  FF --> STORE
  FF --> DB
```

## Database schema

```mermaid
erDiagram
  USERS ||--o{ VIDEOS : uploads
  USERS {
    uuid id PK
    string email UK
    string name
    string password_hash
    string role
    datetime created_at
  }
  VIDEOS {
    uuid id PK
    uuid owner_id FK
    string original_name
    string stored_name
    string mime_type
    int size_bytes
    string status
    float duration_seconds
    string resolution
    string processing_error
    string thumbnail_name
    datetime created_at
  }
```

### Roles and access

| Role | Browse videos | Upload | Delete |
| --- | --- | --- | --- |
| Creator | Own uploads | Yes | Own uploads |
| Educator | Own uploads | Yes | Own uploads |
| Learner | All listed videos | No | No |
| Admin | All videos | Yes | Any video |

## UI wireframes

### Authentication

```text
+----------------------------------------------------+
| CLIPMIND AI / WEEK 1-2                             |
| Video workspace for the processing pipeline        |
|                                                    |
| [ Sign in ] [ Create account ]                     |
| Email     [____________________]                   |
| Password  [____________________]                   |
|                 [ Sign in ]                        |
+----------------------------------------------------+
```

### Workspace

```text
+----------------------------------------------------+
| ClipMind AI                         User / role    |
| Video workspace                                   |
|                                                    |
| Bring in a video              [ Choose ] [ Upload] |
| MP4, MOV, WebM, AVI, MKV                           |
|                                                    |
| Your uploads                     [ Refresh ]       |
| [▶] lecture.mp4    PROCESSING   54.2 MB  [Delete]  |
| [▶] intro.mov     READY        31.0 MB  [Delete]  |
+----------------------------------------------------+
```

## Environment decisions

- Development database: SQLite, for instant local startup.
- Production migration: point `DATABASE_URL` to PostgreSQL and replace the small repository adapter with an ORM/migration layer. The schema above is database-neutral.
- Storage: private local folders during development. Replace with an object-store adapter (such as S3/Azure Blob) before deployment.
- Security: passwords use PBKDF2-HMAC-SHA256 with unique random salts; access is a signed, 8-hour JWT. Change `JWT_SECRET` before sharing or deployment.
- Processing: FastAPI `BackgroundTasks` is appropriate for this first milestone. A persistent job queue is explicitly deferred to later deployment work.
