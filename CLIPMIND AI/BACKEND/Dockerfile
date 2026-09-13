# ==============================================================================
# ClipMind AI - Production Backend Container
# Platform: Python 3.11 + FastAPI + FFmpeg + OpenCV Support
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

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
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
COPY . .

# Create uploads and temp storage directories
RUN mkdir -p uploads/temp uploads/keyframes exports

EXPOSE 8000

ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

ENV PORT=8000

CMD ["python", "run.py"]
