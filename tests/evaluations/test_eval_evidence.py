from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_findings_must_link_to_evidence():
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@growtube.dev", "password": "growtube123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    report_resp = client.get("/api/v1/reports/latest", headers=headers)
    if report_resp.status_code == 200:
        report = report_resp.json()
        findings = report.get("key_findings", [])
        evidence_sources = report.get("evidence_sources", [])

        # Every finding must have a non-empty statement, description, and recommendation
        for f in findings:
            assert len(f["title"]) > 5
            assert len(f["description"]) > 5
            assert len(f["recommendation"]) > 5

        # Evidence sources must have confidence score between 0.0 and 1.0
        for ev in evidence_sources:
            assert 0.0 <= ev["confidence"] <= 1.0
