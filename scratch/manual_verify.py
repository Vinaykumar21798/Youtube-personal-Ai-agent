import sys
import httpx
import urllib.parse
from app.core.security import get_safe_redirect_url

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_manual_scenarios():
    results = []
    client = httpx.Client(base_url=BASE_URL, follow_redirects=False, timeout=10.0)

    # Scenario 1: Public Landing Page
    r = client.get("/")
    assert r.status_code == 200, f"Expected 200 for /, got {r.status_code}"
    html = r.text
    checks = [
        ('href="#product"', "Product anchor link"),
        ('href="#how-it-works"', "How it works anchor link"),
        ('href="#pricing"', "Pricing anchor link"),
        ('href="#resources"', "Resources anchor link"),
        ('href="/login"', "Sign in link"),
        ('href="/login?return_to=%2Fanalyze"', "Get Started CTA with return_to"),
        ('Start Analyzing →', "Hero CTA text"),
        ('See How It Works', "Hero secondary CTA"),
        ('Agent Pipeline', "Hero pipeline label"),
        ('Sample channel benchmark', "Illustrative metric disclaimer"),
        ('id="product"', "Product section target"),
        ('id="how-it-works"', "How it works section target"),
        ('id="pricing"', "Pricing section target"),
        ('id="resources"', "Resources section target"),
        ('7-Point High-CTR Title Playbook', "Resource Playbook"),
        ('First 30 Seconds Retention Blueprint', "Resource Blueprint"),
        ('Autonomous Agent Architecture Guide', "Resource Architecture"),
        ('Platform API & Webhook Reference', "Resource API Reference"),
    ]
    for pattern, name in checks:
        if pattern in html:
            results.append((f"Landing Page: {name}", "PASS", f"Found '{pattern}'"))
        else:
            results.append((f"Landing Page: {name}", "FAIL", f"Missing '{pattern}'"))

    # Scenario 2: Signed-out direct access to protected routes
    protected_routes = [
        "/dashboard",
        "/video-analysis",
        "/analyze",
        "/report",
        "/niche-radar",
        "/creator-struggles",
        "/ask-ai",
        "/opportunities",
        "/content-studio",
        "/experiments",
    ]
    for route in protected_routes:
        res = client.get(route)
        expected_loc = f"/login?return_to={urllib.parse.quote(route)}"
        if res.status_code == 302 and res.headers.get("Location") == expected_loc:
            results.append((f"Signed-out protection: {route}", "PASS", f"302 -> {res.headers.get('Location')}"))
        else:
            results.append((f"Signed-out protection: {route}", "FAIL", f"Got status {res.status_code}, Location: {res.headers.get('Location')}"))

    # Scenario 3: Unauthenticated API calls return 401 Unauthorized
    api_endpoints = [
        ("GET", "/api/v1/channels/overview"),
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/conversations"),
        ("GET", "/api/v1/niche-radar/suggest"),
        ("GET", "/api/v1/creator-struggles/suggestions"),
        ("POST", "/api/v1/videos/analyze"),
        ("GET", "/api/v1/opportunities"),
        ("GET", "/api/v1/reports/latest"),
    ]
    for method, ep in api_endpoints:
        if method == "POST":
            res = client.post(ep, json={"target": "dQw4w9WgXcQ"})
        else:
            res = client.get(ep)
        if res.status_code == 401:
            results.append((f"API Auth Enforcement: {method} {ep}", "PASS", "401 Unauthorized"))
        else:
            results.append((f"API Auth Enforcement: {method} {ep}", "FAIL", f"Expected 401, got {res.status_code}"))

    # Scenario 4: Open Redirect Protection
    open_redirect_vectors = [
        ("//evil.com", "/dashboard"),
        ("https://evil.com", "/dashboard"),
        ("http://evil.com", "/dashboard"),
        ("/\\evil.com", "/dashboard"),
        ("javascript:alert(1)", "/dashboard"),
        ("///evil.com", "/dashboard"),
        ("/analyze?param=1", "/analyze?param=1"),
        ("/creator-struggles", "/creator-struggles"),
    ]
    for vector, expected in open_redirect_vectors:
        sanitized = get_safe_redirect_url(vector, default="/dashboard")
        if sanitized == expected:
            results.append((f"Open Redirect sanitizer: '{vector}'", "PASS", f"Sanitized to '{sanitized}'"))
        else:
            results.append((f"Open Redirect sanitizer: '{vector}'", "FAIL", f"Expected '{expected}', got '{sanitized}'"))

    # Scenario 5: Authenticated access & return_to flow
    login_resp = client.post("/api/v1/auth/login", json={"email": "alex@growtube.dev", "password": "growtube123"})
    if login_resp.status_code == 200:
        results.append(("Login with demo credentials", "PASS", "200 OK, session established"))
        cookies = login_resp.cookies
        
        # Test authenticated access to protected pages
        auth_client = httpx.Client(base_url=BASE_URL, cookies=cookies, follow_redirects=False, timeout=10.0)
        
        # Test accessing /dashboard
        dash_res = auth_client.get("/dashboard")
        if dash_res.status_code == 200:
            results.append(("Authenticated access: /dashboard", "PASS", "200 OK HTML served"))
        else:
            results.append(("Authenticated access: /dashboard", "FAIL", f"Status: {dash_res.status_code}"))
            
        # Test accessing /analyze
        an_res = auth_client.get("/analyze")
        if an_res.status_code == 200:
            results.append(("Authenticated access: /analyze", "PASS", "200 OK HTML served"))
        else:
            results.append(("Authenticated access: /analyze", "FAIL", f"Status: {an_res.status_code}"))

        # Test visiting /login when already authenticated -> should redirect to return_to or /dashboard
        login_page_res = auth_client.get("/login?return_to=%2Fcreator-struggles")
        if login_page_res.status_code == 302 and login_page_res.headers.get("Location") == "/creator-struggles":
            results.append(("Already-authenticated /login redirect", "PASS", "302 -> /creator-struggles"))
        else:
            results.append(("Already-authenticated /login redirect", "FAIL", f"Status: {login_page_res.status_code}, Location: {login_page_res.headers.get('Location')}"))

        # Test authenticated API endpoint
        api_me_res = auth_client.get("/api/v1/auth/me")
        if api_me_res.status_code == 200 and api_me_res.json().get("email") == "alex@growtube.dev":
            results.append(("Authenticated API: /auth/me", "PASS", "200 OK, returned Alex profile"))
        else:
            results.append(("Authenticated API: /auth/me", "FAIL", f"Status: {api_me_res.status_code}"))

        # Scenario 6: Logout
        csrf_token = cookies.get("growtube_csrf")
        logout_res = auth_client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": csrf_token})
        if logout_res.status_code == 200:
            results.append(("Logout request", "PASS", "200 OK, session revoked"))
            
            # Verify accessing /dashboard after logout redirects to login
            post_logout_res = auth_client.get("/dashboard")
            if post_logout_res.status_code == 302 and "/login" in post_logout_res.headers.get("Location", ""):
                results.append(("Post-logout protection: /dashboard", "PASS", f"302 -> {post_logout_res.headers.get('Location')}"))
            else:
                results.append(("Post-logout protection: /dashboard", "FAIL", f"Status: {post_logout_res.status_code}"))
        else:
            results.append(("Logout request", "FAIL", f"Status: {logout_res.status_code}"))

    else:
        results.append(("Login with demo credentials", "FAIL", f"Status {login_resp.status_code}"))

    # Print summary
    print("\n" + "="*80)
    print(f"{'SCENARIO':<50} | {'STATUS':<6} | {'DETAILS'}")
    print("="*80)
    for name, status, details in results:
        print(f"{name:<50} | {status:<6} | {details}")
    print("="*80)

if __name__ == "__main__":
    test_manual_scenarios()
