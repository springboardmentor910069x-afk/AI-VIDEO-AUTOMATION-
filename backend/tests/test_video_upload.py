from io import BytesIO

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_upload_rejects_non_video():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await app.router.startup()
        await client.post(
            "/api/auth/register",
            json={"name": "Uploader", "email": "uploader@example.com", "password": "password123", "role": "creator"},
        )
        login = await client.post("/api/auth/login", json={"email": "uploader@example.com", "password": "password123"})
        token = login.json()["access_token"]
        response = await client.post(
            "/api/videos",
            headers={"Authorization": f"Bearer {token}"},
            data={"title": "Bad upload"},
            files={"file": ("notes.txt", BytesIO(b"hello"), "text/plain")},
        )
        assert response.status_code == 400
        await app.router.shutdown()

