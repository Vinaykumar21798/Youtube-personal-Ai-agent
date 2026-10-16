from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_NAME: str = "GrowTube"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    SECRET_KEY: str = "growtube-default-dev-secret-key-32-chars-long"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database (SQLite exclusively)
    DATABASE_URL: str = "sqlite:///./data/growtube.db"

    # Uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Worker
    WORKER_POLL_INTERVAL_SECONDS: float = 2.0
    WORKER_CONCURRENCY: int = 2

    # Integrations
    YOUTUBE_API_KEY: str | None = None
    TAVILY_API_KEY: str | None = None
    LLM_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    LLM_MODEL: str = "qwen2.5:3b"

    # Google OAuth 2.0 / OpenID Connect
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # Session Management & CSRF Protection
    SESSION_COOKIE_NAME: str = "growtube_session"
    SESSION_COOKIE_SECURE: bool = False
    SESSION_COOKIE_SAMESITE: str = "lax"
    CSRF_COOKIE_NAME: str = "growtube_csrf"
    CSRF_SECRET: str = "growtube-csrf-secret-key-32-chars-long"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent.parent

    @property
    def resolved_database_url(self) -> str:
        """Resolve SQLite database path to an absolute path so API processes, workers,
        and CLI tools all target the exact same database file regardless of working directory."""
        url = self.DATABASE_URL
        if url.startswith("sqlite:///"):
            raw_path = url.replace("sqlite:///", "")
            path_obj = Path(raw_path)
            if not path_obj.is_absolute():
                path_obj = (self.project_root / path_obj).resolve()
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path_obj.as_posix()}"
        return url

    @property
    def upload_path(self) -> Path:
        path = Path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
