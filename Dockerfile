# ==============================================================================
# ClipMind AI - Production Backend Container (Repository Root Dockerfile)
# Platform: Python 3.11-slim + FastAPI + FFmpeg + OpenCV Support
# ==============================================================================

FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies and FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements from CLIPMIND AI/BACKEND
COPY ["CLIPMIND AI/BACKEND/requirements.txt", "./"]
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu || pip install torch>=2.0.0 && \
    pip install --no-cache-dir -r requirements.txt

# Final Production Stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime FFmpeg and graphics libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python dependencies from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy backend application code
COPY ["CLIPMIND AI/BACKEND/", "./"]

# Create uploads and temp storage directories
RUN mkdir -p uploads/thumbnails uploads/exports uploads/videos uploads/audio uploads/temp uploads/keyframes

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PORT=8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "run.py"]
