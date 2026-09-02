# MongoDB Collection Shapes

`transcripts`

```json
{
  "video_id": "uuid",
  "full_text": "Complete transcript",
  "segments": [{ "start": 0.0, "end": 12.0, "text": "..." }],
  "language": "en"
}
```

`summaries`

```json
{
  "video_id": "uuid",
  "short_summary": "...",
  "detailed_summary": "...",
  "generated_at": "2026-07-25T00:00:00Z"
}
```

`key_moments`

```json
{
  "video_id": "uuid",
  "timestamp": 32.0,
  "title": "Important concept explained",
  "importance_score": 0.91,
  "thumbnail_url": "/static/thumbnails/video-32.jpg"
}
```

`analytics`

```json
{
  "video_id": "uuid",
  "watch_time": 600.0,
  "engagement_score": 86.4,
  "topics": ["learning", "summary", "workflow"],
  "sentiment": "positive"
}
```

