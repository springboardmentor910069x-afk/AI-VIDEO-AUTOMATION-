# ClipMind AI

AI-powered video summarization and key moments detection platform.

## Architecture

```text
frontend/ Next.js + Tailwind UI
backend/  FastAPI, JWT auth, RBAC, uploads, AI service interfaces
infra/    Dockerfiles
docs/     SQL schema, MongoDB shapes, Postman collection
```

The backend uses SQLite by default for a fast local demo. Docker Compose switches it to PostgreSQL and includes MongoDB and Redis so the project has the production architecture requested. AI services support Groq or OpenAI for real speech transcription and summary generation, with a metadata/visual fallback when no provider is configured.

## Run Locally

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. FastAPI docs are at `http://localhost:8000/docs`.

## AI Provider

Recommended local setup with Groq:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_key
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
GROQ_SUMMARY_MODEL=llama-3.3-70b-versatile
```

OpenAI is also supported:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_SUMMARY_MODEL=gpt-4o-mini
```

After changing AI keys or provider settings, restart the backend and use `Regenerate` on existing videos.

## Docker

```bash
docker compose up --build
```

## Roles

`creator` and `educator` can upload and process videos. `learner` can view assigned accessible content in the UI shape. `admin` can view all videos and platform metrics.

## API Highlights

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/videos`
- `GET /api/videos/{video_id}/transcript`
- `GET /api/videos/{video_id}/summary`
- `GET /api/videos/{video_id}/key-moments`
- `GET /api/videos/{video_id}/analytics`
- `GET /api/videos/{video_id}/exports/txt`
- `GET /api/videos/{video_id}/exports/pdf`

## Tests

```bash
cd backend
PYTHONPATH=. pytest tests
```

## Deployment Notes

For AWS, run the backend on ECS/Fargate or App Runner, frontend on Amplify or Vercel, PostgreSQL on RDS, MongoDB on DocumentDB or Atlas, Redis on ElastiCache, and video files on S3. For Azure, use Container Apps, Static Web Apps, Azure Database for PostgreSQL, Cosmos DB Mongo API, Azure Cache for Redis, and Blob Storage.
