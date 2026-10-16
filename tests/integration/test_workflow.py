from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_end_to_end_analysis_workflow():
    # 1. Login or obtain demo user
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@growtube.dev", "password": "growtube123"},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    csrf_token = client.cookies.get("growtube_csrf")
    headers = {"Authorization": f"Bearer {token}"}
    if csrf_token:
        headers["X-CSRF-Token"] = csrf_token

    # 2. Submit analysis job
    job_resp = client.post(
        "/api/v1/jobs",
        json={"input_target": "https://www.youtube.com/@alexbuildsai"},
        headers=headers,
    )
    assert job_resp.status_code == 201
    job_id = job_resp.json()["id"]

    # 3. Poll job status
    poll_resp = client.get(f"/api/v1/jobs/{job_id}", headers=headers)
    assert poll_resp.status_code == 200
    data = poll_resp.json()
    assert data["status"] in ["queued", "running", "succeeded"]

    # 4. Fetch latest report
    report_resp = client.get("/api/v1/reports/latest", headers=headers)
    assert report_resp.status_code == 200
    report_data = report_resp.json()
    assert "key_findings" in report_data
    assert len(report_data["key_findings"]) >= 1
    assert "metrics_summary" in report_data
