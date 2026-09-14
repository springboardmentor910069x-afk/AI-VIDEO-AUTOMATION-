# ClipMind AI — Live Project Demonstration Script
## Step-by-Step Live Walkthrough & Narration Guide

**Project Title**: ClipMind AI: Video Summarization & Key Moments Detection Platform  
**Demonstrator**: Adabala Venkata Thrinadh (B.Tech CSE, GMRIT)  
**Target Duration**: 8 to 12 Minutes  
**Demonstration Scope**: Setup, Ingestion, Real-Time Processing, 4 Role Workspaces, 5-Tab Educator Studio, Learner Room, and Exports  

---

### Phase 1: Environment Startup & Initialization (1 Minute)

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
> As the application loads, you can observe our clean, modern interface featuring smooth glassmorphic aesthetics and full support for both light and dark modes."*

---

### Phase 2: Authentication & Role Personas (1.5 Minutes)

#### Action:
1. Click the **Login** button on the navigation bar.
2. Show the role switcher dropdown or seed account credentials:
   - Creator: `creator@clipmind.ai` / `Creator@123`
   - Learner: `learner@clipmind.ai` / `Learner@123`
   - Educator: `educator@clipmind.ai` / `Educator@123`
   - Admin: `admin@clipmind.ai` / `Admin@123`
3. Log in as **Content Creator**.

#### Narration:
> *"ClipMind AI enforces Role-Based Access Control using stateless JSON Web Tokens (JWT) signed with HMAC-SHA256. Passwords are encrypted with Bcrypt.  
> Here, users can authenticate as a Content Creator, Learner, Educator, or Administrator. Each role unlocks specialized permissions and route guards. Let us first log in as a **Content Creator**."*

---

### Phase 3: Video Ingestion & Real-Time Processing Pipeline (2.5 Minutes)

#### Action:
1. Navigate to the **Upload** page.
2. Demonstrate drag-and-drop file upload (`.mp4`, `.mov`, `.mkv`) or paste a sample educational YouTube link.
3. Click **Process Video**.
4. Observe the live animated progress bar driven by WebSockets:
   - 20% `audio_extracted`
   - 50% `transcribing`
   - 75% `summarizing`
   - 90% `extracting_moments`
   - 100% `completed`

#### Narration:
> *"Now we will ingest a video. ClipMind AI supports chunked multipart uploads for large local files as well as remote stream extraction via yt-dlp.  
> Notice that as soon as I submit the video, the backend responds asynchronously with HTTP 202 Accepted. The browser immediately establishes a persistent WebSocket connection to `/ws/videos/{video_id}`.  
> Watch the live progress bar:  
> - First, FFmpeg extracts the audio track and normalizes it to 16kHz mono WAV.  
> - Next, OpenAI Whisper converts the speech into word-level timestamps.  
> - Then, our dual-tier NLP summarizer computes an instant LexRank TL;DR and queries our LLM engine for structured chapters.  
> - Simultaneously, OpenCV samples the video at 1 frame per second to detect slide transitions and generate WebP thumbnails.  
> - Finally, upon receiving the 100% completion event, the UI transitions to the video intelligence dashboard without requiring any manual page refresh."*

---

### Phase 4: Video Intelligence Center & Synchronized Playback (2 Minutes)

#### Action:
1. Open the processed video in the **Video Intelligence Center**.
2. Show the **AI Summary Tab**: review the 2-sentence executive TL;DR, bulleted key takeaways, and detailed chapters.
3. Switch to the **Transcript Tab**:
   - Play the video: observe sentences auto-highlighting in sync with playback.
   - Type a keyword (e.g., 'machine learning' or 'gradient') into the transcript search bar.
   - Click a search result: notice the HTML5 video player jumps instantly to that exact second.
4. Switch to the **Key Moments Tab**:
   - Show the detected slide transition thumbnails and timestamp badges.
   - Click a keyframe: verify playback jumps immediately.

#### Narration:
> *"Here is our core Video Intelligence Center:  
> On the Summary tab, users can read an executive TL;DR in under 15 seconds, followed by structured curriculum chapters.  
> On the Transcript tab, spoken dialogue is aligned with the video timeline. As the instructor speaks, the current sentence highlights automatically. If I type a technical term into the search bar, the transcript filters in real time. Clicking any word or sentence jumps the video player directly to that moment, eliminating manual scrubbing.  
> On the Key Moments tab, OpenCV has detected slide transitions, generating visual thumbnails so users can navigate by presentation slides."*

---

### Phase 5: Educator Studio — 5-Tab Authoring Suite (2.5 Minutes)

#### Action:
1. Switch to the **Educator** account.
2. Open the **Educator Studio** (`EducatorEditor.tsx`).
3. Walk through all 5 tabs:
   - **Tab 1 (Transcript Editor)**: Edit a typo in a sentence, change a speaker tag from 'Speaker 1' to 'Professor'.
   - **Tab 2 (Chapters & Topics)**: Add a new custom chapter heading with start/end time boundaries.
   - **Tab 3 (Quiz Builder)**: Add a multiple-choice question: enter question text, 4 options, select the correct answer, and enter an educational explanation. Click **Save Quiz**.
   - **Tab 4 (Flashcard Builder)**: Add a front/back active recall term linked to a timestamp. Click **Save Cards**.
   - **Tab 5 (Student Preview)**: Switch to student preview to verify that all edits, chapters, quizzes, and cards appear cleanly.

#### Narration:
> *"Now let us switch to the **Educator** persona. Teachers often avoid automated tools because AI can occasionally misspell technical jargon or mislabel topics.  
> In our 5-Tab Educator Studio, teachers have full editorial authority:  
> - In Tab 1, educators can edit transcript text and perform speaker diarization.  
> - In Tab 2, they can define custom lesson modules and timestamps.  
> - In Tab 3, teachers can author custom multiple-choice quizzes with explanations.  
> - In Tab 4, they can build active recall flashcard decks.  
> - In Tab 5, the WYSIWYG Student Preview lets teachers test the complete student experience before publishing.  
> All updates persist directly into MongoDB Atlas via dedicated REST endpoints."*

---

### Phase 6: Learner Study Room & Active Recall Practice (1.5 Minutes)

#### Action:
1. Switch to the **Learner** persona.
2. Open the **Learner Study Room**.
3. Launch the **Interactive Quiz**:
   - Answer a question correctly: observe instant green confirmation and educational explanation reveal.
   - Answer a question incorrectly: observe red alert and explanation.
4. Launch the **3D Flashcards**:
   - Click a flashcard: observe the smooth 3D flip animation revealing the back definition.
   - Navigate through cards using the 'Next' button.

#### Narration:
> *"Now we view the platform from the **Learner's** perspective.  
> Passive video watching leads to quick memory decay. In the Learner Study Room, students engage in active recall.  
> When a learner attempts a quiz, the system auto-grades their submission and instantly explains why the answer is correct.  
> With our 3D interactive flashcards, students can self-test key definitions with smooth flip animations. If an educator hasn't created custom materials, our backend dynamically generates study items from the transcript on the fly."*

---

### Phase 7: Document Export Studio & Admin Governance (1 Minute)

#### Action:
1. Click **Export** on the video page.
2. Download a sample **PDF** and **Word (DOCX)** document.
3. Open the downloaded PDF to show formatted title blocks, summaries, key moments tables, and transcripts.
4. Log in as **Administrator**:
   - Show the **Admin Dashboard** (`/admin`).
   - View registered users and role assignment toggles.
   - Inspect the **Audit Warehouse** showing 50+ recorded system events.
   - Demonstrate one-click temporary cache purging.

#### Narration:
> *"Finally, ClipMind AI allows users to export study materials for offline review in five formats: PDF, DOCX, TXT, SRT, and VTT. As you can see in this generated PDF, the document is formatted with styled title blocks, chapter outlines, key moments, and time-coded transcripts.  
> On the Administrative Dashboard, system health is monitored, user roles can be governed, 50+ event audit logs are recorded, and temporary disk caches can be cleared with one click.  
> Furthermore, deleting a video triggers a zero-orphan cascading deletion across disk files and six MongoDB collections."*

---

### Phase 8: Conclusion & Q&A
#### Narration:
> *"In summary, ClipMind AI provides a complete, production-ready solution that combines automated speech recognition, dual-tier summarization, computer vision slide detection, and role-based learning workspaces into an intuitive, responsive web application.  
> This concludes our live demonstration. Thank you, and I welcome any questions."*
