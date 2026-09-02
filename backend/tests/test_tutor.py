from datetime import datetime

import pytest

from app.schemas.ai import SummaryRead, TranscriptRead, TranscriptSegment, VideoMetadata
from app.services.tutor import TutorService


@pytest.mark.asyncio
async def test_tutor_uses_youtube_channel_metadata_for_channel_question(monkeypatch):
    monkeypatch.setattr("app.services.tutor.get_settings", lambda: type("Settings", (), {"ai_provider": "none"})())
    answer = await TutorService().answer(
        video_id="video-1",
        question="Which YouTube channel is this video from?",
        transcript=None,
        summary=None,
        metadata=VideoMetadata(platform="youtube", channel_name="Kurzgesagt - In a Nutshell"),
    )
    assert "Kurzgesagt" in answer.answer
    assert answer.provider_used == "fallback-nlp"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("question", "expected_label"),
    [("Who is the singer?", "Singer name is:"), ("Who is the teacher?", "Teacher name is:")],
)
async def test_tutor_returns_labeled_youtube_channel_for_singer_and_teacher_questions(monkeypatch, question, expected_label):
    monkeypatch.setattr("app.services.tutor.get_settings", lambda: type("Settings", (), {"ai_provider": "none"})())
    answer = await TutorService().answer(
        video_id="video-1",
        question=question,
        transcript=None,
        summary=None,
        metadata=VideoMetadata(platform="youtube", channel_name="Study Beats", artist="Someone Else"),
    )
    assert expected_label in answer.answer
    assert "Study Beats" in answer.answer
    assert "Someone Else" not in answer.answer


@pytest.mark.asyncio
async def test_tutor_returns_relevant_transcript_evidence_not_full_summary(monkeypatch):
    monkeypatch.setattr("app.services.tutor.get_settings", lambda: type("Settings", (), {"ai_provider": "none"})())
    transcript = TranscriptRead(
        video_id="video-1",
        full_text="The app stores data locally. The price is 20 dollars per month.",
        segments=[
            TranscriptSegment(start=0, end=4, text="The app stores data locally."),
            TranscriptSegment(start=4, end=8, text="The price is 20 dollars per month."),
        ],
    )
    summary = SummaryRead(video_id="video-1", short_summary="A broad overview.", detailed_summary="General content.", generated_at=datetime.utcnow())
    answer = await TutorService().answer(
        video_id="video-1",
        question="What is the price?",
        transcript=transcript,
        summary=summary,
    )
    assert "20 dollars" in answer.answer
    assert "broad overview" not in answer.answer.lower()
