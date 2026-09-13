from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import random
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.mongodb_models import Video, Transcript, Summary, Quiz, FlashcardSet, User
from app.schemas import VideoResponse, EducatorTranscriptUpdate, Segment
from app.security import require_roles

router = APIRouter(prefix="/educator", tags=["Educator Operations"])


class ChapterUpdateItem(BaseModel):
    id: Optional[str] = None
    title: str
    timeRange: Optional[str] = "00:00 - 00:00"
    summary: Optional[str] = ""
    bulletPoints: Optional[List[str]] = Field(default_factory=list)


class EducatorChaptersUpdate(BaseModel):
    sections: List[ChapterUpdateItem]


class QuizQuestionItem(BaseModel):
    id: Optional[str] = None
    question: str
    options: List[str]
    correct: int
    explanation: Optional[str] = ""


class EducatorQuizSaveRequest(BaseModel):
    title: Optional[str] = "Lecture Quiz"
    questions: List[QuizQuestionItem]


class FlashcardItem(BaseModel):
    id: Optional[str] = None
    front: str
    back: str
    timestamp: Optional[str] = "00:00"


class EducatorFlashcardsSaveRequest(BaseModel):
    title: Optional[str] = "Lecture Flashcards"
    flashcards: List[FlashcardItem]


@router.get("/lectures", response_model=List[VideoResponse])
async def list_educator_lectures(
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    try:
        videos = await Video.find_all().sort("-created_at").to_list()
    except Exception:
        videos = []

    res = []
    for v in videos:
        res.append(VideoResponse(
            id=str(v.id),
            user_id=str(v.user_id) if getattr(v, 'user_id', None) else "demo-user",
            title=v.title,
            filename=v.filename or "",
            thumbnail_url=v.thumbnail_url,
            duration_sec=v.duration_sec,
            status=v.status,
            created_at=v.created_at,
            category=v.category or "Academic",
            views_count=v.views_count or 0
        ))
    return res


@router.put("/lectures/{video_id}/transcript")
async def update_educator_transcript(
    video_id: str,
    update_data: EducatorTranscriptUpdate,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    transcript = await Transcript.find_one({"video_id": video_id})
    if not transcript:
        transcript = Transcript(
            video_id=video_id,
            language="en",
            segments=[s.dict() for s in update_data.segments],
            word_count=sum(len(s.text.split()) for s in update_data.segments)
        )
        await transcript.insert()
    else:
        transcript.segments = [s.dict() for s in update_data.segments]
        transcript.word_count = sum(len(s.text.split()) for s in update_data.segments)
        transcript.updated_at = datetime.now(timezone.utc)
        await transcript.save()

    return {"success": True, "message": "Transcript updated successfully", "segments_count": len(transcript.segments)}


@router.put("/lectures/{video_id}/chapters")
async def update_educator_chapters(
    video_id: str,
    update_data: EducatorChaptersUpdate,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    summary = await Summary.find_one({"video_id": video_id})
    processed_sections = []
    for idx, sec in enumerate(update_data.sections):
        sec_dict = sec.dict()
        if not sec_dict.get("id"):
            sec_dict["id"] = f"sec-{idx+1}"
        processed_sections.append(sec_dict)

    if not summary:
        summary = Summary(
            video_id=video_id,
            tldr="Summary customized by course educator.",
            sections=processed_sections
        )
        await summary.insert()
    else:
        summary.sections = processed_sections
        summary.updated_at = datetime.now(timezone.utc)
        await summary.save()

    return {"success": True, "message": "Chapters updated and persisted successfully", "chapters_count": len(summary.sections)}


@router.get("/quizzes/{video_id}")
@router.get("/lectures/{video_id}/quizzes")
async def get_educator_quizzes(
    video_id: str,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    # Check if a custom saved quiz exists first
    saved_quiz = await Quiz.find_one({"video_id": video_id})
    if saved_quiz and saved_quiz.questions:
        return {
            "video_id": video_id,
            "title": saved_quiz.title or "Lecture Quiz",
            "questions": saved_quiz.questions
        }

    video = await Video.get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    transcript = await Transcript.find_one({"video_id": video_id})
    v_title = video.title
    segments = transcript.segments if (transcript and transcript.segments) else []

    distractor_pool = [
        "Recursive tree parsing with memoized backoff.",
        "Asynchronous event queue scheduling across external gateways.",
        "Unsupervised clustering evaluation on audio spectrum bands.",
        "Traditional manual summary transcription methods."
    ]

    questions = []
    if segments:
        for idx, seg in enumerate(segments[:8]):
            correct_txt = seg.get("text", "").strip()
            ts = seg.get("timestamp", f"00:{idx*20:02d}")

            other_segs = [s.get("text", "").strip() for j, s in enumerate(segments) if j != idx and len(s.get("text", "").strip()) > 15]
            if len(other_segs) >= 3:
                distractors = random.sample(other_segs, 3)
            else:
                distractors = random.sample(distractor_pool, 3)

            options = [correct_txt[:100] + ("..." if len(correct_txt) > 100 else "")]
            for d in distractors:
                options.append(d[:100] + ("..." if len(d) > 100 else ""))

            correct_answer = options[0]
            random.shuffle(options)
            correct_idx = options.index(correct_answer)

            questions.append({
                "id": f"eq-{idx+1}",
                "question": f"According to the lecture segment at timestamp [{ts}], what is explained?",
                "options": options,
                "correct": correct_idx,
                "explanation": f"Refer to speech segment at timestamp {ts} in '{v_title}'."
            })

    return {"video_id": video_id, "video_title": v_title, "questions": questions}


@router.post("/lectures/{video_id}/quizzes")
async def save_educator_quizzes(
    video_id: str,
    req: EducatorQuizSaveRequest,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    quiz = await Quiz.find_one({"video_id": video_id})
    formatted_questions = [q.dict() for q in req.questions]
    for idx, q in enumerate(formatted_questions):
        if not q.get("id"):
            q["id"] = f"q-{idx+1}"

    if not quiz:
        quiz = Quiz(
            video_id=video_id,
            title=req.title or "Lecture Quiz",
            questions=formatted_questions,
            created_by=str(current_user.id)
        )
        await quiz.insert()
    else:
        quiz.title = req.title or quiz.title
        quiz.questions = formatted_questions
        quiz.updated_at = datetime.now(timezone.utc)
        await quiz.save()

    return {"success": True, "message": "Quiz saved and published to students", "questions_count": len(quiz.questions)}


@router.get("/lectures/{video_id}/flashcards")
async def get_educator_flashcards(
    video_id: str,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    saved_cards = await FlashcardSet.find_one({"video_id": video_id})
    if saved_cards and saved_cards.flashcards:
        return {
            "video_id": video_id,
            "title": saved_cards.title or "Lecture Flashcards",
            "flashcards": saved_cards.flashcards
        }

    # Fallback from transcript
    transcript = await Transcript.find_one({"video_id": video_id})
    segments = transcript.segments if (transcript and transcript.segments) else []
    cards = []
    if segments:
        for idx, seg in enumerate(segments[:10]):
            txt = seg.get("text", "").strip()
            ts = seg.get("timestamp", f"00:{idx*15:02d}")
            cards.append({
                "id": f"fc-{idx+1}",
                "front": f"Key Topic [{ts}]: What is discussed in this segment?",
                "back": txt,
                "timestamp": ts
            })

    return {"video_id": video_id, "flashcards": cards}


@router.post("/lectures/{video_id}/flashcards")
async def save_educator_flashcards(
    video_id: str,
    req: EducatorFlashcardsSaveRequest,
    current_user: User = Depends(require_roles(["Educator", "Admin"]))
):
    fc_set = await FlashcardSet.find_one({"video_id": video_id})
    formatted_cards = [f.dict() for f in req.flashcards]
    for idx, c in enumerate(formatted_cards):
        if not c.get("id"):
            c["id"] = f"fc-{idx+1}"

    if not fc_set:
        fc_set = FlashcardSet(
            video_id=video_id,
            title=req.title or "Lecture Flashcards",
            flashcards=formatted_cards,
            created_by=str(current_user.id)
        )
        await fc_set.insert()
    else:
        fc_set.title = req.title or fc_set.title
        fc_set.flashcards = formatted_cards
        fc_set.updated_at = datetime.now(timezone.utc)
        await fc_set.save()

    return {"success": True, "message": "Flashcards saved and published to students", "flashcards_count": len(fc_set.flashcards)}
