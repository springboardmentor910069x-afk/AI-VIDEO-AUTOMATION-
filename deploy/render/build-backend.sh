#!/usr/bin/env bash
# ==========================================
# Render Backend Build Script
# ==========================================
set -euo pipefail

echo "==> [Render] Installing system dependencies (FFmpeg)..."
if command -v apt-get &> /dev/null; then
    apt-get update && apt-get install -y --no-install-recommends ffmpeg curl git
fi

echo "==> [Render] Upgrading Python package managers..."
python -m pip install --upgrade pip setuptools wheel

echo "==> [Render] Installing Python dependencies from requirements.txt..."
pip install -r requirements.txt

echo "==> [Render] Initializing database and storage folders..."
mkdir -p uploads thumbnails data

echo "==> [Render] Build step completed successfully!"
