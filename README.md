# GrowTube — YouTube Growth Agent Platform

An open-source-first, production-oriented, multi-tenant agentic platform that analyzes YouTube channel and video performance, diagnoses retention and packaging friction using empirical evidence, and generates ranked opportunities and production-ready briefs.

Built with **Python 3.12**, **FastAPI**, **SQLAlchemy 2.0**, **SQLite (WAL Mode)**, and an editorial-intelligence frontend crafted in **semantic HTML5, modern CSS3, and vanilla JavaScript**.

---

## 1. Architectural Overview & Module Boundaries

The platform operates as a modular monolith with decoupled background worker processing and zero external database dependencies:

```
youtube-growth-agent/
├── frontend/                     # Pure HTML5, CSS3, Vanilla ES-Module Frontend
│   ├── index.html                # Editorial Marketing Landing Page (Screen 1)
│   ├── pages/
│   │   ├── login.html            # Authentication & Workspace Switcher
│   │   ├── dashboard.html        # Channel Overview & Key Insights (Screen 2)
│   │   ├── analyze.html          # Input Submission & Live Agent Activity (Screen 3)
│   │   ├── report.html           # Evidence-Based Growth Report (Screen 4)
│   │   ├── opportunities.html    # Ranked Content Opportunities (Screen 5)
│   │   ├── content-studio.html   # Script Generator & Pre-Publish Review (Screen 6)
│   │   └── experiments.html      # Hypothesis Registry & Outcome Learning
│   ├── css/                      # tokens.css, base.css, layout.css, components.css, pages.css
│   └── js/                       # config.js, api.js, auth.js, dashboard.js, analyze.js, report.js...
├── data/                         # Local SQLite Database Storage (growtube.db)
├── app/
│   ├── main.py                   # FastAPI Application Entrypoint & Static Server
│   ├── api/v1/                   # Modular REST Routers (/auth, /channels, /jobs, /reports...)
│   ├── core/                     # Configuration, Security (PBKDF2/HMAC), Logging, Errors
│   ├── db/                       # Base, Session, Models (SQLite), Data Seeding
│   ├── modules/                  # Feature Modules
│   │   ├── identity/             # Users, Workspaces, Memberships, RBAC
│   │   ├── data_ingestion/       # YouTube URL Parser, CSV & JSON Analytics Ingester
│   │   ├── integrations/         # Official YouTube Data API v3 & Public Fallback
│   │   ├── analytics/            # Deterministic Baselines, IQR Drops, Timeseries
│   │   ├── agent_runtime/        # 5-Stage Bounded Agent Workflow Orchestration
│   │   ├── evidence/             # Immutable Evidence Graph & Epistemic Tiering
│   │   ├── opportunity_engine/   # Multi-Factor Scoring Formula & Ranking
│   │   ├── content_studio/       # Structured Video Briefs & Script Generator
│   │   ├── creator_memory/       # Channel Playbook & Tone Guidelines
│   │   ├── creator_struggles/    # 4-Source Universal Creator Struggles Research Engine
│   │   ├── experiments/          # Pre-Publish Hypotheses & Outcome Learning
│   │   ├── niche_radar/          # Outlier Video Radar & Breakout Signals
│   │   └── job_management/       # Durable Job Lifecycle & Event Streams
│   └── workers/                  # Background Worker Execution Engine
├── migrations/                   # Alembic Database Migrations
├── tests/                        # unit, integration, security, evaluations
├── Dockerfile                    # Containerization Spec
├── docker-compose.yml            # Application & Worker Compose Spec
└── requirements.txt              # Pinned Dependencies
```

---

## 2. Quickstart & Local Setup (Windows 11 / PowerShell)

### Prerequisites
- Python 3.12+ installed
- PowerShell or Windows Terminal
- **Zero database installation required** (runs directly on native SQLite)

### Step 1: Virtual Environment Setup
```powershell
# Navigate to workspace
cd c:\Users\vtapela\youtube-growth-agent

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install / verify dependencies
python -m pip install -r requirements.txt
```

### Step 2: Environment Configuration
Create your local `.env` configuration file from the template:
```powershell
Copy-Item .env.example .env
```

Your `.env` uses SQLite out-of-the-box:
```ini
DATABASE_URL=sqlite:///./data/growtube.db
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/google/callback
SECRET_KEY=your-secure-random-key
CSRF_SECRET=your-secure-csrf-key
```

### Step 3: Run Database Migrations
Apply the latest Alembic schema migrations:
```powershell
alembic upgrade head
```

### Step 4: Start the Application Directly
Start the Uvicorn development server:
```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The application automatically:
1. Resolves `sqlite:///./data/growtube.db` as an absolute path, ensuring consistency across processes.
2. Enables SQLite foreign keys, 10-second busy timeout, and WAL journal mode.
3. Seeds default demo data (`alex@growtube.dev` workspace).
4. Launches the embedded in-process background worker thread.
5. Mounts the frontend at `http://127.0.0.1:8000/`.

---

## 3. Authentication Architecture & Security

- **Google Sign-In**: Uses Google OAuth 2.0 / OpenID Connect (`email`, `profile`, `openid`).
- **YouTube API Scope Isolation**: Google Sign-In is strictly separated from YouTube API authorization; sign-in does not request channel management or YouTube write permissions.
- **Server-Side Session Store**: Authenticated users receive an opaque, cryptographically random session token stored in SQLite (`user_sessions` table) and transmitted via an `HttpOnly`, `SameSite=Lax` cookie.
- **CSRF Protection**: Mutating endpoints (`POST`, `PUT`, `DELETE`, `PATCH`) enforce a double-submit CSRF cookie (`growtube_csrf`) and validate the `X-CSRF-Token` header.
- **Multi-Tenant RBAC**: Every request verifies user workspace membership and tenant boundaries. Cross-tenant queries are blocked at the repository/dependency layer.

---

## 5. End-to-End User Journey Walkthrough

1. **Landing Page (`/`)**:
   - Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) to view the editorial landing screen matching Screen 1.
   - Click **"Start Analyzing →"**.

2. **Dashboard Overview (`/dashboard`)**:
   - View real-time channel statistics (1.2M Views, 6.4% CTR, 47% Avg. Retention, +12.4K Subscribers) with sparklines.
   - Inspect the interactive 28-day performance chart featuring the March 16 peak.
   - Browse the top 4 ranked opportunities.

3. **Submit Channel & Run Agent Workflow (`/analyze`)**:
   - Enter any public YouTube handle or channel URL (e.g. `https://www.youtube.com/@alexbuildsai`) or click **"Upload CSV / JSON / Transcript"**.
   - Click **"Start Analyzing →"**.
   - The view switches immediately to Screen 3:
     - Watch the 5-stage progress bar advance from 0% to 100%.
     - Observe live agent events with real timestamps in the **Agent Activity** terminal stream.

4. **Review Grounded Growth Report (`/report`)**:
   - Automatically redirects to the report once the background worker finishes.
   - Review 3 evidence-verified Key Findings:
     1. Tutorial views multiplier (2.3x).
     2. CTR deficit relative to niche benchmark.
     3. Early 15-second hook drop-off.
   - Review registered supporting evidence records.
   - Click **"Create Content →"**.

5. **Content Opportunities (`/opportunities`)**:
   - Browse ranked topics filtered by category (Tutorials, Reviews, Tools, High Potential).
   - Filter by search keyword and bookmark topics.

6. **Content Studio & Script Generator (`/content-studio`)**:
   - Select a topic or type a custom video title.
   - Click **"Generate →"** to produce a structured video script containing Hook, Intro, Core Chapters, and Call to Action.
   - Audit the verified 6-point Script Checklist.
   - Edit and save draft revisions.

7. **Experiments (`/experiments`)**:
   - Review pre-publish predictions and log post-publish retention outcomes to continuously calibrate channel memory.

---

## 6. API Documentation

Interactive Swagger documentation is available at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

### Primary API Routes:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/auth/google/login` | Initiate Google OAuth 2.0 flow with state CSRF cookie |
| `GET` | `/api/v1/auth/google/callback` | OAuth redirect callback with code exchange |
| `POST` | `/api/v1/auth/google/credential` | Validate Google One Tap ID token |
| `POST` | `/api/v1/auth/login` | Authenticate with local email/password |
| `POST` | `/api/v1/auth/logout` | Revoke server session and clear HttpOnly cookies |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user, role, and active workspace |
| `GET` | `/api/v1/channels/overview` | Retrieve channel metrics and 28-day chart data |
| `POST` | `/api/v1/jobs` | Submit YouTube target and queue analysis job |
| `POST` | `/api/v1/jobs/upload` | Upload analytics CSV, JSON, or transcript file |
| `GET` | `/api/v1/jobs/{job_id}` | Poll job progress and live event stream |
| `GET` | `/api/v1/reports/latest` | Retrieve most recent evidence-grounded report |
| `GET` | `/api/v1/opportunities` | List ranked content opportunities with filters |
| `POST` | `/api/v1/studio/scripts/generate` | Generate structured script and checklist |
| `GET` | `/api/v1/experiments` | List hypothesis registry and outcomes |

---

## 7. Running Tests

When you are ready to execute the test suite:
```powershell
python -m pytest tests/
```
The test suite covers unit schema validation, deterministic calculations, integration workflow execution, multi-tenant security isolation, and evidence citation evaluations.
