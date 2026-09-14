# ==============================================================================
# ClipMind AI — All-in-One Full-Stack Production Container (Render Single Service)
# Stage 1: Compile React 19 + TypeScript Frontend SPA (Vite)
# Stage 2: Install Python Dependencies & System Binaries (FFmpeg)
# Stage 3: Unified Production Runtime (FastAPI serves both API & React SPA on 1 port)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend SPA Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies first for layer caching
COPY ["CLIPMIND AI/FRONTEND/package*.json", "./"]
RUN npm install --legacy-peer-deps

# Copy frontend source code and compile production bundle
COPY ["CLIPMIND AI/FRONTEND/", "./"]
ENV VITE_BACKEND_URL=""
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Python Backend Dependency Builder
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS backend-builder

WORKDIR /app

# Install system build tools and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY ["CLIPMIND AI/BACKEND/requirements.txt", "./"]
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu || pip install torch>=2.0.0 && \
    pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 3: Final All-in-One Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# Install runtime FFmpeg, graphics, and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from backend-builder
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy backend application source
COPY ["CLIPMIND AI/BACKEND/", "./"]

# Copy compiled React frontend bundle into /app/dist (FastAPI automatically serves this)
COPY --from=frontend-builder /frontend/dist ./dist

# Create runtime storage directories
RUN mkdir -p uploads/thumbnails uploads/exports uploads/videos uploads/audio uploads/temp uploads/keyframes

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "run.py"]
