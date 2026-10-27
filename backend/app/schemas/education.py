"""Pydantic schemas for student educational cases and determinations."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class StudentSubmissionRequest(BaseModel):
    determination: Literal[
        "REJECT",
        "APPROVE_WITH_MONITORING",
        "OVERRIDE_WITH_RATIONALE",
        "ESCALATE",
    ] = Field(..., description="Student clinical determination")
    reasoning: str = Field(..., min_length=10, description="Detailed student clinical reasoning")


class EducationalCaseResponse(BaseModel):
    id: str
    case_code: str
    title: str
    difficulty: str
    category: str
    patient_summary: str
    prescription_summary: str
    clinical_scenario: str


class StudentSubmissionResultResponse(BaseModel):
    submission_id: str
    case_code: str
    submitted_determination: str
    predefined_answer: str
    is_correct: bool
    score_awarded: int
    submitted_reasoning: str
    predefined_explanation: str
    key_learning_points: str
    feedback: str
    submitted_at: datetime
