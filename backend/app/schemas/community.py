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
    medical_history: list[str] = Field(default_factory=list, description="Patient medical history and chronic conditions")
    diagnostic_tests: list[dict[str, Any]] = Field(default_factory=list, description="Point-of-care rapid diagnostic test entries")
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
    medical_history: list[str] = Field(default_factory=list)
    diagnostic_tests: list[dict[str, Any]] = Field(default_factory=list)
    evaluated_rules_count: int = 5
    uncovered_clinical_areas: list[str] = Field(default_factory=list)
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


# -----------------------------------------------------------------------------
# Workflow B: Prescription Scanner & 7-Field Human Confirmation Gate Schemas
# -----------------------------------------------------------------------------

class PrescriptionScanItemResponse(BaseModel):
    id: str
    scan_id: str
    item_index: int
    
    # OCR Extracted Values
    ocr_drug_name: str
    ocr_strength: str | None
    ocr_dosage_form: str | None
    ocr_dose_amount: float | None
    ocr_dose_unit: str | None
    ocr_route: str | None
    ocr_frequency: str | None
    ocr_duration_days: int | None
    
    # Field Confidence Scores
    confidence_drug_name: float
    confidence_strength: float
    confidence_dosage_form: float
    confidence_dose: float
    confidence_route: float
    confidence_frequency: float
    confidence_duration: float
    
    # Confirmed 7 Core Fields
    confirmed_drug_name: str | None
    confirmed_strength: str | None
    confirmed_dosage_form: str | None
    confirmed_dose_amount: float | None
    confirmed_dose_unit: str | None
    confirmed_route: str | None
    confirmed_frequency: str | None
    confirmed_duration_days: int | None
    confirmed_instructions: str | None
    legal_category: str
    is_pharmacist_confirmed: bool
    is_drug_name_confirmed: bool = False
    is_strength_confirmed: bool = False
    is_dosage_form_confirmed: bool = False
    is_dose_confirmed: bool = False
    is_route_confirmed: bool = False
    is_frequency_confirmed: bool = False
    is_duration_confirmed: bool = False
    confirmed_by: str | None = None
    confirmed_at: datetime | None = None


class PrescriptionScanResponse(BaseModel):
    id: str
    scan_number: str
    patient_identifier: str
    patient_name: str | None = None
    patient_age: str | None = None
    prescription_date: str | None = None
    original_filename: str
    content_type: str
    file_size_bytes: int
    image_data_base64: str | None
    extracted_raw_text: str | None
    overall_confidence: float
    low_confidence_flag: bool
    status: str
    pharmacist_confirmed_by: str | None
    pharmacist_confirmed_at: datetime | None
    pharmacist_review_notes: str | None
    is_synthetic: bool
    created_at: datetime
    updated_at: datetime
    items: list[PrescriptionScanItemResponse]


class ItemConfirmPayload(BaseModel):
    item_id: str
    # 1. Drug Name
    confirmed_drug_name: str = Field(..., min_length=2, description="1. Core Clinical Field: Drug Name")
    confirm_drug_name: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Drug Name")

    # 2. Strength
    confirmed_strength: str = Field(..., min_length=1, description="2. Core Clinical Field: Strength")
    confirm_strength: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Strength")

    # 3. Formulation
    confirmed_dosage_form: str = Field(..., min_length=2, description="3. Core Clinical Field: Formulation")
    confirm_dosage_form: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Formulation")

    # 4. Dose Amount
    confirmed_dose_amount: float = Field(..., gt=0, description="4. Core Clinical Field: Dose Amount")
    confirm_dose: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Dose")
    confirmed_dose_unit: str = Field(default="mg")

    # 5. Route
    confirmed_route: str = Field(default="Oral", min_length=2, description="5. Core Clinical Field: Route")
    confirm_route: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Route")

    # 6. Frequency
    confirmed_frequency: str = Field(..., min_length=1, description="6. Core Clinical Field: Frequency")
    confirm_frequency: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Frequency")

    # 7. Duration
    confirmed_duration_days: int = Field(..., ge=1, description="7. Core Clinical Field: Duration")
    confirm_duration: bool = Field(default=False, description="Explicit affirmative pharmacist confirmation for Duration")

    confirmed_instructions: str | None = None
    legal_category: str = "POM"


class PrescriptionConfirmGateRequest(BaseModel):
    items: list[ItemConfirmPayload]
    pharmacist_review_notes: str | None = None


class PrescriptionUploadRequest(BaseModel):
    filename: str = "prescription_slip.jpg"
    content_type: str = "image/jpeg"
    image_base64: str
    patient_identifier: str = "PT-COMM-RX"
    raw_text_override: str | None = None


