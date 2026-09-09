#!/usr/bin/env bash
# ==========================================
# Render Backend Start Script
# ==========================================
set -euo pipefail

export DATABASE_URL="${DATABASE_URL:-sqlite:////app/data/clipmind.db}"
export PORT="${PORT:-8000}"

echo "==> [Render] Starting ClipMind AI FastAPI Server on port ${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 2 --proxy-headers
