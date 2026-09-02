"""Integration tests for the analytics aggregation service.

These run read-only aggregate queries against the live local PostgreSQL
database when it is reachable, and otherwise skip.  No rows are created or
modified.
"""

from sqlalchemy import select

from app.database import async_session
from app.models.user import User, UserRole
from app.services.analytics_service import get_analytics_dashboard


def test_dashboard_counts_are_aggregates(event_loop):
    async def run():
        async with async_session() as db:
            result = await db.execute(select(User).limit(1))
            user = result.scalar_one_or_none()
            if user is None:
                raise _Skip("No users in database")
            return await get_analytics_dashboard(db, user)

    dashboard = event_loop.run_until_complete(run())

    assert dashboard.total_videos >= 0
    assert dashboard.processed_videos >= 0
    assert dashboard.total_transcripts >= 0
    assert dashboard.total_summaries >= 0
    assert dashboard.total_key_moments >= 0
    assert dashboard.total_keywords >= 0
    assert 0 <= dashboard.processed_videos <= dashboard.total_videos

    # Processing breakdown covers every status bucket.
    counts = dashboard.processing
    total_breakdown = counts.pending + counts.processing + counts.ready + counts.failed
    assert total_breakdown == dashboard.total_videos

    # Summary type breakdown covers every summary.
    summary_types = dashboard.summary_types
    assert summary_types.short + summary_types.detailed == dashboard.total_summaries

    assert len(dashboard.recent_videos) <= 10
    assert len(dashboard.recent_activity) <= 8


def test_non_admin_scope_is_within_system_wide(event_loop):
    async def run():
        async with async_session() as db:
            result = await db.execute(select(User).limit(10))
            users = result.scalars().all()
            if not users:
                raise _Skip("No users in database")

            admin = next(
                (user for user in users if user.role == UserRole.ADMINISTRATOR),
                None,
            )
            if admin is None:
                raise _Skip("No administrator in database")

            system_wide = await get_analytics_dashboard(db, admin)
            results = []
            for other in users:
                if other.role == UserRole.ADMINISTRATOR:
                    continue
                scoped = await get_analytics_dashboard(db, other)
                results.append((scoped, system_wide))
            return results

    results = event_loop.run_until_complete(_guard(run))

    for scoped, system_wide in results:
        assert scoped.total_videos <= system_wide.total_videos
        assert scoped.total_keywords <= system_wide.total_keywords
        assert scoped.total_summaries <= system_wide.total_summaries


def test_empty_aggregates_do_not_crash(event_loop):
    async def run():
        async with async_session() as db:
            result = await db.execute(select(User).limit(10))
            users = result.scalars().all()
            if not users:
                raise _Skip("No users in database")

            for user in users:
                scoped = await get_analytics_dashboard(db, user)
                if scoped.total_videos == 0:
                    return scoped
            return None

    dashboard = event_loop.run_until_complete(_guard(run))
    assert dashboard is not None

    assert dashboard.total_videos == 0
    assert dashboard.total_transcripts == 0
    assert dashboard.total_keywords == 0
    assert dashboard.recent_videos == []
    assert dashboard.recent_activity == []


class _Skip(Exception):
    pass


async def _guard(coro_fn):
    try:
        return await coro_fn()
    except _Skip as exc:
        import pytest

        pytest.skip(str(exc))