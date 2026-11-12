"""Community Pharmacy Counter Consultation API Endpoints."""
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_any_pharmacist
from app.models.user import User
from app.models.community import (
    CommunityConsultation,
    CommunityConsultationItem,
    CommunityFinding,
    ClinicalRuleMeta,
)
from app.models.audit import AuditEvent
from app.schemas.community import (
    ConsultationCreateRequest,
    ConsultationTransitionRequest,
    CommunityConsultationResponse,
    ConsultationItemResponse,
    CommunityFindingResponse,
)
from app.services.verification.red_flag_engine import RedFlagEngine

router = APIRouter(prefix="/community", tags=["Community Pharmacy Counter Consultation"])


VALID_LIFECYCLE_TRANSITIONS = {
    "DRAFT": ["VERIFICATION_COMPLETED"],
    "VERIFICATION_COMPLETED": ["FINDINGS_REVIEWED"],
    "FINDINGS_REVIEWED": [
        "APPROVED_FOR_DISPENSING",
        "REFERRED",
        "PRESCRIBER_CLARIFICATION_PENDING",
    ],
    "PRESCRIBER_CLARIFICATION_PENDING": ["VERIFICATION_COMPLETED"],
    "APPROVED_FOR_DISPENSING": ["COMPLETED"],
    "REFERRED": ["COMPLETED"],
    "COMPLETED": ["AMENDED"],
    "AMENDED": [],
}


def _serialize_consultation(c: CommunityConsultation) -> CommunityConsultationResponse:
    symptoms = []
    try:
        symptoms = json.loads(c.symptoms_json) if c.symptoms_json else []
    except Exception:
        symptoms = [c.symptoms_json]

    allergies = []
    try:
        allergies = json.loads(c.allergies_json) if c.allergies_json else []
    except Exception:
        allergies = []

    meds = []
    try:
        meds = json.loads(c.current_medications_json) if c.current_medications_json else []
    except Exception:
        meds = []

    items = [
        ConsultationItemResponse(
            id=item.id,
            drug_name=item.drug_name,
            strength=item.strength,
            dosage_form=item.dosage_form,
            dose_amount=item.dose_amount,
            dose_unit=item.dose_unit,
            frequency=item.frequency,
            duration_days=item.duration_days,
            route=item.route,
            instructions=item.instructions,
            legal_category=item.legal_category,
        )
        for item in c.items
    ]

    findings = [
        CommunityFindingResponse(
            id=f.id,
            rule_identifier=f.rule_identifier,
            category=f.category,
            severity=f.severity,
            epistemic_status=getattr(f, "epistemic_status", "CONFIRMED_OBJECTIVE"),
            title=f.title,
            description=f.description,
            action_required=f.action_required,
            is_red_flag=f.is_red_flag,
            requires_referral=f.requires_referral,
        )
        for f in c.findings
    ]

    return CommunityConsultationResponse(
        id=c.id,
        consultation_number=c.consultation_number,
        patient_identifier=c.patient_identifier,
        status=c.status,
        age_years=c.age_years,
        age_months=c.age_months,
        gender=c.gender,
        weight_kg=c.weight_kg,
        temperature_c=c.temperature_c,
        sbp_mmhg=c.sbp_mmhg,
        dbp_mmhg=c.dbp_mmhg,
        heart_rate_bpm=c.heart_rate_bpm,
        respiratory_rate_bpm=c.respiratory_rate_bpm,
        spo2_percent=c.spo2_percent,
        mrdt_status=c.mrdt_status,
        g6pd_status=c.g6pd_status,
        chief_complaint=c.chief_complaint,
        symptoms=symptoms,
        allergies=allergies,
        current_medications=meds,
        referral_triggered=c.referral_triggered,
        referral_urgency=c.referral_urgency,
        referral_reason=c.referral_reason,
        referral_notes=c.referral_notes,
        pharmacist_notes=c.pharmacist_notes,
        dispense_rationale=c.dispense_rationale,
        version=c.version,
        created_at=c.created_at,
        updated_at=c.updated_at,
        items=items,
        findings=findings,
    )


@router.post("/consultations", response_model=CommunityConsultationResponse, status_code=status.HTTP_201_CREATED)
def create_consultation(
    payload: ConsultationCreateRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> CommunityConsultationResponse:
    """Create a structured walk-in counter consultation, evaluate red flags, and set initial state."""
    consultation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    consultation_count = db.query(CommunityConsultation).count() + 1
    consultation_num = f"CC-{now.strftime('%Y%m')}-{consultation_count:04d}"

    # Extract proposed drugs for red flag evaluation
    proposed_med_names = [item.drug_name for item in payload.proposed_items]

    # Run deterministic Red-Flag referral triage engine
    triage_result = RedFlagEngine.evaluate(
        age_years=payload.age_years,
        age_months=payload.age_months,
        gender=payload.gender,
        weight_kg=payload.weight_kg,
        temperature_c=payload.temperature_c,
        sbp_mmhg=payload.sbp_mmhg,
        dbp_mmhg=payload.dbp_mmhg,
        heart_rate_bpm=payload.heart_rate_bpm,
        respiratory_rate_bpm=payload.respiratory_rate_bpm,
        mrdt_status=payload.mrdt_status,
        symptoms=payload.symptoms,
        proposed_medications=proposed_med_names,
    )

    consultation = CommunityConsultation(
        id=consultation_id,
        consultation_number=consultation_num,
        patient_identifier=payload.patient_identifier,
        age_years=payload.age_years,
        age_months=payload.age_months,
        gender=payload.gender,
        weight_kg=payload.weight_kg,
        temperature_c=payload.temperature_c,
        sbp_mmhg=payload.sbp_mmhg,
        dbp_mmhg=payload.dbp_mmhg,
        heart_rate_bpm=payload.heart_rate_bpm,
        respiratory_rate_bpm=payload.respiratory_rate_bpm,
        spo2_percent=payload.spo2_percent,
        mrdt_status=payload.mrdt_status,
        g6pd_status=payload.g6pd_status,
        chief_complaint=payload.chief_complaint,
        symptoms_json=json.dumps(payload.symptoms),
        allergies_json=json.dumps(payload.allergies),
        current_medications_json=json.dumps(payload.current_medications),
        status="VERIFICATION_COMPLETED",  # Immediately verified by deterministic core
        referral_triggered=triage_result.referral_triggered,
        referral_urgency=triage_result.referral_urgency,
        referral_reason=triage_result.referral_reason,
        referral_notes=triage_result.referral_note,
        is_synthetic=True,
        version=1,
    )
    db.add(consultation)

    # Add medication items
    for item in payload.proposed_items:
        c_item = CommunityConsultationItem(
            id=str(uuid.uuid4()),
            consultation_id=consultation_id,
            drug_name=item.drug_name,
            strength=item.strength,
            dosage_form=item.dosage_form,
            dose_amount=item.dose_amount,
            dose_unit=item.dose_unit,
            frequency=item.frequency,
            duration_days=item.duration_days,
            route=item.route,
            instructions=item.instructions,
            legal_category=item.legal_category,
        )
        db.add(c_item)

    # Add findings
    for f in triage_result.findings:
        cf = CommunityFinding(
            id=str(uuid.uuid4()),
            consultation_id=consultation_id,
            rule_identifier=f.rule_identifier,
            category=f.category,
            severity=f.severity,
            epistemic_status=getattr(f, "epistemic_status", "CONFIRMED_OBJECTIVE"),
            title=f.title,
            description=f.description,
            action_required=f.action_required,
            is_red_flag=f.is_red_flag,
            requires_referral=f.requires_referral,
        )
        db.add(cf)

    # Audit logging
    actor_role = ",".join([r.role_id for r in current_user.roles]) if current_user.roles else "pharmacist"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        actor_username=current_user.username,
        actor_role=actor_role,
        action="COMMUNITY_CONSULTATION_CREATED",
        entity_type="CommunityConsultation",
        entity_id=consultation_id,
        details=json.dumps({
            "consultation_number": consultation_num,
            "patient_identifier": payload.patient_identifier,
            "referral_triggered": triage_result.referral_triggered,
            "referral_urgency": triage_result.referral_urgency,
            "finding_count": len(triage_result.findings),
        }),
    )
    db.add(audit)

    db.commit()
    db.refresh(consultation)
    return _serialize_consultation(consultation)


@router.get("/consultations", response_model=list[CommunityConsultationResponse])
def list_consultations(
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[CommunityConsultationResponse]:
    """Retrieve all community counter consultations ordered by recency."""
    consultations = db.query(CommunityConsultation).order_by(CommunityConsultation.created_at.desc()).all()
    return [_serialize_consultation(c) for c in consultations]


@router.get("/consultations/{id}", response_model=CommunityConsultationResponse)
def get_consultation(
    id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> CommunityConsultationResponse:
    """Retrieve full consultation details by ID."""
    consultation = db.query(CommunityConsultation).filter_by(id=id).first()
    if not consultation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")
    return _serialize_consultation(consultation)


@router.post("/consultations/{id}/transition", response_model=CommunityConsultationResponse)
def transition_consultation_lifecycle(
    id: str,
    payload: ConsultationTransitionRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> CommunityConsultationResponse:
    """Transition consultation lifecycle state with strict safety gates.
    
    Safety Invariants:
    1. Only documented state transitions are allowed.
    2. Cannot jump directly from DRAFT to APPROVED_FOR_DISPENSING without FINDINGS_REVIEWED.
    3. Emergency red-flag referrals require explicit pharmacist rationale if overridden.
    4. Post-dispense corrections create AMENDED state with incremented version.
    """
    consultation = db.query(CommunityConsultation).filter_by(id=id).first()
    if not consultation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    allowed_targets = VALID_LIFECYCLE_TRANSITIONS.get(consultation.status, [])
    if payload.target_state not in allowed_targets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Illegal transition: Cannot transition from {consultation.status} to {payload.target_state}. "
                   f"Allowed: {', '.join(allowed_targets) or 'None (terminal state)'}",
        )

    # Safety Gate: Strict Clinical Safety Invariant for Emergency Red-Flag Referrals
    if consultation.referral_triggered and consultation.referral_urgency == "EMERGENCY":
        if payload.target_state in ("APPROVED_FOR_DISPENSING", "DISPENSED"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clinical Safety Invariant: Dispensing cannot be approved for an EMERGENCY red-flag presentation. "
                       "Emergency referral cannot be overridden through the community dispensing workflow. "
                       "A text rationale cannot bypass this safety invariant. "
                       "Patient must be transitioned to REFERRED for mandatory hospital transfer.",
            )

    # For non-emergency referrals, enforce mandatory clinical justification for override
    if payload.target_state == "APPROVED_FOR_DISPENSING":
        if consultation.referral_triggered:
            if not payload.dispense_rationale or len(payload.dispense_rationale.strip()) < 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Clinical Override Prohibited: Dispensing cannot be approved for a flagged referral "
                           "presentation without a mandatory, detailed clinical justification (minimum 10 characters).",
                )

    old_status = consultation.status
    consultation.status = payload.target_state

    if payload.pharmacist_notes:
        consultation.pharmacist_notes = payload.pharmacist_notes
    if payload.dispense_rationale:
        consultation.dispense_rationale = payload.dispense_rationale
    if payload.referral_notes:
        consultation.referral_notes = payload.referral_notes

    # Version increment on amendment
    if payload.target_state == "AMENDED":
        consultation.version += 1

    actor_role = ",".join([r.role_id for r in current_user.roles]) if current_user.roles else "pharmacist"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        actor_username=current_user.username,
        actor_role=actor_role,
        action="COMMUNITY_CONSULTATION_TRANSITIONED",
        entity_type="CommunityConsultation",
        entity_id=consultation.id,
        details=json.dumps({
            "from_status": old_status,
            "to_status": payload.target_state,
            "version": consultation.version,
            "has_rationale": bool(payload.dispense_rationale),
        }),
    )
    db.add(audit)

    db.commit()
    db.refresh(consultation)
    return _serialize_consultation(consultation)


@router.get("/rules", response_model=list[dict])
def list_clinical_rules_meta(
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Retrieve metadata registry of clinical decision rules and faculty governance status."""
    rules = db.query(ClinicalRuleMeta).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "category": r.category,
            "version": r.version,
            "source_reference": r.source_reference,
            "clinical_trigger": r.clinical_trigger,
            "approval_status": r.approval_status,
            "is_active": r.is_active,
        }
        for r in rules
    ]
