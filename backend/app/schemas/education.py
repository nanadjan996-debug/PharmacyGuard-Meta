"""Pydantic v2 schemas for the Educational Simulation Subsystem."""
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


EDUCATIONAL_DISCLAIMER = (
    "Advisory educational simulation prototype. Synthetic training benchmark only; "
    "not for clinical decision-making or autonomous patient care."
)

CaseDifficulty = Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]
StudentDetermination = Literal[
    "APPROVE",
    "REJECT",
    "APPROVE_WITH_MONITORING",
    "OVERRIDE_WITH_RATIONALE",
    "ESCALATE",
]


class EducationalCaseListItem(BaseModel):
    """Educational case metadata for student browsing (answer keys and criteria stripped)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_code: str
    title: str
    difficulty: str
    category: str
    learning_objectives: list[str] = Field(default_factory=list)
    completion_status: str = Field(description="'COMPLETED' or 'NOT_ATTEMPTED'")
    is_completed: bool = False
    attempts_count: int = 0
    best_score: Optional[int] = None
    disclaimer: str = EDUCATIONAL_DISCLAIMER


class EducationalCaseDetailResponse(BaseModel):
    """Detailed case information for student assessment (hidden answer criteria strictly excluded)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_code: str
    title: str
    difficulty: str
    category: str
    patient_summary: str
    prescription_summary: str
    clinical_scenario: str
    learning_objectives: list[str] = Field(default_factory=list)
    available_determinations: list[str] = Field(
        default_factory=lambda: [
            "APPROVE",
            "REJECT",
            "APPROVE_WITH_MONITORING",
            "OVERRIDE_WITH_RATIONALE",
            "ESCALATE",
        ]
    )
    is_completed: bool = False
    attempts_count: int = 0
    disclaimer: str = EDUCATIONAL_DISCLAIMER


class StudentSubmissionRequest(BaseModel):
    """Structured assessment submission from a pharmacy student."""
    determination: str = Field(
        description="Clinical review determination (e.g., REJECT, ESCALATE, APPROVE, OVERRIDE_WITH_RATIONALE)"
    )
    reasoning: str = Field(
        min_length=10,
        description="Clinical rationale documenting findings, contraindications, or monitoring requirements",
    )
    identified_issues: list[str] = Field(
        default_factory=list,
        description="Optional list of clinical issue categories identified (e.g., ALLERGY_CROSS_REACTIVITY, DUPLICATE_THERAPY)",
    )

    @field_validator("determination")
    @classmethod
    def validate_determination(cls, v: str) -> str:
        cleaned = v.strip().upper()
        valid = {
            "APPROVE",
            "REJECT",
            "APPROVE_WITH_MONITORING",
            "OVERRIDE_WITH_RATIONALE",
            "ESCALATE",
        }
        if cleaned not in valid:
            raise ValueError(f"Invalid determination '{v}'. Must be one of: {', '.join(sorted(valid))}")
        return cleaned

    @field_validator("reasoning")
    @classmethod
    def validate_reasoning(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 10:
            raise ValueError("Clinical reasoning must contain at least 10 non-whitespace characters.")
        return trimmed


class ReferenceRuleFeedback(BaseModel):
    """Feedback linking educational findings to configured demonstration rules."""
    rule_identifier: str
    rule_name: str
    category: str
    severity: str
    description: str
    clinical_evidence: str


class DetailedFeedback(BaseModel):
    """Comprehensive evaluation breakdown and pedagogical feedback."""
    determination_status: str = Field(
        default="PREFERRED",
        description="'PREFERRED', 'ACCEPTABLE_ALTERNATIVE', or 'UNSUPPORTED'",
    )
    preferred_determination: str
    acceptable_alternatives: list[str] = Field(default_factory=list)
    determination_correct: bool
    determination_feedback: str
    expected_determination: str
    determination_score: int
    expected_rules: list[ReferenceRuleFeedback] = Field(default_factory=list)
    correctly_identified_issues: list[str] = Field(default_factory=list)
    missed_issues: list[str] = Field(default_factory=list)
    unconfirmed_issues: list[str] = Field(default_factory=list)
    issue_identification_score: int
    correctly_identified_reasoning_elements: list[str] = Field(default_factory=list)
    missed_reasoning_elements: list[str] = Field(default_factory=list)
    reasoning_feedback: str
    reasoning_score: int
    total_score: int
    is_correct: bool
    clinical_rationale: str
    key_learning_points: list[str] = Field(default_factory=list)
    educational_limitations: str
    disclaimer: str = EDUCATIONAL_DISCLAIMER


class StudentSubmissionResponse(BaseModel):
    """Complete submission record returned immediately after evaluation or on detail lookup."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    case_code: str
    case_title: str
    student_id: str
    student_name: str
    submitted_determination: str
    submitted_reasoning: str
    is_correct: bool
    score_awarded: int
    predefined_explanation: Optional[str] = None
    feedback: DetailedFeedback
    submitted_at: datetime
    attempt_number: int
    disclaimer: str = EDUCATIONAL_DISCLAIMER


class StudentSubmissionListItem(BaseModel):
    """Summary item for student submission history listing."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: str
    case_code: str
    case_title: str
    difficulty: str
    category: str
    submitted_determination: str
    is_correct: bool
    score_awarded: int
    submitted_at: datetime
    attempt_number: int
