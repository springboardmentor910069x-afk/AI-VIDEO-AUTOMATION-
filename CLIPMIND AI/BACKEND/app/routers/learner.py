import json
import random
from fastapi import APIRouter, Depends, HTTPException
from app.mongodb_models import User, Video, Transcript, Summary, KeyMoment, Quiz, FlashcardSet
from app.schemas import LearnerChatRequest, LearnerChatResponse
from app.security import get_current_user_optional
from app.services.llm_service import llm_service

router = APIRouter(prefix="/learner", tags=["Learner"])

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
    # 1. Check if educator-published custom flashcards exist in MongoDB
    saved_cards = await FlashcardSet.find_one({"video_id": video_id})
    if saved_cards and saved_cards.flashcards:
        return {
            "video_id": video_id,
            "video_title": saved_cards.title or "Lecture Flashcards",
            "flashcards": saved_cards.flashcards
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
            
            flashcards.append({
                "id": f"fc-{idx+1}",
                "front": f"What is discussed regarding '{topic}' at [{ts}] in '{v_title}'?",
                "back": txt,
                "timestamp": ts,
                "flipped": False
            })
    else:
        summary = await Summary.find_one(Summary.video_id == video_id)
        items = (summary.key_takeaways if (summary and summary.key_takeaways) else []) or [
            "Video lecture overview and key learning objectives.",
            "Methodology and system architecture principles.",
            "Summary analysis and practical implementation takeaways."
        ]
        for idx, itm in enumerate(items[:8]):
            flashcards.append({
                "id": f"fc-{idx+1}",
                "front": f"Core Concept {idx+1}: {itm.split('.')[0] if '.' in itm else itm[:45]}...",
                "back": itm,
                "timestamp": f"0{idx}:00",
                "flipped": False
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

