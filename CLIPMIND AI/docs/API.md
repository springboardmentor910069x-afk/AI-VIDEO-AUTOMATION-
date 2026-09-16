# ClipMind AI — RESTful API Specification

The ClipMind AI backend is built with FastAPI and provides high-performance asynchronous REST endpoints along with real-time WebSocket telemetry.

- **Base URL**: `http://localhost:8000/api/v1`
- **Interactive Documentation (Swagger UI)**: `http://localhost:8000/docs`
- **Alternative Documentation (ReDoc)**: `http://localhost:8000/redoc`

---

## 1. Authentication & Security Scheme

ClipMind AI utilizes standard OAuth2 with Password Bearer flow and JSON Web Tokens (JWT).

### Headers
```http
Authorization: Bearer <jwt_access_token>
```

### Roles Matrix & Permissions

| Role | Permitted Access Scope |
| :--- | :--- |
| **Creator** | Upload videos, ingest YouTube URLs, generate summaries, delete own videos, create bookmarks, export reports. |
| **Educator** | Access Educator Studio, edit transcripts, curate chapters, build custom quizzes, design flashcard sets, publish curricula. |
| **Learner** | View accessible lectures, access interactive study rooms, take quizzes, flip flashcards, track study progress. |
| **Admin** | Full system governance, view and manage all users, toggle user roles, inspect audit logs, clean system cache, view health metrics. |

---

## 2. API Endpoints Reference

### Authentication (`/auth`)

#### `POST /auth/register`
Create a new user account.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "full_name": "Jane Doe",
    "role": "learner"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": 1,
    "email": "user@example.com",
    "full_name": "Jane Doe",
    "role": "learner",
    "created_at": "2026-09-14T00:00:00Z"
  }
  ```

#### `POST /auth/login`
Authenticate with credentials and obtain a JWT access token.
- **Content-Type**: `application/x-www-form-urlencoded`
- **Request Body**: `username=creator@clipmind.ai&password=Password123!`
- **Response**: `200 OK`
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "6aa60488aa03d72a6ae96768",
      "email": "creator@clipmind.ai",
      "name": "Creator Demo",
      "role": "Creator"
    }
  }
  ```

#### `POST /auth/google`
Authenticate using modern Google Identity Services (OAuth 2.0). Supports both popup access tokens (`ya29...`) and JWT credential tokens. Automatically provisions or updates user profile.
- **Request Body**:
  ```json
  {
    "credential": "ya29.a0AfH6SM...",
    "email": "user@gmail.com",
    "name": "User Name",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "role": "Learner"
  }
  ```
- **Response**: `200 OK` with JWT `access_token`, `refresh_token`, and user profile.

#### `GET /auth/me`
Retrieve authenticated user profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

---

### Video Ingestion & Intelligence (`/videos`)

#### `POST /videos/upload`
Upload a raw video file (`.mp4`, `.mov`, `.mkv`) for AI analysis. Automatically backs up to personal Google Drive when connected.
- **Security**: Optional / Authenticated
- **Content-Type**: `multipart/form-data`
- **Form Fields**: 
  - `file` (binary, optional if `video_url` provided)
  - `video_url` (string, optional YouTube/Web URL)
  - `title` (string, optional)
  - `summary_depth` (string, `Short TL;DR` | `Detailed Breakdown` | `Full Study Guide`)
  - `domain` (string, `Academic Lecture` | `Tech Demo` | `Business Meeting` | `General`)
  - `storage_target` (string, `local` | `google_drive`)
- **Response**: `200 OK` with VideoResponse object and dispatched background processing pipeline.

#### `GET /videos/{video_id}/stream`
Streams video media supporting **HTTP 206 Partial Content byte-range requests** for HTML5 `<video>` scrubbing. Seamlessly proxies from personal Google Drive API if cloud-stored, or resolves local disk across host paths, falling back to guaranteed bundled lecture asset on disk resets.
- **Headers**: `Range: bytes=0-`
- **Response**: `206 Partial Content` (or `200 OK`) with `Content-Range`, `Accept-Ranges: bytes`, `Content-Type: video/mp4`.

#### `POST /videos/url`
Ingest video content via YouTube URL.
- **Request Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=example",
    "title": "Introduction to Neural Networks"
  }
  ```
- **Response**: `200 OK`

#### `GET /videos`
List all ingested videos in the user's library with filtering and pagination.
- **Query Params**: `search` (string), `category` (string), `status` (string), `limit` (int, default 50), `offset` (int, default 0)
- **Response**: `200 OK`

#### `GET /videos/{video_id}`
Fetch detailed metadata, processing status, and duration for a specific video.
- **Response**: `200 OK`

#### `DELETE /videos/{video_id}`
Securely delete a video. Cascades deletion across physical media on disk, Google Drive files, generated exports, and all child MongoDB documents (`Transcript`, `Summary`, `KeyMoment`, `Bookmark`, `Quiz`, `FlashcardSet`).
- **Security**: Required (Video Owner or `Admin`)
- **Response**: `200 OK`

#### `GET /videos/{video_id}/export`
Generate and download intelligence reports in multiple formats.
- **Query Params**: `format` (`pdf` | `docx` | `txt` | `srt` | `vtt`)
- **Response**: `200 OK` with binary streaming file download.

---

### Transcripts & Summaries (`/videos/{video_id}/...`)

#### `GET /videos/{video_id}/transcript`
Retrieve word-level and chunked speech-to-text transcript.
- **Response**: `200 OK`
  ```json
  {
    "video_id": "6aa60488aa03d72a6ae96768",
    "language": "en",
    "full_text": "...",
    "segments": [
      {
        "start": 0.0,
        "end": 4.5,
        "speaker": "Speaker 1",
        "text": "Welcome to today's lecture on artificial intelligence."
      }
    ]
  }
  ```

#### `GET /videos/{video_id}/summary`
Retrieve multi-depth summaries and structured sections.
- **Response**: `200 OK`
  ```json
  {
    "tldr": "A concise overview of machine learning architectures...",
    "detailed_summary": "...",
    "key_takeaways": [
      "Convolutional layers extract spatial hierarchies.",
      "Backpropagation minimizes loss via gradient descent."
    ],
    "sections": []
  }
  ```

#### `GET /summaries/{video_id}/mindmap`
Retrieve hierarchical concept mind map synthesized from video summary chapters, key takeaways, and key moment markers. Supports visual graph rendering with pannable/zoomable nodes, search filtering, SVG export, and timestamp seek chips.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "video_id": "6aa60488aa03d72a6ae96768",
    "mindmap": {
      "id": "root",
      "label": "Neural Networks & Deep Learning",
      "depth": 0,
      "color": "#6366F1",
      "summary": "Core architectural concepts in modern machine learning.",
      "children": [
        {
          "id": "branch-1",
          "label": "Activation Functions",
          "depth": 1,
          "color": "#06B6D4",
          "timestamp": "02:15",
          "timeSeconds": 135,
          "summary": "Non-linear transformations across dense layers.",
          "children": []
        }
      ]
    }
  }
  ```

#### `GET /videos/{video_id}/key-moments`
Retrieve visual and semantic key moments with timestamps and importance scores.
- **Response**: `200 OK`

---

### Educator Curriculum Suite (`/educator`)

#### `GET /educator/lectures`
List all lectures available for curriculum authoring.
- **Security**: Required (`Educator`, `Admin`)
- **Response**: `200 OK`

#### `POST /educator/lectures/{video_id}/chapters`
Persist custom curriculum chapter breakdown to MongoDB `Summary.sections`.
- **Security**: Required (`Educator`, `Admin`)
- **Request Body**:
  ```json
  {
    "chapters": [
      {
        "title": "Introduction to Vectors",
        "start_time": 0.0,
        "end_time": 120.0,
        "description": "Foundations of linear algebra in n-dimensional space."
      }
    ]
  }
  ```
- **Response**: `200 OK`

#### `POST /educator/lectures/{video_id}/quiz`
Create or update custom evaluation quiz for the lecture.
- **Security**: Required (`Educator`, `Admin`)
- **Request Body**:
  ```json
  {
    "questions": [
      {
        "id": "q1",
        "question": "What is the primary function of an activation layer?",
        "options": ["Introduce non-linearity", "Scale weights", "Store gradients", "Normalize inputs"],
        "correct_answer": 0,
        "explanation": "Activation functions introduce non-linearities allowing neural nets to model complex mappings."
      }
    ]
  }
  ```
- **Response**: `200 OK`

#### `POST /educator/lectures/{video_id}/flashcards`
Create or update active recall flashcard sets.
- **Security**: Required (`Educator`, `Admin`)
- **Request Body**:
  ```json
  {
    "flashcards": [
      {
        "id": "fc1",
        "front": "Gradient Descent",
        "back": "An optimization algorithm used to minimize the loss function.",
        "timestamp_sec": 45
      }
    ]
  }
  ```
- **Response**: `200 OK`

---

### Learner Study Room (`/learner`)

#### `GET /learner/videos/{video_id}/study`
Retrieve complete study package (video metadata, chapters, active quiz, flashcards). Falls back dynamically to AI-generated flashcards/quizzes if educator has not created a custom set.
- **Security**: Required (`Learner`, `Educator`, `Creator`, `Admin`)
- **Response**: `200 OK`

#### `POST /learner/quiz/{video_id}/submit`
Submit answers to lecture quiz and receive scored evaluation.
- **Response**: `200 OK`

---

### Admin Governance & Telemetry (`/admin`)

#### `GET /admin/users`
List all registered users with role and status indicators.
- **Security**: Required (`Admin`)
- **Response**: `200 OK`

#### `PUT /admin/users/{user_id}/role`
Update user authorization role.
- **Security**: Required (`Admin`)
- **Request Body**: `{"role": "educator"}`
- **Response**: `200 OK`

#### `GET /admin/audit-logs`
Retrieve chronological system audit logs (e.g., logins, deletions, cache clears).
- **Security**: Required (`Admin`)
- **Response**: `200 OK`

#### `POST /admin/clean-cache`
Purge orphaned temporary files and cached media.
- **Security**: Required (`Admin`)
- **Response**: `200 OK`
  ```json
  {
    "message": "Cache cleaned successfully."
  }
  ```

---

### Cloud Storage & System Settings (`/settings`)

#### `GET /settings/storage/status`
Check Google Drive Cloud Storage integration status, including user connection state, remaining 15 GB quota metrics, and active default storage destination.
- **Security**: Optional / Authenticated
- **Response**: `200 OK`
  ```json
  {
    "connected": true,
    "user_email": "user@gmail.com",
    "user_name": "User Name",
    "limit_gb": 15.0,
    "usage_gb": 1.45,
    "percent_used": 9.7,
    "storage_target": "google_drive"
  }
  ```

#### `POST /settings/storage/target`
Update the active default video storage destination (`local` or `google_drive`).
- **Security**: Optional / Authenticated
- **Request Body**:
  ```json
  {
    "storage_target": "google_drive"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "storage_target": "google_drive"
  }
  ```

#### `GET /settings/drive/authorize`
Initiates OAuth2 authorization flow with Google Drive API (`https://www.googleapis.com/auth/drive.file`). Returns Google OAuth consent URL.
- **Response**: `200 OK`
  ```json
  {
    "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
  ```

#### `GET /settings/drive/callback`
OAuth2 redirect callback that receives authorization code from Google, exchanges it for an access and refresh token, and stores it in the user's MongoDB `Setting` document.

---

### Real-Time WebSocket Telemetry (`/ws`)

#### `WebSocket /ws/videos/{video_id}`
Bidirectional WebSocket stream providing real-time pipeline status updates during processing.
- **Message Format**:
  ```json
  {
    "stage": "transcribing",
    "progress": 45.0,
    "status": "in_progress",
    "detail": "OpenAI Whisper processing audio chunk 2 of 4..."
  }
  ```
