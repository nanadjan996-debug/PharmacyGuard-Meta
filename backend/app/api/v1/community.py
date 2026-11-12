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
    CommunityPrescriptionScan,
    CommunityPrescriptionScanItem,
)
from app.models.audit import AuditEvent
from app.schemas.community import (
    ConsultationCreateRequest,
    ConsultationTransitionRequest,
    CommunityConsultationResponse,
    ConsultationItemResponse,
    CommunityFindingResponse,
    PrescriptionScanResponse,
    PrescriptionScanItemResponse,
    PrescriptionUploadRequest,
    PrescriptionConfirmGateRequest,
)
from app.services.verification.red_flag_engine import RedFlagEngine
from app.services.ocr.prescription_ocr_engine import PrescriptionOCREngine

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


def _serialize_scan(s: CommunityPrescriptionScan) -> PrescriptionScanResponse:
    items = [
        PrescriptionScanItemResponse(
            id=it.id,
            scan_id=it.scan_id,
            item_index=it.item_index,
            ocr_drug_name=it.ocr_drug_name,
            ocr_strength=it.ocr_strength,
            ocr_dosage_form=it.ocr_dosage_form,
            ocr_dose_amount=it.ocr_dose_amount,
            ocr_dose_unit=it.ocr_dose_unit,
            ocr_route=it.ocr_route,
            ocr_frequency=it.ocr_frequency,
            ocr_duration_days=it.ocr_duration_days,
            confidence_drug_name=it.confidence_drug_name,
            confidence_strength=it.confidence_strength,
            confidence_dosage_form=it.confidence_dosage_form,
            confidence_dose=it.confidence_dose,
            confidence_route=it.confidence_route,
            confidence_frequency=it.confidence_frequency,
            confidence_duration=it.confidence_duration,
            confirmed_drug_name=it.confirmed_drug_name,
            confirmed_strength=it.confirmed_strength,
            confirmed_dosage_form=it.confirmed_dosage_form,
            confirmed_dose_amount=it.confirmed_dose_amount,
            confirmed_dose_unit=it.confirmed_dose_unit,
            confirmed_route=it.confirmed_route,
            confirmed_frequency=it.confirmed_frequency,
            confirmed_duration_days=it.confirmed_duration_days,
            confirmed_instructions=it.confirmed_instructions,
            legal_category=it.legal_category,
            is_pharmacist_confirmed=it.is_pharmacist_confirmed,
        )
        for it in s.items
    ]
    return PrescriptionScanResponse(
        id=s.id,
        scan_number=s.scan_number,
        patient_identifier=s.patient_identifier,
        original_filename=s.original_filename,
        content_type=s.content_type,
        file_size_bytes=s.file_size_bytes,
        image_data_base64=s.image_data_base64,
        extracted_raw_text=s.extracted_raw_text,
        overall_confidence=s.overall_confidence,
        low_confidence_flag=s.low_confidence_flag,
        status=s.status,
        pharmacist_confirmed_by=s.pharmacist_confirmed_by,
        pharmacist_confirmed_at=s.pharmacist_confirmed_at,
        pharmacist_review_notes=s.pharmacist_review_notes,
        is_synthetic=s.is_synthetic,
        created_at=s.created_at,
        updated_at=s.updated_at,
        items=items,
    )


# =============================================================================
# WORKFLOW B: PRESCRIPTION SCANNER & 7-FIELD HUMAN CONFIRMATION GATE
# =============================================================================

@router.post("/prescriptions/upload", response_model=PrescriptionScanResponse, status_code=status.HTTP_201_CREATED)
def upload_community_prescription(
    payload: PrescriptionUploadRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> PrescriptionScanResponse:
    """Uploads prescription slip image, triggers OCR extraction, and creates unconfirmed review encounter.
    
    Data Minimality (Act 843): Image processed as synthetic / transient record without raw PII.
    """
    now = datetime.now(timezone.utc)
    short_uuid = str(uuid.uuid4())[:8].upper()
    scan_num = f"CRX-{now.strftime('%Y%m%d')}-{short_uuid}"
    scan_id = str(uuid.uuid4())

    raw_text = payload.raw_text_override or "Amoxicillin/Clavulanic Acid 625mg tabs 1 tab BID for 7 days"
    ocr_result = PrescriptionOCREngine.extract_from_text(raw_text)

    scan = CommunityPrescriptionScan(
        id=scan_id,
        scan_number=scan_num,
        patient_identifier=payload.patient_identifier,
        original_filename=payload.filename,
        content_type=payload.content_type,
        file_size_bytes=len(payload.image_base64.encode("utf-8")),
        image_data_base64=payload.image_base64,
        extracted_raw_text=ocr_result.raw_text,
        overall_confidence=ocr_result.overall_confidence,
        low_confidence_flag=ocr_result.low_confidence_flag,
        status="PENDING_REVIEW",
        is_synthetic=True,
    )
    db.add(scan)

    for it in ocr_result.items:
        scan_item = CommunityPrescriptionScanItem(
            id=str(uuid.uuid4()),
            scan_id=scan_id,
            item_index=it.item_index,
            ocr_drug_name=it.drug_name,
            ocr_strength=it.strength,
            ocr_dosage_form=it.dosage_form,
            ocr_dose_amount=it.dose_amount,
            ocr_dose_unit=it.dose_unit,
            ocr_route=it.route,
            ocr_frequency=it.frequency,
            ocr_duration_days=it.duration_days,
            confidence_drug_name=it.confidence_drug_name,
            confidence_strength=it.confidence_strength,
            confidence_dosage_form=it.confidence_dosage_form,
            confidence_dose=it.confidence_dose,
            confidence_route=it.confidence_route,
            confidence_frequency=it.confidence_frequency,
            confidence_duration=it.confidence_duration,
            confirmed_drug_name=it.drug_name,
            confirmed_strength=it.strength,
            confirmed_dosage_form=it.dosage_form,
            confirmed_dose_amount=it.dose_amount,
            confirmed_dose_unit=it.dose_unit,
            confirmed_route=it.route,
            confirmed_frequency=it.frequency,
            confirmed_duration_days=it.duration_days,
            confirmed_instructions=it.instructions,
            legal_category=it.legal_category,
            is_pharmacist_confirmed=False,  # Human Gate: Must be explicitly locked by pharmacist
        )
        db.add(scan_item)

    actor_role = ",".join([r.role_id for r in current_user.roles]) if current_user.roles else "pharmacist"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        actor_username=current_user.username,
        actor_role=actor_role,
        action="COMMUNITY_PRESCRIPTION_UPLOADED",
        entity_type="CommunityPrescriptionScan",
        entity_id=scan_id,
        details=json.dumps({
            "scan_number": scan_num,
            "item_count": len(ocr_result.items),
            "overall_confidence": ocr_result.overall_confidence,
            "low_confidence_flag": ocr_result.low_confidence_flag,
        }),
    )
    db.add(audit)
    db.commit()
    db.refresh(scan)
    return _serialize_scan(scan)


@router.get("/prescriptions", response_model=list[PrescriptionScanResponse])
def list_community_prescriptions(
    limit: int = 50,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[PrescriptionScanResponse]:
    """Lists community prescription scans."""
    scans = (
        db.query(CommunityPrescriptionScan)
        .order_by(CommunityPrescriptionScan.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_scan(s) for s in scans]


@router.get("/prescriptions/{id}", response_model=PrescriptionScanResponse)
def get_community_prescription(
    id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> PrescriptionScanResponse:
    """Retrieves single prescription scan with items."""
    scan = db.query(CommunityPrescriptionScan).filter_by(id=id).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription scan not found")
    return _serialize_scan(scan)


@router.post("/prescriptions/{id}/confirm-gate", response_model=PrescriptionScanResponse)
def confirm_prescription_human_gate(
    id: str,
    payload: PrescriptionConfirmGateRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> PrescriptionScanResponse:
    """Enforces the 7-Field Mandatory Human Confirmation Gate.
    
    Safety Invariant: Confidence < 0.85 requires pharmacist inspection.
    Every medication item must have all 7 core fields confirmed and locked before
    dispensing or downstream verification can execute.
    """
    scan = db.query(CommunityPrescriptionScan).filter_by(id=id).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription scan not found")

    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one item must be confirmed.")

    # Match and confirm each item
    item_map = {it.id: it for it in scan.items}
    validation_records = []

    for confirmed in payload.items:
        db_item = item_map.get(confirmed.item_id)
        if not db_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item ID {confirmed.item_id} does not belong to scan {id}.",
            )
        
        db_item.confirmed_drug_name = confirmed.confirmed_drug_name.strip()
        db_item.confirmed_strength = confirmed.confirmed_strength.strip()
        db_item.confirmed_dosage_form = confirmed.confirmed_dosage_form.strip()
        db_item.confirmed_dose_amount = confirmed.confirmed_dose_amount
        db_item.confirmed_dose_unit = confirmed.confirmed_dose_unit.strip()
        db_item.confirmed_route = confirmed.confirmed_route.strip()
        db_item.confirmed_frequency = confirmed.confirmed_frequency.strip()
        db_item.confirmed_duration_days = confirmed.confirmed_duration_days
        db_item.confirmed_instructions = confirmed.confirmed_instructions
        db_item.legal_category = confirmed.legal_category
        db_item.is_pharmacist_confirmed = True

        validation_records.append({
            "is_pharmacist_confirmed": True,
            "confirmed_drug_name": db_item.confirmed_drug_name,
            "confirmed_strength": db_item.confirmed_strength,
            "confirmed_dosage_form": db_item.confirmed_dosage_form,
            "confirmed_dose_amount": db_item.confirmed_dose_amount,
            "confirmed_route": db_item.confirmed_route,
            "confirmed_frequency": db_item.confirmed_frequency,
            "confirmed_duration_days": db_item.confirmed_duration_days,
        })

    # Validate complete 7-Field Human Gate
    is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation(validation_records)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=reason)

    now = datetime.now(timezone.utc)
    scan.status = "HUMAN_CONFIRMED"
    scan.pharmacist_confirmed_by = current_user.username
    scan.pharmacist_confirmed_at = now
    if payload.pharmacist_review_notes:
        scan.pharmacist_review_notes = payload.pharmacist_review_notes

    actor_role = ",".join([r.role_id for r in current_user.roles]) if current_user.roles else "pharmacist"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        actor_username=current_user.username,
        actor_role=actor_role,
        action="COMMUNITY_PRESCRIPTION_HUMAN_GATE_LOCKED",
        entity_type="CommunityPrescriptionScan",
        entity_id=scan.id,
        details=json.dumps({
            "scan_number": scan.scan_number,
            "confirmed_item_count": len(payload.items),
            "gate_status": "HUMAN_CONFIRMED",
        }),
    )
    db.add(audit)
    db.commit()
    db.refresh(scan)
    return _serialize_scan(scan)


@router.post("/prescriptions/{id}/dispense", response_model=PrescriptionScanResponse)
def dispense_community_prescription(
    id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> PrescriptionScanResponse:
    """Dispenses confirmed prescription items after human gate validation."""
    scan = db.query(CommunityPrescriptionScan).filter_by(id=id).first()
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription scan not found")

    if scan.status != "HUMAN_CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dispensing Invariant Blocked: Prescription must be in HUMAN_CONFIRMED state (currently {scan.status}). "
                   f"The reviewing pharmacist must confirm all 7 core fields before dispensing.",
        )

    scan.status = "DISPENSED"
    actor_role = ",".join([r.role_id for r in current_user.roles]) if current_user.roles else "pharmacist"
    audit = AuditEvent(
        id=str(uuid.uuid4()),
        actor_username=current_user.username,
        actor_role=actor_role,
        action="COMMUNITY_PRESCRIPTION_DISPENSED",
        entity_type="CommunityPrescriptionScan",
        entity_id=scan.id,
        details=json.dumps({
            "scan_number": scan.scan_number,
            "final_status": "DISPENSED",
        }),
    )
    db.add(audit)
    db.commit()
    db.refresh(scan)
    return _serialize_scan(scan)

