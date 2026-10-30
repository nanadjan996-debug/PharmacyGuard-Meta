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


class PharmacistReviewDetail(BaseModel):
    id: str
    reviewer_id: str
    reviewer_name: str
    reviewer_role: str
    action: str
    override_rationale: Optional[str]
    notes: Optional[str]
    created_at: datetime
    findings_count: int


class EscalationDetail(BaseModel):
    id: str
    prescription_id: str
    escalated_by_id: str
    escalated_by_name: str
    escalation_reason: str
    created_at: datetime
    resolved_by_id: Optional[str]
    resolved_by_name: Optional[str]
    resolution_action: Optional[str]
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime]


class ReviewActionResponse(BaseModel):
    status: str
    prescription_id: str
    prescription_number: str
    action: str
    new_status: str
    review_id: str
    findings_snapshotted: int
    created_at: datetime
    disclaimer: str = (
        "Advisory clinical decision support only. Qualified human pharmacist "
        "remains responsible for clinical review. Acceptance or override does not "
        "constitute clinical proof of drug safety or efficacy."
    )


class EscalationResolutionResponse(BaseModel):
    status: str
    prescription_id: str
    prescription_number: str
    escalation_id: str
    resolution_action: str
    prescription_status: str
    resolved_at: datetime
    resolved_by: str
    disclaimer: str = (
        "Advisory clinical escalation resolution. Qualified human chief pharmacist "
        "remains responsible for clinical oversight. Resolution does not constitute "
        "clinical proof of drug safety or automated dispensing authorization."
    )


class EscalationQueueItemResponse(BaseModel):
    escalation_id: str
    prescription_id: str
    prescription_number: str
    patient_id: str
    patient_name: str
    patient_mrn: str
    prescriber_name: str
    prescriber_department: str
    escalated_by_id: str
    escalated_by_name: str
    escalation_reason: str
    scenario_key: Optional[str]
    created_at: datetime
    findings_count: int
    has_high_severity_finding: bool


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
    reviews: list[PharmacistReviewDetail] = Field(default_factory=list)
    escalations: list[EscalationDetail] = Field(default_factory=list)

