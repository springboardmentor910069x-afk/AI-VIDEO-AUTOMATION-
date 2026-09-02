import asyncio

import pytest


@pytest.fixture(scope="session")
def event_loop():
    """Reuse one event loop for every test in this session.

    The app's async SQLAlchemy engine pools connections tied to whichever
    loop first created them, so running each test on a fresh loop (asyncio.run)
    would attempt to borrow connections that belong to already-closed loops.
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()