"""Pydantic schemas for community counter consultations."""
from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class EpistemicStatus(str, Enum):
    """5-State Clinical Epistemic Model (Specification v3.1.1-MASTER Deliverable 1).
    
    Clinical Uncertainty Invariant: Missing data is NEVER an assumed negative.
    """
    CONFIRMED_OBJECTIVE = "CONFIRMED_OBJECTIVE"
    REPORTED_UNVERIFIED = "REPORTED_UNVERIFIED"
    PATIENT_UNKNOWN = "PATIENT_UNKNOWN"
    NOT_COLLECTED = "NOT_COLLECTED"
    CLINICALLY_IRRELEVANT = "CLINICALLY_IRRELEVANT"


class ConsultationItemCreate(BaseModel):
    drug_name: str
    strength: str
    dosage_form: str
    dose_amount: float
    dose_unit: str = "mg"
    frequency: str
    duration_days: int = 3
    route: str = "Oral"
    instructions: str | None = None
    legal_category: str = "OTC"


class ConsultationItemResponse(BaseModel):
    id: str
    drug_name: str
    strength: str
    dosage_form: str
    dose_amount: float
    dose_unit: str
    frequency: str
    duration_days: int
    route: str
    instructions: str | None
    legal_category: str


class CommunityFindingResponse(BaseModel):
    id: str
    rule_identifier: str
    category: str
    severity: str
    epistemic_status: str = "CONFIRMED_OBJECTIVE"
    title: str
    description: str
    action_required: str
    is_red_flag: bool
    requires_referral: bool


class ConsultationCreateRequest(BaseModel):
    patient_identifier: str = Field(default="PT-WALK-IN", description="De-identified synthetic patient code")
    age_years: int | None = None
    age_months: int | None = None
    gender: str | None = None
    weight_kg: float | None = None
    
    # Vitals
    temperature_c: float | None = None
    sbp_mmhg: int | None = None
    dbp_mmhg: int | None = None
    heart_rate_bpm: int | None = None
    respiratory_rate_bpm: int | None = None
    spo2_percent: float | None = None
    
    # 5-state epistemic model & diagnostics
    mrdt_status: str = Field(default="NOT_DONE", description="CONFIRMED_POSITIVE, CONFIRMED_NEGATIVE, TESTING_UNAVAILABLE, NOT_DONE")
    g6pd_status: str = Field(default="NOT_COLLECTED", description="CONFIRMED_DEFICIENT, CONFIRMED_NORMAL, REPORTED_UNKNOWN, NOT_TESTED, NOT_COLLECTED")
    
    chief_complaint: str
    symptoms: list[str] = Field(default_factory=list)
    allergies: list[dict[str, Any]] = Field(default_factory=list)
    current_medications: list[str] = Field(default_factory=list)
    proposed_items: list[ConsultationItemCreate] = Field(default_factory=list)


class ConsultationTransitionRequest(BaseModel):
    target_state: str = Field(
        ...,
        description="VERIFICATION_COMPLETED, FINDINGS_REVIEWED, PRESCRIBER_CLARIFICATION_PENDING, REFERRED, APPROVED_FOR_DISPENSING, COMPLETED, AMENDED",
    )
    pharmacist_notes: str | None = None
    dispense_rationale: str | None = None
    referral_notes: str | None = None


class CommunityConsultationResponse(BaseModel):
    id: str
    consultation_number: str
    patient_identifier: str
    status: str
    age_years: int | None
    age_months: int | None
    gender: str | None
    weight_kg: float | None
    temperature_c: float | None
    sbp_mmhg: int | None
    dbp_mmhg: int | None
    heart_rate_bpm: int | None
    respiratory_rate_bpm: int | None
    spo2_percent: float | None
    mrdt_status: str
    g6pd_status: str
    chief_complaint: str
    symptoms: list[str]
    allergies: list[dict[str, Any]]
    current_medications: list[str]
    referral_triggered: bool
    referral_urgency: str | None
    referral_reason: str | None
    referral_notes: str | None
    pharmacist_notes: str | None
    dispense_rationale: str | None
    version: int
    created_at: datetime
    updated_at: datetime
    items: list[ConsultationItemResponse]
    findings: list[CommunityFindingResponse]

