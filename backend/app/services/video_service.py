from app.models.video import Video


def save_video(
    db,
    title,
    filename,
    transcript,
    summary,
    keywords,
    duration=0,
    word_count=0,
    transcript_timestamps=""
):

    video = Video(
        title=title,
        filename=filename,
        transcript=transcript,
        summary=summary,
        keywords=keywords,
        duration=duration,
        word_count=word_count,
        transcript_timestamps=transcript_timestamps
    )

    db.add(video)
    db.commit()
    db.refresh(video)

    return video