# ClipMind AI — Video Summarization & Key Moments Detection Platform

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React.js](https://img.shields.io/badge/React.js-19.0-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.0-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Local-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

Official repository for **ClipMind AI: Video Summarization & Key Moments Detection Platform**, built strictly according to the **Infosys Springboard Internship Project Specification** (`AI_Video Summarization & Key Moments Detection Platform (1).pdf`).

---

## 1. Title & Objective

* **Title**: ClipMind AI: Video Summarization & Key Moments Detection Platform
* **Objective**: Build an AI-powered video summarization platform that automatically analyzes videos, extracts transcripts, generates concise summaries, and identifies important moments within video content.
* **Target Audience**: Content creators, students, educators, media organizations, businesses, researchers, and online learning platforms.

---

## 2. Project Outcomes

- ✅ Developed and deployed an AI-powered video summarization and key moments detection platform.
- ✅ Implemented authentication and role-based access control systems (Content Creator, Learner, Educator, Administrator).
- ✅ Built video upload and processing workflows.
- ✅ Developed speech-to-text transcription systems using AI models.
- ✅ Implemented AI-powered summary generation and content abstraction modules.
- ✅ Built key moments detection and timestamp extraction systems.
- ✅ Developed analytics dashboards for content insights and usage monitoring.
- ✅ Deployed the platform using Docker and cloud deployment platforms such as AWS or Azure.

---

## 3. Architecture Diagram

```
                               ClipMind AI – AI Video Summarizer System Architecture
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                 USERS & ROLES                                                    │
│  ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌─────────────────────────────────┐  │
│  │  Content Creators  │   │      Learners      │   │     Educators      │   │         Administrators          │  │
│  └────────────────────┘   └────────────────────┘   └────────────────────┘   └─────────────────────────────────┘  │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                         │
┌────────────────────────────────────────────────────────▼─────────────────────────────────────────────────────────┐
│                                             WEB / MOBILE APPLICATION                                             │
│      [Dashboard]  [Upload Video]  [Transcripts]  [Summaries]  [Key Moments]  [Analytics]  [Notifications]        │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                         │
┌────────────────────────────────────────────────────────▼─────────────────────────────────────────────────────────┐
│                                                   API GATEWAY                                                    │
│        [Authentication (JWT / OAuth 2.0)]   [Request Routing]   [Authorization]   [Rate Limiting & Monitoring]   │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                         │
┌────────────────────────────────────────────────────────▼─────────────────────────────────────────────────────────┐
│                                      VIDEO PROCESSING & AI ANALYTICS PIPELINE                                    │
│  1. Video Upload ──► 2. Processing ──► 3. Speech-to-Text ──► 4. AI Summary ──► 5. Key Moments ──► 6. Delivery    │
│     (Storage)         (FFmpeg/OpenCV)   (OpenAI Whisper)      (BART / T5)      (Timestamps)     (PDF/DOCX/TXT)   │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                         │
┌────────────────────────────────────────────────────────▼─────────────────────────────────────────────────────────┐
│                                              DATA & STORAGE LAYER                                                │
│    [PostgreSQL User DB]    [AWS S3 Video Storage]    [MongoDB Transcripts & Summaries]    [Analytics Warehouse]  │
└────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                                         │
┌────────────────────────────────────────────────────────▼─────────────────────────────────────────────────────────┐
│                                              INFRASTRUCTURE LAYER                                                │
│      [Cloud (AWS/Azure)]    [Docker Containers]    [Kubernetes]    [Load Balancer]    [WAF/Security]    [CI/CD] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Modules Implemented

### 1. User Management Module
* User registration and login
* Profile management
* Role-based access control (Content Creator, Learner, Educator, Administrator)
* Activity history

### 2. Video Upload Module
* Video upload & file validation
* Video storage (Cloud & local fallback)
* Upload history

### 3. Transcript Generation Module
* Speech-to-text conversion (**OpenAI Whisper**)
* Transcript generation & editing
* Transcript storage (**MongoDB**)

### 4. Video Summarization Module
* AI summary generation (**BART** / **T5**)
* Short summary creation (TL;DR)
* Detailed summary generation & content abstraction

### 5. Key Moments Detection Module
* Timestamp generation
* Important segment identification
* Highlight extraction (**FFmpeg** & **OpenCV**)
* Topic segmentation

### 6. Analytics Dashboard Module
* Video analytics & summary reports
* Content insights & usage statistics

### 7. AI Processing Module
* Speech recognition models (**OpenAI Whisper**)
* NLP summarization models (**Hugging Face Transformers**)
* Keyword extraction & content analysis workflows

---

## 5. Tools & Tech Stack (Section 7 of PDF)

### Programming Language
* **Backend**: Python (FastAPI)
* **Frontend**: React.js / Next.js

### Database
* **PostgreSQL**: User accounts, authentication, role policies, video metadata.
* **MongoDB**: Transcript documents, structured summaries, key moments metadata.

### AI & Machine Learning
* **OpenAI Whisper** (Speech-to-Text ASR Model)
* **Hugging Face Transformers** (BART, T5)
* **TensorFlow** / **PyTorch**

### Video Processing
* **FFmpeg** (Audio extraction, frame extraction, standardization)
* **OpenCV** (Visual scene change detection & key moment extraction)

### Cloud & DevOps
* **Docker & Docker Compose** (Containerization)
* **AWS / Azure** (Cloud deployment & object storage)

### Libraries & Frameworks
* FastAPI, React.js, Next.js, Tailwind CSS, JWT Authentication, Hugging Face Transformers, Whisper, OpenCV

### Dev & Deployment Tools
* **IDE**: VS Code
* **Version Control**: Git + GitHub
* **Containerization**: Docker & Docker Compose
* **Cloud**: AWS / Azure
* **API Testing**: Postman
* **Monitoring**: Logging & Monitoring Tools (Prometheus / Grafana)

---

## 6. Week-wise Milestones

* **Milestone 1 (Week 1 & 2)**: Project Initialization, Design Process, Core Setup, Authentication, Video Upload Workflows, FFmpeg Video Processing.
* **Milestone 2 (Week 3 & 4)**: Transcript Generation & AI Summarization, OpenAI Whisper Integration, BART/T5 Summarization, Transcript Management.
* **Milestone 3 (Week 5 & 6)**: Key Moments Detection & Analytics Dashboard, Timestamp Extraction, OpenCV Highlight Extraction, Analytics & Usage Reports.
* **Milestone 4 (Week 7 & 8)**: Testing, Deployment & Documentation, Docker Containerization, Live Cloud Demonstration.

---

## 7. Performance Metrics & Quantitative Goals

* **Transcript Generation**: High-accuracy speech-to-text conversion (WER < 4.5%).
* **Video Summarization**: Concise and relevant AI-powered summaries for long-form content.
* **Key Moments Detection**: Identify important video segments and timestamps with high accuracy.
* **Platform Performance**: Support concurrent video processing and analytics workloads with stable system performance.

---

## 🚀 Quick Start & How to Run

### Instant One-Click Launcher
Run the instant launcher script:
```powershell
.\start.bat
```

---

## 👥 Verified Demo Accounts

> [!NOTE]
> **Admin Account Security**: Admin accounts **cannot** be created through public registration on the frontend or the public auth API (attempts return `HTTP 403 Forbidden`). Only existing Administrators or backend operators can provision Admin accounts.

All four role-based demo accounts are pre-configured in the cloud database (MongoDB Atlas) and ready for live evaluation:

| Role | Email | Password | Allowed Dashboards & Permissions |
| :--- | :--- | :--- | :--- |
| **🎬 Creator** | `creator@clipmind.ai` | `password123` | Overview, Upload Studio, Video Library, AI Chatbot, Bookmarks, Personal Analytics, Settings |
| **🎓 Learner** | `learner@clipmind.ai` | `password123` | AI Study Room & Lecture Chat, My Lectures, Study Flashcards & Quizzes, Learning Stats, Settings |
| **✏️ Educator** | `educator@clipmind.ai` | `password123` | Lecture Studio, Curriculum/Transcript Editor, Upload Lecture, Course Content, Student Analytics, Settings |
| **🛡️ Admin** | `admin@clipmind.ai` | `password123` | Admin Console, User Governance, Video Catalog Operations, Audit Logs, System Analytics, Cache Cleanup, Settings |


### Manual Backend Setup
```bash
cd BACKEND
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```
- **Backend API**: `http://127.0.0.1:8000`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`

### Manual Frontend Setup
```bash
cd FRONTEND
npm install
npm run dev
```
- **Frontend Portal**: `http://localhost:5173`
