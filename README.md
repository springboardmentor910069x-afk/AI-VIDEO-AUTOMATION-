# 🎬 ClipMind AI

ClipMind AI is an AI-powered video analysis application that allows users to upload videos and automatically generate transcripts, summaries, keywords, and timestamps.

---

## 🚀 Features

- 👤 User Registration & Login
- 🎥 Video Upload
- 📝 AI-powered Video Transcription (OpenAI Whisper)
- 📄 Automatic Text Summarization
- 🏷 Keyword Extraction
- ⏱ Timestamp Generation
- 💻 Modern React Dashboard
- 🔐 Secure Authentication using JWT

---

## 🛠 Tech Stack

### Frontend
- React.js
- Axios
- CSS

### Backend
- FastAPI
- Python
- SQLAlchemy
- JWT Authentication

### AI Models
- OpenAI Whisper (Speech-to-Text)
- Hugging Face Transformers (Summarization)

### Database
- SQLite

---

## 📂 Project Structure

```
ClipMind-AI/
│
├── backend/
│   ├── app/
│   │   ├── services/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routes/
│   │   └── main.py
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│
└── README.md
```

---

## ⚙ Installation

### Clone Repository

```bash
git clone https://github.com/Pravs12/ClipMind-AI.git
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## 📸 Workflow

1. Register/Login
2. Upload a Video
3. Generate Transcript
4. Generate Summary
5. Extract Keywords
6. View Timestamps

---

## 📷 Sample Output

- Transcript
- AI Summary
- Keywords
- Timestamps

---

## 🎯 Milestone 1 Completed

✅ User Authentication

✅ Video Upload

✅ Speech-to-Text using Whisper

✅ AI Summary

✅ Keyword Extraction

✅ Timestamp Generation

✅ Dashboard UI

---

## 🔮 Future Enhancements

- 🎥 Embedded Video Player
- ⏩ Clickable Timestamps
- 📥 Download Transcript as PDF/TXT
- 📄 Download Summary
- 🌐 Cloud Deployment
- 🔍 Search Inside Transcript

---

## 👩‍💻 Author

**Pravallika M**

GitHub: https://github.com/Pravs12

---

## 📜 License

This project is developed for learning and educational purposes.
