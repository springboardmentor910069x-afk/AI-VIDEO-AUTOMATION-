"""Aggregated, role-scoped analytics for the dashboard.

All summary numbers are computed with SQL aggregate queries (COUNT / GROUP BY)
directly against the existing models — records are never loaded wholesale into
Python.  Non-administrator roles see only their own uploaded content; the
administrator role sees system-wide totals.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.key_moment import (
    KeyMoment,
    KeyMomentSet,
    KeyMomentSetStatus,
)
from app.models.keyword import Keyword, KeywordSet, KeywordSetStatus
from app.models.summary import Summary, SummaryStatus, SummaryType
from app.models.transcript import Transcript, TranscriptStatus
from app.models.user import User, UserRole
from app.models.video import UploadStatus, Video
from app.schemas.analytics import (
    AnalyticsDashboard,
    ProcessingCounts,
    RecentActivity,
    RecentVideo,
    SummaryTypeCounts,
)

RECENT_VIDEOS_LIMIT = 10
RECENT_ACTIVITY_LIMIT = 8
_ACTIVITY_FETCH = 20


def _scope(user: User) -> list:
    """WHERE conditions used to scope queries to the current user.

    Administrators see every video; every other role sees only the content
    they uploaded (the project's existing data-ownership model).
    """
    if user.role == UserRole.ADMINISTRATOR:
        return []
    return [Video.uploaded_by == user.id]


async def _count(db: AsyncSession, model, joins: list, scope: list) -> int:
    statement = select(func.count()).select_from(model)
    for join_model, onclause in joins:
        statement = statement.join(join_model, onclause)
    if scope:
        statement = statement.where(*scope)
    result = await db.execute(statement)
    return int(result.scalar_one() or 0)


async def _processing_counts(
    db: AsyncSession,
    scope: list,
) -> ProcessingCounts:
    statement = (
        select(Video.upload_status, func.count())
        .group_by(Video.upload_status)
    )
    if scope:
        statement = statement.where(*scope)

    rows = (await db.execute(statement)).all()
    counts = {status.value: 0 for status in UploadStatus}
    for status_enum, count in rows:
        counts[status_enum.value] = int(count)
    return ProcessingCounts(**counts)


async def _summary_type_counts(
    db: AsyncSession,
    scope: list,
) -> SummaryTypeCounts:
    statement = (
        select(Summary.summary_type, func.count())
        .join(Video, Summary.video_id == Video.id)
        .group_by(Summary.summary_type)
    )
    if scope:
        statement = statement.where(*scope)

    rows = (await db.execute(statement)).all()
    counts = {summary_type.value: 0 for summary_type in SummaryType}
    for summary_type, count in rows:
        counts[summary_type.value] = int(count)
    return SummaryTypeCounts(**counts)


async def _recent_videos(
    db: AsyncSession,
    scope: list,
) -> list[RecentVideo]:
    statement = select(Video)
    if scope:
        statement = statement.where(*scope)
    statement = statement.order_by(Video.created_at.desc()).limit(RECENT_VIDEOS_LIMIT)

    videos = (await db.execute(statement)).scalars().all()
    return [
        RecentVideo(
            id=video.id,
            title=video.title,
            status=video.upload_status,
            duration=video.duration,
            file_size=video.file_size,
            created_at=video.created_at,
        )
        for video in videos
    ]


async def _collection_activity(
    db: AsyncSession,
    scope: list,
    *,
    event_type: str,
    model,
) -> list[dict]:
    statement = (
        select(model, Video.title)
        .join(Video, model.video_id == Video.id)
        .order_by(model.created_at.desc())
        .limit(_ACTIVITY_FETCH)
    )
    if scope:
        statement = statement.where(*scope)

    rows = (await db.execute(statement)).all()
    return [
        {
            "type": event_type,
            "video_id": row[0].video_id,
            "video_title": row[1],
            "status": row[0].status.value,
            "occurred_at": row[0].created_at,
        }
        for row in rows
    ]


async def _recent_activity(
    db: AsyncSession,
    scope: list,
) -> list[RecentActivity]:
    events: list[dict] = []

    events.extend(
        await _collection_activity(
            db, scope, event_type="transcript", model=Transcript,
        )
    )
    events.extend(
        await _collection_activity(
            db, scope, event_type="summary", model=Summary,
        )
    )
    events.extend(
        await _collection_activity(
            db, scope, event_type="key_moments", model=KeyMomentSet,
        )
    )
    events.extend(
        await _collection_activity(
            db, scope, event_type="keywords", model=KeywordSet,
        )
    )

    events.sort(key=lambda event: event["occurred_at"], reverse=True)
    return [RecentActivity(**event) for event in events[:RECENT_ACTIVITY_LIMIT]]


async def get_analytics_dashboard(
    db: AsyncSession,
    user: User,
) -> AnalyticsDashboard:
    scope = _scope(user)

    total_videos = await _count(db, Video, joins=[], scope=scope)
    processed_videos = await _count(
        db,
        Video,
        joins=[],
        scope=[*scope, Video.upload_status == UploadStatus.READY],
    )
    total_transcripts = await _count(
        db,
        Transcript,
        joins=[(Video, Transcript.video_id == Video.id)],
        scope=scope,
    )
    total_summaries = await _count(
        db,
        Summary,
        joins=[(Video, Summary.video_id == Video.id)],
        scope=scope,
    )
    total_key_moments = await _count(
        db,
        KeyMoment,
        joins=[
            (KeyMomentSet, KeyMoment.set_id == KeyMomentSet.id),
            (Video, KeyMomentSet.video_id == Video.id),
        ],
        scope=scope,
    )
    total_keywords = await _count(
        db,
        Keyword,
        joins=[
            (KeywordSet, Keyword.set_id == KeywordSet.id),
            (Video, KeywordSet.video_id == Video.id),
        ],
        scope=scope,
    )
    failed_transcripts = await _count(
        db,
        Transcript,
        joins=[(Video, Transcript.video_id == Video.id)],
        scope=[*scope, Transcript.status == TranscriptStatus.FAILED],
    )
    failed_summaries = await _count(
        db,
        Summary,
        joins=[(Video, Summary.video_id == Video.id)],
        scope=[*scope, Summary.status == SummaryStatus.FAILED],
    )
    failed_key_moment_sets = await _count(
        db,
        KeyMomentSet,
        joins=[(Video, KeyMomentSet.video_id == Video.id)],
        scope=[*scope, KeyMomentSet.status == KeyMomentSetStatus.FAILED],
    )
    failed_keyword_sets = await _count(
        db,
        KeywordSet,
        joins=[(Video, KeywordSet.video_id == Video.id)],
        scope=[*scope, KeywordSet.status == KeywordSetStatus.FAILED],
    )

    processing = await _processing_counts(db, scope)
    summary_types = await _summary_type_counts(db, scope)
    recent_videos = await _recent_videos(db, scope)
    recent_activity = await _recent_activity(db, scope)

    return AnalyticsDashboard(
        total_videos=total_videos,
        processed_videos=processed_videos,
        total_transcripts=total_transcripts,
        total_summaries=total_summaries,
        total_key_moments=total_key_moments,
        total_keywords=total_keywords,
        processing=processing,
        summary_types=summary_types,
        failed_transcripts=failed_transcripts,
        failed_summaries=failed_summaries,
        failed_key_moment_sets=failed_key_moment_sets,
        failed_keyword_sets=failed_keyword_sets,
        recent_videos=recent_videos,
        recent_activity=recent_activity,
    )