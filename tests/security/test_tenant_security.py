from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_unauthorized_access_fails_closed():
    # Attempting to fetch channels without authorization should fail closed
    # Note: demo fallback may provide read-only or explicit error
    resp = client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000", headers={"Authorization": "Bearer invalid_token_123"})
    assert resp.status_code == 401


def test_cross_tenant_header_isolation():
    # Login as Alex
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@growtube.dev", "password": "growtube123"},
    )
    token = login_resp.json()["access_token"]

    # Passing a foreign workspace ID that the user does not belong to must be rejected (403)
    resp = client.get(
        "/api/v1/channels/overview",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Workspace-Id": "foreign-unauthorized-workspace-999",
        },
    )
    assert resp.status_code == 403
