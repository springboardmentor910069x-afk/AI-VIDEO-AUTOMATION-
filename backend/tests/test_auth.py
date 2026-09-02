import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_register_login_and_me():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await app.router.startup()
        response = await client.post(
            "/api/auth/register",
            json={"name": "Demo Creator", "email": "creator@example.com", "password": "password123", "role": "creator"},
        )
        assert response.status_code in {201, 409}
        login = await client.post("/api/auth/login", json={"email": "creator@example.com", "password": "password123"})
        assert login.status_code == 200
        token = login.json()["access_token"]
        me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["role"] == "creator"
        await app.router.shutdown()

