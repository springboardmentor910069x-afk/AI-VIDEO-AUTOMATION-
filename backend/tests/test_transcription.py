import pytest

from app.services.transcription import TranscriptionService


@pytest.mark.asyncio
async def test_transcription_returns_time_aligned_segments():
    result = await TranscriptionService().transcribe("video-1", "demo.mp4")
    assert result.video_id == "video-1"
    assert result.full_text
    assert result.segments[0].start == 0
    assert result.segments[0].end > result.segments[0].start

