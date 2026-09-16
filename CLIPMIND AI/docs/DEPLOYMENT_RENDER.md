# 🚀 ClipMind AI — Render Cloud Deployment Guide

This guide provides step-by-step instructions to deploy the complete **ClipMind AI** platform to [Render](https://render.com) using free cloud tiers.

---

## 🏗 Deployment Architecture

ClipMind AI consists of two cloud components configured for Render:

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│       clipmind-frontend              │       │          clipmind-backend            │
│   Render Static Site (Free Tier)     │ ───►  │     Render Web Service (Python 3.11) │
│   Vite + React SPA /dist             │       │     FastAPI + Uvicorn + FFmpeg       │
└──────────────────────────────────────┘       └──────────────────┬───────────────────┘
                                                                  │
                                                                  ▼
                                               ┌──────────────────────────────────────┐
                                               │         MongoDB Atlas (Free M0)      │
                                               │      Cloud Document Database         │
                                               └──────────────────────────────────────┘
```

* **Frontend**: Hosted on Render as a **Static Site** (free, instant CDN delivery, zero sleep time, unlimited bandwidth, SPA routing rewrite `/* -> /index.html`).
* **Backend**: Hosted on Render as a **Web Service** (Python 3.11 runtime or Docker, automatic `$PORT` binding, health checks on `/health`).
* **Database**: Hosted on **MongoDB Atlas** (Free M0 cluster, 512MB storage, global replication).

---

## 📋 1. Prerequisites (Free Accounts)

1. **GitHub Account**: Push this repository to your GitHub account (`https://github.com/your-username/AI-VIDEO-AUTOMATION`).
2. **Render Account**: Sign up at [render.com](https://render.com) (free).
3. **MongoDB Atlas Account**: Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) (free).

---

## 🗄 2. Create Free MongoDB Atlas Database (2 minutes)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Create** -> Choose **M0 (Free)** tier -> Select any region (e.g. AWS / us-east-1).
3. Under **Security Quickstart**:
   - Create a database user (e.g., username: `<username>`, password: `<password>`).
   - Under **Where would you like to connect from?**, choose **Network Access / Allow Access from Anywhere** (`0.0.0.0/0`).
4. Click **Connect** -> Choose **Drivers** (Python).
5. Copy your connection string. It looks like:
   ```text
   mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/?retryWrites=true&w=majority
   ```

---

## ⚡ 3. Automated One-Click Deployment (Recommended)

Render provides automatic multi-service deployment via the repository's `render.yaml` Blueprint file.

1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository (`AI-VIDEO-AUTOMATION`).
4. Render will automatically detect `render.yaml` and discover both services:
   - `clipmind-backend` (Web Service)
   - `clipmind-frontend` (Static Site)
5. Fill in the requested prompt variables:
   - **`MONGODB_URL`**: Paste your MongoDB Atlas connection string from Step 2.
   - **`GROQ_API_KEY`** *(Optional)*: If you have a free Groq Cloud API key from [console.groq.com](https://console.groq.com), paste it here for accelerated cloud AI summaries.
6. Click **Apply**.
7. Render will build and deploy both services automatically!
   - Backend will be available at: `https://clipmind-backend-xxxx.onrender.com`
   - Frontend will be available at: `https://clipmind-frontend-xxxx.onrender.com`

---

## 🛠 4. Manual Deployment on Render (Alternative)

If you prefer to configure each service manually in the Render dashboard:

### A. Deploy Backend API (`clipmind-backend`)
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select your GitHub repository.
3. Configure the following fields:
   - **Name**: `clipmind-backend`
   - **Region**: `Oregon (US West)` (or closest to your MongoDB Atlas cluster)
   - **Branch**: `main`
   - **Root Directory**: `CLIPMIND AI/BACKEND`
   - **Runtime**: `Python 3`
   - **Build Command**: `bash build.sh`
   - **Start Command**: `python run.py`
   - **Instance Type**: `Free`
4. Expand **Advanced** -> **Health Check Path**: `/health`
5. Under **Environment Variables**, add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `PYTHON_VERSION` | `3.11.9` | Ensures Python 3.11 runtime |
   | `ENVIRONMENT` | `production` | Production mode |
   | `PORT` | `10000` | Render default port |
   | `SECRET_KEY` | *(Click 'Generate')* | Random JWT security token |
   | `MONGODB_URL` | `mongodb+srv://...` | Your Atlas connection URI |
   | `MONGODB_DB_NAME` | `clipmind_db` | Database name |
   | `WHISPER_CLOUD_ENABLED` | `true` | Uses lightweight transcription |
   | `GROQ_API_KEY` | *(Optional)* | Your Groq API key |
   | `ANALYTICS_ZERO_BASELINE` | `true` | Clean zero baseline analytics |
   | `GOOGLE_CLIENT_ID` | *(Optional)* | Google OAuth & Drive Client ID |
   | `GOOGLE_CLIENT_SECRET` | *(Optional)* | Google OAuth & Drive Client Secret |
   | `YOUTUBE_API_KEY` | *(Optional)* | YouTube Data API key for direct caption extraction |
6. Click **Create Web Service**. Wait for build to complete.
7. Copy the generated backend URL (e.g., `https://clipmind-backend-xyz.onrender.com`).

---

### B. Unified All-in-One Docker Deployment (Recommended Single Service)

Alternatively, deploy both frontend and backend inside a single Render Web Service using the root `Dockerfile`:
1. Click **New +** -> **Web Service** -> Select repository.
2. Set **Environment**: `Docker` (Render auto-detects `Dockerfile`).
3. Set Environment Variables (`MONGODB_URL`, `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.).
4. The Docker container compiles the React 19 SPA, builds Python 3.11 with FFmpeg, and serves both frontend static assets and API on port `8000`.

---

### C. Deploy Frontend UI (`clipmind-frontend`) via Static Site
1. In Render Dashboard, click **New +** -> **Static Site**.
2. Select your GitHub repository.
3. Configure the following fields:
   - **Name**: `clipmind-frontend`
   - **Branch**: `Intern-ADABALA-VENKATA-THRINADH` (or `main`)
   - **Root Directory**: `CLIPMIND AI/FRONTEND`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_BACKEND_URL` | `https://clipmind-backend-xyz.onrender.com` *(your backend URL)* |
   | `VITE_GOOGLE_CLIENT_ID` | `96783937366-dc7o4rjij1jb5tismndbl0m3lulps2r5.apps.googleusercontent.com` |
5. Expand **Redirects/Rewrites** -> Click **Add Rule**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
   *(Ensures client-side React Router navigation works properly on page refresh)*.
6. Click **Create Static Site**.

---

## ☁️ 5. Zero-Loss Persistent Storage with Google Drive

On Render free-tier instances, the local container filesystem is ephemeral and resets during container restarts or deployments. ClipMind AI solves this with native Google Drive cloud integration:

1. **Setup Google Cloud OAuth Credentials**:
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), enable **Google Drive API**.
   - Add Authorized JavaScript Origin: `https://your-frontend.onrender.com` and `http://localhost:5173`.
   - Add Authorized Redirect URI: `https://your-backend.onrender.com/api/v1/settings/drive/callback` and `http://localhost:8000/api/v1/settings/drive/callback`.
2. **Automatic Background Cloud Sync**:
   - When Google Drive is connected in **Account Settings > Cloud Storage**, local video uploads automatically sync to your personal 15 GB Google Drive in the background.
   - The video streaming router (`/api/v1/videos/{video_id}/stream`) proxies video byte streams with **HTTP 206 Partial Content range requests** directly from Google Drive, ensuring videos remain playable forever even through container restarts.

---

## 🔍 6. Post-Deployment Verification Checklist

1. **Verify Backend Health**: Visit `https://<your-backend>.onrender.com/health`.
2. **Verify Interactive Player & Mind Maps**:
   - Open any video in **Video Intelligence Center**.
   - Verify smooth scrubbing with HTTP 206 partial content streaming.
   - Click the **Mind Map** tab to inspect the interactive concept hierarchy with clickable timestamp seek chips.
3. **Verify Google OAuth Login**: Click "Continue with Google" on the login modal.

---

## 💡 7. Render Free Tier Tips

* **Free Web Service Sleep**: Render's free web services automatically sleep after 15 minutes of inactivity. When a request comes in, it takes ~30–45 seconds for the backend container to wake up. The frontend static site never sleeps.
* **Keep Alive (Optional)**: You can use a free pinging service like [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org) to ping your `/health` endpoint every 10 minutes to keep your backend warm 24/7.
* **CORS**: ClipMind AI's backend is pre-configured with wildcard origin regex (`r"^https?://.*$"`) and credentials support, so your frontend static site on `.onrender.com` or custom domains works out of the box with zero CORS errors.
