from typing import Any
from fastapi import HTTPException, status


class GrowTubeException(Exception):
    """Base application exception."""

    def __init__(self, message: str, code: str = "INTERNAL_ERROR", details: Any = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or {}


class TenantNotFoundException(GrowTubeException):
    def __init__(self, workspace_id: str):
        super().__init__(
            f"Workspace '{workspace_id}' not found or access denied",
            code="TENANT_NOT_FOUND",
        )


class UnauthorizedAccessException(GrowTubeException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, code="UNAUTHORIZED")


class JobNotFoundException(GrowTubeException):
    def __init__(self, job_id: str):
        super().__init__(f"Job '{job_id}' not found", code="JOB_NOT_FOUND")


class InvalidInputException(GrowTubeException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, code="INVALID_INPUT", details=details)


class YouTubeAPIException(GrowTubeException):
    def __init__(self, message: str, details: Any = None):
        super().__init__(message, code="YOUTUBE_API_ERROR", details=details)


class YouTubeQuotaExceededException(YouTubeAPIException):
    def __init__(self, message: str = "YouTube Data API quota exceeded."):
        super().__init__(message, details={"quota_exceeded": True})


class YouTubeResourceNotFoundException(YouTubeAPIException):
    def __init__(self, resource: str):
        super().__init__(f"YouTube resource not found: {resource}", details={"resource": resource})

