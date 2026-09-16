# ClipMind AI — Live Project Demonstration Script
## Step-by-Step Live Walkthrough & Narration Guide

**Project Title**: ClipMind AI: Video Summarization & Key Moments Detection Platform  
**Demonstrator**: Adabala Venkata Thrinadh (B.Tech CSE, GMRIT)  
**Target Duration**: 8 to 12 Minutes  
**Demonstration Scope**: Setup, Ingestion, Zero-Loss Cloud, Real-Time Processing, 4 Role Workspaces, 5-Tab Educator Studio, Concept Mind Map, Learner Room, and Exports  

---

### Phase 1: Environment Startup & Architecture Initialization (1 Minute)

#### Action:
1. Open PowerShell or Terminal.
2. In terminal 1, start the FastAPI backend:
   ```bash
   cd "d:\SPRING BOARD\AI-VIDEO-AUTOMATION-\CLIPMIND AI\BACKEND"
   venv\Scripts\activate
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
3. In terminal 2, start the React frontend:
   ```bash
   cd "d:\SPRING BOARD\AI-VIDEO-AUTOMATION-\CLIPMIND AI\FRONTEND"
   npm run dev
   ```
4. Open the browser at `http://localhost:5173`.

#### Narration:
> *"To begin our live demonstration, our backend is running on FastAPI at port 8000, and our frontend is being served by Vite at port 5173.  
> As the application loads, notice our bespoke, human-crafted design system inspired by Linear, Raycast, and Vercel. We have eliminated generic AI template styles in favor of custom SVG icons, micro-animations, and full responsive support for mobile, tablet, and desktop in both light and dark themes."*

---

### Phase 2: Authentication, OAuth & Google Drive Zero-Loss Cloud (2 Minutes)

#### Action:
1. Click the **Login** button on the navigation bar.
2. Demonstrate both login flows:
   - **One-Click Google Login**: Authenticates via Google Identity Services and automatically authorizes the `drive.file` scope.
   - **Role Credentials Switcher**:
     - Creator: `creator@clipmind.ai` / `Creator@123`
     - Learner: `learner@clipmind.ai` / `Learner@123`
     - Educator: `educator@clipmind.ai` / `Educator@123`
     - Admin: `admin@clipmind.ai` / `Admin@123`
3. Navigate to **Account Settings** and show the Google Drive status:
   - Point out: *"Google Drive connected: 15 GB persistent personal storage available."*

#### Narration:
> *"ClipMind AI enforces Role-Based Access Control using stateless JWT tokens signed with HMAC-SHA256, and supports Google Identity Services for one-click authentication.  
> When a user connects Google Drive, ClipMind AI enables our **Zero-Loss Auto-Cloud Backup**. Cloud deployments like Render wipe container disks upon restarting. By linking Google Drive, newly uploaded videos are automatically backed up in the background. Even if the container disk resets completely, the video continues streaming without interruption via our HTTP 206 chunked proxy, and the AI pipeline downloads the file on demand for processing."*

---

### Phase 3: Video Ingestion & Real-Time Processing Pipeline (2.5 Minutes)

#### Action:
1. Navigate to the **Upload** page.
2. Demonstrate drag-and-drop file upload (`.mp4`, `.mov`, `.mkv`) or paste a sample educational YouTube link.
3. Click **Process Video**.
4. Observe the live animated progress bar driven by WebSockets:
   - 15% `stage1_upload` (Metadata validated)
   - 35% `stage2_processing` (Audio demuxed via FFmpeg to 16kHz mono WAV)
   - 65% `stage3_transcription` (Whisper ASR word-level timestamps)
   - 75% `stage4_summarization` (LexRank graph centrality & LLM chapters)
   - 85% `stage5_key_moments` (OpenCV 1 fps slide-cut detection)
   - 90% `stage6_content_insights` (Concept mind map & topic graphs)
   - 100% `completed` (Persistence join in MongoDB Atlas)

#### Narration:
> *"Notice the real-time feedback streamed via WebSockets. We don't poll the server; the backend pushes stage transitions directly. Behind the scenes:  
> - FFmpeg extracts high-fidelity 16kHz mono audio.  
> - OpenAI Whisper transcribes speech with sub-second word timestamps at 4.18% WER.  
> - LexRank extracts an instant extractive summary in under 1.5s, while our LLM engine structures chapter units.  
> - OpenCV analyzes frame deltas at 1 fps to identify visual slide changes.  
> - And our pipeline automatically synchronizes the media to Google Drive."*

---

### Phase 4: Synchronized Video Intelligence & AI Concept Mind Map (2 Minutes)

#### Action:
1. Open the processed video in **Video Intelligence**.
2. Click on different sentences in the time-aligned transcript: observe video player jumping to the exact millisecond.
3. Click the **Concept Mind Map** tab:
   - Show the dynamic SVG knowledge graph with central topics, modules, and sub-concepts.
   - Click on any conceptual node in the mind map: observe the video seeking instantly to that concept's timestamp!
   - Demonstrate pan, zoom, and SVG export.

#### Narration:
> *"Here in the intelligence workspace, video watching becomes interactive:  
> Clicking any word in the transcript jumps the video immediately.  
> Moreover, our new **Interactive AI Concept Mind Map** translates the lecture into a visual knowledge graph. Students can pan and zoom through key concepts. When they click a node—such as 'Gradient Descent' or 'Attention Mechanism'—the video player instantly jumps to the exact moment that topic was introduced, bridging visual conceptual learning with video playback."*

---

### Phase 5: Educator Studio — 5-Tab Curriculum Authoring (2.5 Minutes)

#### Action:
1. Log in as **Educator** (`educator@clipmind.ai`).
2. Open the video in **Educator Studio**:
   - **Tab 1 (Transcript Editor)**: Edit a segment inline and change a speaker tag (e.g., `Speaker 1` to `Prof. Anderson`). Click Save.
   - **Tab 2 (Curriculum Chapters)**: Add a new custom chapter with start/end time markers.
   - **Tab 3 (Interactive Quiz Builder)**: Add a multiple-choice question, set the correct option, and write an explanation.
   - **Tab 4 (Active Recall Flashcards)**: Add a concept flashcard with front term and back definition.
   - **Tab 5 (Live Student Preview)**: Switch to Student Preview to verify the lesson package from a student's viewpoint.

#### Narration:
> *"The Educator Studio gives instructors total pedagogical control across 5 intuitive tabs:  
> They can correct transcripts, assign speaker tags, structure modular curriculum chapters, author auto-graded quizzes with explanations, build flashcard decks, and preview everything in real time before publishing to students."*

---

### Phase 6: Learner Study Room, Active Recall & Multi-Format Exports (1.5 Minutes)

#### Action:
1. Log in as **Learner** (`learner@clipmind.ai`).
2. Open the **Learner Dashboard**:
   - Take the auto-graded quiz: select answers, click Submit, and view the immediate emerald/rose indicators and explanations.
   - Practice with 3D flip flashcards: click to flip and mark cards as mastered.
3. Open the **Export Studio**:
   - Download the generated study package in PDF and Word (DOCX).
   - Show the publication-grade layout generated by ReportLab and python-docx.

#### Narration:
> *"In the Learner Study Room, students engage in active recall rather than passive watching:  
> They take auto-graded quizzes that provide instant feedback, and flip 3D spaced-repetition flashcards linked to video moments.  
> Finally, our Multi-Format Exporter delivers publication-ready PDF notes, editable Word documents, plain text, and SRT/VTT subtitle caption files for universal accessibility."*

---

### Phase 7: Administrator Hub, Audit Warehouse & Summary (1 Minute)

#### Action:
1. Log in as **Administrator** (`admin@clipmind.ai`).
2. Open the **Admin Dashboard**:
   - Show user governance and role management.
   - Inspect the 50+ event system audit log warehouse.
   - Demonstrate the one-click temporary cache purging button.

#### Narration:
> *"Lastly, our Administrator Hub provides complete governance over users, roles, system health, and an immutable 50+ event audit warehouse.  
> In conclusion, ClipMind AI delivers a complete, enterprise-grade video intelligence platform with zero-loss cloud storage, multimodal AI, interactive concept mind maps, and role-based workspaces. Thank you!"*
