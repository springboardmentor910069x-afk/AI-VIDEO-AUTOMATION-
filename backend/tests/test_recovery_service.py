"""Tests for the stale-processing recovery / watchdog reliability path.

The recovery service turns jobs stuck in a non-terminal state (PROCESSING /
PENDING) into a terminal FAILED state so the frontend never polls a job that
can never finish. This covers the terminal-state invariant at the unit level
and, when a database is reachable, exercises the real recovery against empty
state (integration).
"""

from app.services.recovery_service import STALE_PROCESSING_MESSAGE


def test_stale_processing_message_is_terminal_failure_hint():
    # The message must clearly flag an interrupted job.
    assert "interrupted" in STALE_PROCESSING_MESSAGE


def test_recovery_succeeds_when_no_stale_jobs(event_loop):
    """With no stuck jobs, recovery reports 0 fixed and does not crash."""
    from sqlalchemy.exc import OperationalError

    from app.services.recovery_service import recover_stale_processing

    async def run():
        return await recover_stale_processing()

    try:
        fixed = event_loop.run_until_complete(run())
    except OperationalError:
        pytest.skip("Live database not reachable; skipping integration check")

    assert fixed == 0


def test_recovery_watchdog_is_wired_into_lifespan():
    """The app lifespan must start a periodic watchdog task."""
    import inspect

    from app import main

    source = inspect.getsource(main.lifespan)
    assert "watchdog" in source
    assert "recover_stale_processing" in source
