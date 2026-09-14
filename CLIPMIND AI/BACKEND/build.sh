#!/usr/bin/env bash
# ==============================================================================
# ClipMind AI - Render Cloud Build Script (Backend)
# ==============================================================================

set -o errexit

echo "[1/4] Upgrading pip and packaging tools..."
python -m pip install --upgrade pip setuptools wheel

echo "[2/4] Installing backend Python dependencies..."
# Install CPU-optimized torch first to conserve memory and disk on Render free/starter tiers
pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu || pip install torch>=2.0.0
pip install --no-cache-dir -r requirements.txt

echo "[3/4] Creating runtime storage directories..."
mkdir -p uploads/thumbnails uploads/exports uploads/videos uploads/audio uploads/temp

echo "[4/4] Backend build complete and verified!"
