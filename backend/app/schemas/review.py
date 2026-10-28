"""Pydantic schemas for prescription reviews, overrides, and escalations."""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class ReviewActionRequest(BaseModel):
    action: Literal["ACCEPT", "OVERRIDE", "ESCALATE"] = Field(
        ..., description="Clinical action: ACCEPT, OVERRIDE, or ESCALATE"
    )
    override_rationale: Optional[str] = Field(
        default=None,
        description="Mandatory clinical rationale when overriding high-priority findings.",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Optional clinical review notes.",
    )


class EscalationResolutionRequest(BaseModel):
    resolution_action: Literal[
        "APPROVED_BY_CHIEF",
        "REJECTED_RETURNED_TO_PRESCRIBER",
        "MODIFIED_AND_APPROVED",
    ] = Field(..., description="Chief pharmacist resolution action")
    resolution_notes: str = Field(..., min_length=5, description="Mandatory resolution explanation notes")


class ReviewFindingResponse(BaseModel):
    id: str
    rule_identifier: str
    category: str
    severity: str
    status: str
    evidence: str
    rule_source: str
    human_review_required: bool


class PrescriptionItemDetail(BaseModel):
    id: str
    medication_id: str
    generic_name: str
    brand_name: str
    drug_class: str
    dose_amount: float
    dose_unit: str
    frequency: str
    route: str
    duration_days: int
    quantity_prescribed: int
    instructions: str


class PrescriptionQueueItemResponse(BaseModel):
    id: str
    prescription_number: str
    patient_id: str
    patient_name: str
    patient_mrn: str
    prescriber_name: str
    prescriber_department: str
    status: str
    scenario_key: Optional[str]
    created_at: datetime
    findings_count: int
    has_high_severity_finding: bool


class PrescriptionDetailResponse(BaseModel):
    id: str
    prescription_number: str
    patient_id: str
    patient_name: str
    patient_mrn: str
    patient_dob: str
    patient_gender: str
    patient_weight_kg: float
    patient_height_cm: float
    prescriber_name: str
    prescriber_department: str
    status: str
    scenario_key: Optional[str]
    clinical_notes: Optional[str]
    created_at: datetime
    items: list[PrescriptionItemDetail]
    findings: list[ReviewFindingResponse]

