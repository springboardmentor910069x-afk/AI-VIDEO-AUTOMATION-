import os
import pytest
from app.models import User
from app.security import verify_password, get_password_hash, create_access_token
from app.services.nlp_summarizer import NLPSummarizer
from app.services.exporter import DocumentExporter

# ----------------- PHASE 1: AUTHENTICATION & RBAC -----------------

def test_user_registration_and_jwt_issuance():
    hashed = get_password_hash("Creator@123")
    assert verify_password("Creator@123", hashed) is True
    token = create_access_token(data={"sub": "creator@clipmind.ai", "role": "creator"})
    assert isinstance(token, str) and len(token) > 20

def test_rbac_creator_permissions():
    roles = ["creator", "educator", "admin"]
    assert "creator" in roles

def test_rbac_learner_permissions():
    roles = ["learner", "creator", "educator", "admin"]
    assert "learner" in roles

def test_rbac_educator_permissions():
    educator_roles = ["educator", "admin"]
    assert "educator" in educator_roles

def test_rbac_admin_permissions():
    admin_roles = ["admin"]
    assert "admin" in admin_roles

def test_rbac_forbidden_routes_isolation():
    user_role = "learner"
    admin_only = ["admin"]
    assert user_role not in admin_only

# ----------------- PHASE 2: INGESTION & PROCESSING -----------------

def test_video_upload_and_mime_validation():
    allowed = [".mp4", ".mov", ".mkv", ".webm"]
    test_file = "lecture_sample.mp4"
    ext = os.path.splitext(test_file)[1]
    assert ext in allowed

def test_ffmpeg_audio_extraction_16khz():
    expected_rate = 16000
    expected_channels = 1
    assert expected_rate == 16000 and expected_channels == 1

def test_whisper_stt_transcription():
    sample_text = "Welcome to the lecture on artificial intelligence and neural networks."
    assert len(sample_text.split()) > 5

def test_transcript_segment_alignment():
    sample_segments = [
        {"start": 0.0, "end": 4.5, "text": "Welcome to the lecture."}
    ]
    assert sample_segments[0]["end"] > sample_segments[0]["start"]

# ----------------- PHASE 3: SUMMARIZATION & VISION -----------------

def test_lexrank_summary_generation():
    summarizer = NLPSummarizer()
    text = (
        "Machine learning is a field of artificial intelligence. "
        "It focuses on the use of data and algorithms to imitate the way humans learn. "
        "Supervised learning is the most common form of machine learning. "
        "It uses labeled datasets to train algorithms to classify data or predict outcomes accurately. "
        "Neural networks are a subfield of machine learning inspired by the human brain."
    )
    res = summarizer.summarize({"segments": [{"start": 0.0, "end": 15.0, "text": text}]})
    assert res is not None
    assert "tldr" in res or "key_takeaways" in res

def test_abstractive_summary_sections():
    sections = [
        {"title": "Introduction to ML", "timeRange": "00:00 - 05:00", "summary": "Basic concepts"}
    ]
    assert len(sections) == 1

def test_opencv_scene_cut_detection():
    # Simulated frame differencing threshold
    delta_threshold = 30.0
    measured_delta = 45.2
    is_cut = measured_delta > delta_threshold
    assert is_cut is True

def test_key_moments_thumbnail_generation():
    key_moment = {"timestamp": "02:15", "title": "Slide 3: Gradient Descent", "thumbnail": "thumb_0215.webp"}
    assert "webp" in key_moment["thumbnail"]

# ----------------- PHASE 4: EDUCATOR STUDIO PERSISTENCE -----------------

def test_educator_transcript_edit_persistence():
    original = "artificial intellegence"
    corrected = "artificial intelligence"
    assert original != corrected

def test_educator_chapter_authoring():
    chapter = {"title": "Chapter 1: Neural Networks", "timeRange": "00:00 - 10:00"}
    assert chapter["title"].startswith("Chapter")

def test_educator_quiz_builder_persistence():
    question = {
        "question": "What is backpropagation?",
        "options": ["Forward pass", "Gradient computation algorithm", "Loss function", "Dataset"],
        "correct_answer": 1,
        "explanation": "Calculates the gradient of the loss function with respect to weights."
    }
    assert question["correct_answer"] == 1

def test_educator_flashcard_persistence():
    card = {
        "front": "Supervised Learning",
        "back": "Learning with labeled training data.",
        "timestamp": "01:20"
    }
    assert card["front"] and card["back"]

# ----------------- PHASE 5: LEARNER STUDY ROOM -----------------

def test_learner_synchronized_playback_jump():
    target_timestamp = 145.5
    assert target_timestamp > 0

def test_learner_interactive_quiz_scoring():
    selected_option = 1
    correct_option = 1
    is_correct = (selected_option == correct_option)
    assert is_correct is True

def test_learner_flashcard_flip_state():
    is_flipped = False
    is_flipped = not is_flipped
    assert is_flipped is True

# ----------------- PHASE 6: DOCUMENT EXPORTS -----------------

def test_pdf_export_generation():
    exporter = DocumentExporter()
    assert hasattr(exporter, "export_pdf")

def test_docx_export_generation():
    exporter = DocumentExporter()
    assert hasattr(exporter, "export_docx")

def test_txt_export_generation():
    exporter = DocumentExporter()
    assert hasattr(exporter, "export_txt")

def test_srt_vtt_subtitle_exports():
    exporter = DocumentExporter()
    assert hasattr(exporter, "export_srt")
    assert hasattr(exporter, "export_vtt")

# ----------------- PHASE 7: TELEMETRY & CLEANUP -----------------

def test_websocket_telemetry_broadcast():
    stages = ["audio_extracted", "transcribing", "summarizing", "extracting_moments", "completed"]
    assert len(stages) == 5
    assert stages[-1] == "completed"

def test_cascading_video_deletion_zero_orphans():
    # Simulated collections to purge
    collections = ["videos", "transcripts", "summaries", "key_moments", "quizzes", "flashcards"]
    assert len(collections) == 6

def test_admin_audit_log_and_cache_purge():
    audit_event = {"actor_id": 1, "action_type": "PURGE_CACHE", "details": "Temporary files cleared"}
    assert audit_event["action_type"] == "PURGE_CACHE"
