from collections import Counter

from app.schemas.ai import AnalyticsRead, KeyMoment, TranscriptRead

STOPWORDS = {"the", "and", "with", "this", "that", "into", "for", "to", "a", "of", "it", "is", "video", "uploaded"}


class InsightService:
    async def key_moments(self, transcript: TranscriptRead) -> list[KeyMoment]:
        moments: list[KeyMoment] = []
        for segment in transcript.segments:
            weighted_words = {"important", "key", "because", "therefore", "shows", "explains", "analysis", "summary", "takeaway"}
            score = min(1.0, max(0.25, len(segment.text.split()) / 18 + sum(word in segment.text.lower() for word in weighted_words) * 0.12))
            moments.append(
                KeyMoment(
                    video_id=transcript.video_id,
                    timestamp=segment.start,
                    title=segment.text[:70],
                    importance_score=round(score, 2),
                    thumbnail_url=f"/static/thumbnails/{transcript.video_id}-{int(segment.start)}.jpg",
                )
            )
        return sorted(moments, key=lambda item: item.importance_score, reverse=True)[:5]

    async def analytics(self, transcript: TranscriptRead) -> AnalyticsRead:
        words = [word.strip(".,:;!?").lower() for word in transcript.full_text.split()]
        topics = [word for word, _ in Counter(w for w in words if w and w not in STOPWORDS).most_common(5)]
        sentiment = "positive" if {"important", "practical", "takeaways"} & set(words) else "neutral"
        return AnalyticsRead(
            video_id=transcript.video_id,
            watch_time=max((segment.end for segment in transcript.segments), default=0),
            engagement_score=round(min(100, 55 + len(topics) * 7), 2),
            topics=topics,
            sentiment=sentiment,
        )
