"""Data models and schemas for the deterministic verification engine."""
from typing import Literal, Optional
from pydantic import BaseModel, Field
from app.schemas.ai import AIExplanationResponse

FindingCategory = Literal[
    "INDICATION",
    "ALLERGY",
    "THERAPEUTIC_DUPLICATION",
    "DRUG_INTERACTION",
    "DOSAGE",
    "INVENTORY",
]

FindingSeverity = Literal[
    "HIGH",
    "MODERATE",
    "LOW",
    "INFO",
]

FindingStatus = Literal[
    "CONFLICT_DETECTED",
    "REVIEW_REQUIRED",
    "INSUFFICIENT_DATA",
    "CLEAN",
]


class GeneratedFinding(BaseModel):
    """Structured clinical finding emitted by deterministic rule evaluation."""
    rule_identifier: str = Field(..., description="Stable rule identifier")
    category: FindingCategory = Field(..., description="Check category")
    severity: FindingSeverity = Field(..., description="Workflow severity indicator (HIGH, MODERATE, LOW, INFO)")
    status: FindingStatus = Field(..., description="Finding status (CONFLICT_DETECTED, REVIEW_REQUIRED, INSUFFICIENT_DATA, CLEAN)")
    message: str = Field(..., description="Concise explanation of rule evaluation result")
    evidence: str = Field(..., description="Detailed clinical and prescription evidence")
    rule_source: str = Field(..., description="Source citation of demo reference rule")
    human_review_required: bool = Field(..., description="Whether human pharmacist review is required")


class VerificationSummary(BaseModel):
    """Executive summary of deterministic verification output."""
    prescription_id: str
    prescription_number: str
    total_findings: int
    conflicts_count: int
    review_required_count: int
    clean_count: int
    max_severity: FindingSeverity
    requires_human_review: bool
    engine_version: str = "1.0.0-deterministic"
    disclaimer: str = (
        "Advisory deterministic rule engine demonstration. Not clinically validated. "
        "Not for production medical decision-making or real-world medication dispensing."
    )


class VerificationResponse(BaseModel):
    """Full API response for verification endpoint."""
    summary: VerificationSummary
    findings: list[GeneratedFinding]
    ai_explanation: Optional[AIExplanationResponse] = None
