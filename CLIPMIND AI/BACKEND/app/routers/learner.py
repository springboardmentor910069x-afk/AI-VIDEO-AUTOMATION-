import json
import random
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from app.mongodb_models import (
    User, Video, Transcript, Summary, KeyMoment, Quiz,
    FlashcardSet, LearnerProgress, Bookmark, AuditLog
)
from app.schemas import (
    LearnerChatRequest, LearnerChatResponse, LearnerDashboardResponse,
    StudySessionHeartbeatRequest, FlashcardMasteryRequest, QuizSubmissionRequest
)
from app.security import get_current_user_optional
from app.services.llm_service import llm_service

router = APIRouter(prefix="/learner", tags=["Learner"])


@router.get("/dashboard", response_model=LearnerDashboardResponse)
async def get_learner_dashboard_data(
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Aggregate authentic, real-time student learning stats with zero fake numbers."""
    user_id = str(current_user.id) if current_user and getattr(current_user, "id", None) else "demo-user"

    # 1. Fetch user progress documents
    try:
        progress_records = await LearnerProgress.find({"user_id": user_id}).to_list()
    except Exception:
        progress_records = []
    prog_by_video = {p.video_id: p for p in progress_records}

    # 2. Fetch all published/active videos
    try:
        all_videos = await Video.find_all().sort("-created_at").to_list()
    except Exception:
        all_videos = []

    # 3. Compute real study time
    total_study_seconds = sum(int(p.study_time_seconds or 0) for p in progress_records)
    total_study_minutes = round(total_study_seconds / 60)

    now_utc = datetime.now(timezone.utc)
    today_date = now_utc.date()

    # Compute today's study minutes
    today_study_seconds = 0
    for p in progress_records:
        if p.last_studied_at:
            dt = p.last_studied_at if p.last_studied_at.tzinfo else p.last_studied_at.replace(tzinfo=timezone.utc)
            if dt.date() == today_date:
                today_study_seconds += int(p.study_time_seconds or 0)
    today_study_minutes = round(today_study_seconds / 60)

    # 4. Lectures studied count
    lectures_studied = len([
        p for p in progress_records
        if (p.study_time_seconds or 0) > 0 or (p.watch_seconds or 0) > 0 or len(p.flashcards_mastered or []) > 0
    ])

    # 5. Flashcard mastery stats
    mastered_cards = set()
    review_cards = set()
    for p in progress_records:
        for cid in (p.flashcards_mastered or []):
            mastered_cards.add(f"{p.video_id}:{cid}")
        for cid in (p.flashcards_review or []):
            review_cards.add(f"{p.video_id}:{cid}")

    flashcards_mastered_cnt = len(mastered_cards)
    flashcards_total_cnt = len(mastered_cards.union(review_cards))
    flashcard_mastery_pct = round((flashcards_mastered_cnt / max(1, flashcards_total_cnt)) * 100) if flashcards_total_cnt > 0 else 0

    # 6. Quiz stats
    quizzes_taken = 0
    quiz_score_sum = 0
    quiz_total_sum = 0
    for p in progress_records:
        for att in (p.quiz_attempts or []):
            quizzes_taken += 1
            quiz_score_sum += int(att.get("score", 0) or 0)
            quiz_total_sum += max(1, int(att.get("total", 0) or 1))

    quiz_accuracy_pct = round((quiz_score_sum / max(1, quiz_total_sum)) * 100) if quizzes_taken > 0 else 0

    # 7. Real activity streak calculation (days with activity)
    activity_dates = set()
    for p in progress_records:
        if p.last_studied_at:
            dt = p.last_studied_at if p.last_studied_at.tzinfo else p.last_studied_at.replace(tzinfo=timezone.utc)
            activity_dates.add(dt.date())
    
    # Also check user bookmarks
    try:
        user_bookmarks = await Bookmark.find({"user_id": user_id}).sort("-created_at").to_list()
    except Exception:
        user_bookmarks = []
    for b in user_bookmarks:
        if b.created_at:
            dt = b.created_at if b.created_at.tzinfo else b.created_at.replace(tzinfo=timezone.utc)
            activity_dates.add(dt.date())

    # Count consecutive days streak backward from today
    streak = 0
    check_day = today_date
    while check_day in activity_dates:
        streak += 1
        check_day -= timedelta(days=1)

    # 8. Format recent lectures with student's real progress
    recent_lectures = []
    for v in all_videos:
        dur = int(getattr(v, "duration_sec", 0) or 0)
        p = prog_by_video.get(str(v.id))
        watch_sec = int(p.watch_seconds or 0) if p else 0
        pct = min(100, round((watch_sec / max(1, dur)) * 100)) if dur > 0 else 0
        thumb = v.thumbnail_url or getattr(v, "thumbnail_path", "")

        recent_lectures.append({
            "id": str(v.id),
            "title": v.title or "Untitled Lecture",
            "category": v.category or "Academic",
            "duration_sec": dur,
            "watch_seconds": watch_sec,
            "progress_pct": pct,
            "completed": (pct >= 90) or (p.completed if p else False),
            "thumbnail_url": thumb,
            "last_studied": p.last_studied_at.isoformat() if (p and p.last_studied_at) else None,
            "cards_mastered": len(p.flashcards_mastered or []) if p else 0,
            "quiz_attempts_count": len(p.quiz_attempts or []) if p else 0
        })

    # 9. Format recent study notes
    recent_notes = []
    for b in user_bookmarks[:6]:
        recent_notes.append({
            "id": str(b.id),
            "video_id": b.video_id,
            "video_title": b.video_title or "Lecture",
            "timestamp_str": b.timestamp_str or "00:00",
            "timestamp_sec": b.timestamp_sec or 0,
            "label": b.label or "Study Note",
            "note": b.note or "",
            "created_at": b.created_at.isoformat() if b.created_at else None
        })

    # 10. Dynamic Milestones & Badges
    milestones = [
        {
            "id": "first_lecture",
            "title": "Learning Journey Begins",
            "desc": "Studied your first video lecture",
            "icon": "🚀",
            "unlocked": lectures_studied >= 1,
            "progress": min(1, lectures_studied),
            "target": 1
        },
        {
            "id": "streak_3",
            "title": "Consistent Scholar",
            "desc": "Maintained a 3-day active study streak",
            "icon": "🔥",
            "unlocked": streak >= 3,
            "progress": min(3, streak),
            "target": 3
        },
        {
            "id": "flashcard_master",
            "title": "Memory Architect",
            "desc": "Mastered 5 or more key concept flashcards",
            "icon": "🃏",
            "unlocked": flashcards_mastered_cnt >= 5,
            "progress": min(5, flashcards_mastered_cnt),
            "target": 5
        },
        {
            "id": "quiz_ace",
            "title": "Quiz Master",
            "desc": "Achieved 80%+ accuracy across completed quizzes",
            "icon": "🎯",
            "unlocked": quizzes_taken >= 1 and quiz_accuracy_pct >= 80,
            "progress": quiz_accuracy_pct,
            "target": 80
        },
        {
            "id": "deep_diver",
            "title": "Deep Diver",
            "desc": "Completed 30+ minutes of total study time",
            "icon": "⏱️",
            "unlocked": total_study_minutes >= 30,
            "progress": min(30, total_study_minutes),
            "target": 30
        }
    ]

    return LearnerDashboardResponse(
        total_study_minutes=total_study_minutes,
        lectures_studied=lectures_studied,
        total_lectures=len(all_videos),
        flashcards_mastered=flashcards_mastered_cnt,
        flashcards_total=flashcards_total_cnt,
        flashcard_mastery_pct=flashcard_mastery_pct,
        quizzes_taken=quizzes_taken,
        quiz_accuracy_pct=quiz_accuracy_pct,
        streak_days=streak,
        today_study_minutes=today_study_minutes,
        recent_lectures=recent_lectures,
        recent_notes=recent_notes,
        milestones=milestones
    )


@router.post("/study-session")
async def record_study_session_heartbeat(
    req: StudySessionHeartbeatRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Log real seconds of active student learning for a video."""
    user_id = str(current_user.id) if current_user and getattr(current_user, "id", None) else "demo-user"

    progress = await LearnerProgress.find_one(
        LearnerProgress.user_id == user_id,
        LearnerProgress.video_id == req.video_id
    )

    now = datetime.now(timezone.utc)
    if not progress:
        progress = LearnerProgress(
            user_id=user_id,
            video_id=req.video_id,
            watch_seconds=req.current_position_sec or 0,
            study_time_seconds=max(0, req.seconds),
            last_studied_at=now,
            created_at=now,
            updated_at=now
        )
        await progress.insert()
    else:
        progress.study_time_seconds = (progress.study_time_seconds or 0) + max(0, req.seconds)
        if req.current_position_sec and req.current_position_sec > (progress.watch_seconds or 0):
            progress.watch_seconds = req.current_position_sec
        progress.last_studied_at = now
        progress.updated_at = now
        await progress.save()

    return {
        "success": True,
        "video_id": req.video_id,
        "total_study_seconds": progress.study_time_seconds,
        "watch_seconds": progress.watch_seconds
    }


@router.post("/flashcard-mastery")
async def record_flashcard_mastery(
    req: FlashcardMasteryRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Save persistent flashcard mastery ('know' or 'review') for student."""
    user_id = str(current_user.id) if current_user and getattr(current_user, "id", None) else "demo-user"

    progress = await LearnerProgress.find_one(
        LearnerProgress.user_id == user_id,
        LearnerProgress.video_id == req.video_id
    )

    now = datetime.now(timezone.utc)
    if not progress:
        progress = LearnerProgress(
            user_id=user_id,
            video_id=req.video_id,
            last_studied_at=now,
            created_at=now,
            updated_at=now
        )
        await progress.insert()

    mastered = list(progress.flashcards_mastered or [])
    review = list(progress.flashcards_review or [])

    if req.status == "know":
        if req.card_id not in mastered:
            mastered.append(req.card_id)
        if req.card_id in review:
            review.remove(req.card_id)
    elif req.status == "review":
        if req.card_id not in review:
            review.append(req.card_id)
        if req.card_id in mastered:
            mastered.remove(req.card_id)

    progress.flashcards_mastered = mastered
    progress.flashcards_review = review
    progress.last_studied_at = now
    progress.updated_at = now
    await progress.save()

    return {
        "success": True,
        "card_id": req.card_id,
        "status": req.status,
        "mastered_count": len(mastered),
        "review_count": len(review)
    }


@router.post("/quiz-submit")
async def submit_quiz_result(
    req: QuizSubmissionRequest,
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Store authentic quiz completion attempt and calculate score."""
    user_id = str(current_user.id) if current_user and getattr(current_user, "id", None) else "demo-user"

    progress = await LearnerProgress.find_one(
        LearnerProgress.user_id == user_id,
        LearnerProgress.video_id == req.video_id
    )

    now = datetime.now(timezone.utc)
    if not progress:
        progress = LearnerProgress(
            user_id=user_id,
            video_id=req.video_id,
            last_studied_at=now,
            created_at=now,
            updated_at=now
        )
        await progress.insert()

    pct = round((req.score / max(1, req.total)) * 100)
    attempt = {
        "score": req.score,
        "total": req.total,
        "percentage": pct,
        "submitted_at": now.isoformat()
    }

    attempts = list(progress.quiz_attempts or [])
    attempts.append(attempt)
    progress.quiz_attempts = attempts
    progress.last_studied_at = now
    progress.updated_at = now
    await progress.save()

    # Log audit entry
    try:
        log = AuditLog(
            user_id=user_id,
            user_email=current_user.email if current_user else "learner@clipmind.ai",
            action="QUIZ_SUBMIT",
            resource="Video",
            resource_id=req.video_id,
            details=f"Scored {req.score}/{req.total} ({pct}%)"
        )
        await log.insert()
    except Exception:
        pass

    return {
        "success": True,
        "score": req.score,
        "total": req.total,
        "percentage": pct,
        "passed": pct >= 60
    }


@router.post("/chat", response_model=LearnerChatResponse)
async def learner_ai_chat(
    req: LearnerChatRequest,
    current_user: User = Depends(get_current_user_optional)
):
    video = await Video.get(req.video_id)
    transcript = await Transcript.find_one(Transcript.video_id == req.video_id)
    summary = await Summary.find_one(Summary.video_id == req.video_id)
    key_moments = await KeyMoment.find(KeyMoment.video_id == req.video_id).to_list()
    
    v_title = video.title if video else "Video Lecture"
    v_domain = getattr(video, "domain", "General Knowledge") if video else "General"
    v_category = getattr(video, "category", "Education") if video else "Education"
    v_duration = getattr(video, "duration_sec", 0) if video else 0

    context_snippets = []
    matched_timestamp = "00:00"
    matched_seconds = 0

    # Build summary context
    if summary:
        if summary.tldr:
            context_snippets.append(f"EXECUTIVE SUMMARY (TL;DR): {summary.tldr}")
        if summary.key_takeaways:
            context_snippets.append("KEY TAKEAWAYS:\n" + "\n".join(f"- {t}" for t in summary.key_takeaways))

    # Build key moments context
    if key_moments:
        km_lines = []
        for km in key_moments[:6]:
            ts = getattr(km, "timestamp_str", getattr(km, "timestamp", "00:00"))
            title = getattr(km, "title", "Key Moment")
            desc = getattr(km, "description", "")
            km_lines.append(f"[{ts}] {title}: {desc}")
        context_snippets.append("KEY TIMESTAMPS & MOMENTS:\n" + "\n".join(km_lines))

    # Build transcript context and match closest segment to user question
    if transcript and transcript.segments:
        q_words = [w.lower() for w in req.question.split() if len(w) > 3]
        best_score = 0
        transcript_lines = []
        for seg in transcript.segments:
            s_text = seg.get("text", "")
            ts = seg.get("timestamp", "00:00")
            transcript_lines.append(f"[{ts}] {s_text}")
            
            score = sum(1 for w in q_words if w in s_text.lower())
            if score > best_score:
                best_score = score
                matched_timestamp = ts
                matched_seconds = int(seg.get("start", 0))

        context_snippets.append("TRANSCRIPT SAMPLES:\n" + "\n".join(transcript_lines[:40]))

    full_context = "\n\n".join(context_snippets)

    system_prompt = (
        f"You are ClipMind AI — a real-time, expert video intelligence and study tutor for '{v_title}'.\n"
        f"Domain: {v_domain} | Category: {v_category} | Duration: {v_duration}s\n\n"
        "Your role is to provide deep, accurate, real-time answers based on the real spoken content, summary, and key moments from this video.\n"
        "Guidelines:\n"
        "1. Give thorough, clear, and structured answers (use bullet points or numbered steps where appropriate).\n"
        "2. Directly cite timestamps from the video (e.g. '[01:45]') so the user knows where topics are discussed.\n"
        "3. If asked for a summary, explanation, key concepts, or quiz questions, generate them dynamically from the provided transcript and notes.\n"
        "4. Never provide generic or placeholder text; ground everything in the actual video material."
    )
    user_prompt = f"Video Intelligence Context for '{v_title}':\n{full_context[:3500]}\n\nStudent / User Question: {req.question}"
    
    ai_answer = llm_service.generate_chat_response(system_prompt, user_prompt)
    if not ai_answer:
        if summary and summary.tldr:
            ai_answer = f"According to the video analysis for '{v_title}':\n\n{summary.tldr}\n\nKey Takeaways:\n" + "\n".join(f"• {t}" for t in (summary.key_takeaways or [])[:3])
        elif full_context:
            ai_answer = f"In '{v_title}' (at ~{matched_timestamp}), the following discussion is highlighted:\n\n{full_context[:300]}...\n\nRefer to timestamp {matched_timestamp} in the video player."
        else:
            ai_answer = f"Regarding your question on '{req.question}': Video '{v_title}' is ready in ClipMind AI. You can review its live transcript and timeline moments directly in the player."

    return LearnerChatResponse(
        answer=ai_answer,
        relevant_timestamp=matched_timestamp,
        relevant_seconds=matched_seconds,
        context_snippet=full_context[:160] or f"Context for {v_title}"
    )


@router.get("/flashcards/{video_id}")
async def get_learner_flashcards(video_id: str, current_user: User = Depends(get_current_user_optional)):
    user_id = str(current_user.id) if current_user and getattr(current_user, "id", None) else "demo-user"
    progress = await LearnerProgress.find_one(
        LearnerProgress.user_id == user_id,
        LearnerProgress.video_id == video_id
    )
    mastered_ids = set(progress.flashcards_mastered or []) if progress else set()
    review_ids = set(progress.flashcards_review or []) if progress else set()

    # 1. Check if educator-published custom flashcards exist in MongoDB
    saved_cards = await FlashcardSet.find_one({"video_id": video_id})
    if saved_cards and saved_cards.flashcards:
        cards = []
        for f in saved_cards.flashcards:
            cid = f.get("id")
            score = "know" if cid in mastered_ids else "review" if cid in review_ids else None
            cards.append({**f, "score": score})
        return {
            "video_id": video_id,
            "video_title": saved_cards.title or "Lecture Flashcards",
            "flashcards": cards
        }

    try:
        video = await Video.get(video_id)
    except Exception:
        video = None
    
    v_title = video.title if video and getattr(video, "title", None) else "Video Lecture"
    
    transcript = None
    try:
        transcript = await Transcript.find_one(Transcript.video_id == video_id)
    except Exception:
        pass
    
    segments = transcript.segments if (transcript and transcript.segments) else []

    flashcards = []
    if segments:
        for idx, seg in enumerate(segments[:12]):
            txt = seg.get("text", "").strip()
            ts = seg.get("timestamp", f"00:{idx*15:02d}")
            words = [w.strip(".,!?:;\"'()") for w in txt.split() if len(w) > 4 and w.lower() not in {"this", "that", "with", "from", "have", "were", "where", "about", "there", "their"}]
            topic = words[0].capitalize() if words else f"Key Topic {idx+1}"
            cid = f"fc-{idx+1}"
            score = "know" if cid in mastered_ids else "review" if cid in review_ids else None
            
            flashcards.append({
                "id": cid,
                "front": f"What is discussed regarding '{topic}' at [{ts}] in '{v_title}'?",
                "back": txt,
                "timestamp": ts,
                "flipped": False,
                "score": score
            })
    else:
        summary = await Summary.find_one(Summary.video_id == video_id)
        items = (summary.key_takeaways if (summary and summary.key_takeaways) else []) or [
            "Video lecture overview and key learning objectives.",
            "Methodology and system architecture principles.",
            "Summary analysis and practical implementation takeaways."
        ]
        for idx, itm in enumerate(items[:8]):
            cid = f"fc-{idx+1}"
            score = "know" if cid in mastered_ids else "review" if cid in review_ids else None
            flashcards.append({
                "id": cid,
                "front": f"Core Concept {idx+1}: {itm.split('.')[0] if '.' in itm else itm[:45]}...",
                "back": itm,
                "timestamp": f"0{idx}:00",
                "flipped": False,
                "score": score
            })

    return {"video_id": video_id, "video_title": v_title, "flashcards": flashcards}


@router.get("/quizzes/{video_id}")
async def get_learner_quizzes(video_id: str, current_user: User = Depends(get_current_user_optional)):
    video = None
    try:
        video = await Video.get(video_id)
    except Exception:
        pass
    if not video:
        try:
            video = await Video.find_one({"_id": video_id})
        except Exception:
            pass
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    v_title = video.title

    # 1. First check if educator published custom quiz
    saved_quiz = await Quiz.find_one({"video_id": video_id})
    if saved_quiz and saved_quiz.questions:
        return {"video_id": video_id, "video_title": v_title, "questions": saved_quiz.questions}

    transcript = await Transcript.find_one(Transcript.video_id == video_id)
    segments = transcript.segments if (transcript and transcript.segments) else []

    questions = []
    if segments and len(segments) >= 2:
        distractor_pool = [
            "Baseline data collection without automated AI transcription.",
            "Manual video frame indexing with linear playback.",
            "Asynchronous event queue scheduling across external gateways.",
            "Unsupervised clustering evaluation on audio spectrum bands.",
            "Traditional manual summary transcription methods."
        ]
        
        for idx, seg in enumerate(segments[:6]):
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
                "id": f"q-{idx+1}",
                "question": f"According to the lecture segment at timestamp [{ts}], what is explained?",
                "options": options,
                "correct": correct_idx,
                "explanation": f"Refer to timestamp {ts} in '{v_title}': \"{correct_txt[:140]}...\""
            })

    if not questions:
        summary = await Summary.find_one(Summary.video_id == video_id)
        takeaways = summary.key_takeaways if (summary and summary.key_takeaways) else []
        items_to_quiz = takeaways[:4] or [
            f"Core conceptual foundations presented in '{v_title}'.",
            f"Key methodologies and implementation techniques in '{v_title}'.",
            f"Evaluation metrics and real-world application workflows in '{v_title}'."
        ]
        
        for idx, item in enumerate(items_to_quiz):
            correct_ans = item.strip()
            distractors = [
                f"Alternative obsolete theory superseded by '{v_title}'.",
                "Unrelated manual data aggregation without AI optimization.",
                "Deprecated legacy approach not recommended for modern systems."
            ]
            options = [correct_ans] + distractors
            random.shuffle(options)
            correct_idx = options.index(correct_ans)
            questions.append({
                "id": f"q-{idx+1}",
                "question": f"Question {idx+1}: Which of the following is an essential takeaway from '{v_title}'?",
                "options": options,
                "correct": correct_idx,
                "explanation": f"Concept from '{v_title}': \"{correct_ans}\""
            })

    return {"video_id": video_id, "video_title": v_title, "questions": questions}
