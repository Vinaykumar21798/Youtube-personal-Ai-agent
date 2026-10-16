import pytest
from pydantic import ValidationError

from app.modules.data_ingestion.schemas import AnalysisSubmission
from app.modules.identity.schemas import UserCreate


def test_analysis_submission_validation():
    # Valid submission
    sub = AnalysisSubmission(input_target="https://youtube.com/@alexbuildsai")
    assert sub.input_target == "https://youtube.com/@alexbuildsai"

    # Blank submission fails
    with pytest.raises(ValidationError):
        AnalysisSubmission(input_target="   ")


def test_user_create_validation():
    # Valid user create
    u = UserCreate(email="test@example.com", password="password123", full_name="Tester")
    assert u.email == "test@example.com"

    # Short password fails
    with pytest.raises(ValidationError):
        UserCreate(email="test@example.com", password="short", full_name="Tester")
