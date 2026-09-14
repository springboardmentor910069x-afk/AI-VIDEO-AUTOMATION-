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
6. Click **Create Web Service**. Wait for build to complete.
7. Copy the generated backend URL (e.g., `https://clipmind-backend-xyz.onrender.com`).

---

### B. Deploy Frontend UI (`clipmind-frontend`)
1. In Render Dashboard, click **New +** -> **Static Site**.
2. Select your GitHub repository.
3. Configure the following fields:
   - **Name**: `clipmind-frontend`
   - **Branch**: `main`
   - **Root Directory**: `CLIPMIND AI/FRONTEND`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Under **Environment Variables**, add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_BACKEND_URL` | `https://clipmind-backend-xyz.onrender.com` *(your backend URL from Step A)* |
5. Expand **Redirects/Rewrites** -> Click **Add Rule**:
   - **Type**: `Rewrite`
   - **Source**: `/*`
   - **Destination**: `/index.html`
   *(This ensures client-side React Router navigation works properly on page refresh)*.
6. Click **Create Static Site**.
7. Once deployed, open your live frontend link!

---

## 🔍 5. Post-Deployment Verification Checklist

1. **Verify Backend Health**:
   Visit `https://<your-backend>.onrender.com/health` in your browser. You should receive:
   ```json
   {
     "status": "healthy",
     "app": "ClipMind AI",
     "version": "1.0.0",
     "services": {
       "database": { "status": "connected" },
       "storage": { "status": "ready", "writable": true },
       "ai_engine": { "status": "ready" }
     }
   }
   ```
2. **Verify Interactive Player**:
   - Open your frontend static site URL.
   - Register or log in to a demo account (`educator@clipmind.ai` / `Admin@123456`).
   - Open any video in the **Video Intelligence Center** or **Learner Study Room**.
   - Test playback speed change (`0.5x`, `1.5x`, `2.0x`): audio and video speed adjust instantly in real time.
   - Click Key Moment timeline cards and seekbar: playback seeks accurately.
   - Verify transcript auto-scrolls in sync with playback.

---

## 💡 6. Render Free Tier Tips

* **Free Web Service Sleep**: Render's free web services automatically sleep after 15 minutes of inactivity. When a request comes in, it takes ~30–45 seconds for the backend container to wake up. The frontend static site never sleeps.
* **Keep Alive (Optional)**: You can use a free pinging service like [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org) to ping your `/health` endpoint every 10 minutes to keep your backend warm 24/7.
* **CORS**: ClipMind AI's backend is pre-configured with wildcard origin regex (`r"^https?://.*$"`) and credentials support, so your frontend static site on `.onrender.com` or custom domains works out of the box with zero CORS errors.
