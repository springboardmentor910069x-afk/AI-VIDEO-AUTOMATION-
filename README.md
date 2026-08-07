# ClipMind AI

Intelligent clip management platform with AI-powered features.

## Tech Stack

**Backend:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, JWT Auth
**Frontend:** React 18, Vite, Tailwind CSS, Axios, React Router

## Project Structure

```
ClipMind-AI/
├── backend/
│   ├── app/
│   │   ├── auth/          # JWT tokens, auth dependencies
│   │   ├── core/          # Config, logging
│   │   ├── database/      # Engine, session, base model
│   │   ├── models/        # SQLAlchemy models
│   │   ├── routers/       # FastAPI route handlers
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic layer
│   │   └── utils/         # Shared utilities
│   ├── alembic/           # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React context providers
│   │   ├── lib/           # API client, helpers
│   │   ├── pages/         # Route page components
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── .env.example
```

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

- Backend API: http://localhost:8000
- Frontend: http://localhost:5173
- API docs (debug mode): http://localhost:8000/docs

### Local Development

**Backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Roles

| Role    | Description            |
|---------|------------------------|
| student | Default role           |
| teacher | Content creator        |
| admin   | Full system access     |

## API Endpoints

| Method | Path                    | Auth | Role  |
|--------|------------------------|------|-------|
| GET    | /api/v1/health          | No   | —     |
| POST   | /api/v1/auth/register   | No   | —     |
| POST   | /api/v1/auth/login      | No   | —     |
| POST   | /api/v1/auth/refresh    | No   | —     |
| GET    | /api/v1/auth/me         | Yes  | Any   |
| GET    | /api/v1/users/          | Yes  | Admin |

## Environment Variables

See `.env.example` for all required variables.

| Variable             | Description                  | Default                             |
|----------------------|------------------------------|-------------------------------------|
| DATABASE_URL         | Async PostgreSQL URL         | postgresql+asyncpg://...@localhost  |
| SYNC_DATABASE_URL    | Sync PostgreSQL URL          | postgresql://...@localhost          |
| SECRET_KEY           | JWT signing key              | change-me-in-production             |
| DEBUG                | Enable debug mode            | false                               |
| CORS_ORIGINS         | Allowed CORS origins         | ["http://localhost:5173"]           |
| LOG_LEVEL            | Logging level                | INFO                                |

## License

MIT
