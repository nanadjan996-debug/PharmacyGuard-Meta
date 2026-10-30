"""Prescription queue and clinical review API endpoints protected by pharmacist role guards."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_any_pharmacist
from app.models.user import User
from app.models.prescription import Prescription
from app.models.review import PharmacistReview, ReviewFinding, EscalationResolution
from app.models.audit import AuditEvent
from app.schemas.review import (
    ReviewActionRequest,
    ReviewActionResponse,
    PrescriptionQueueItemResponse,
    PrescriptionDetailResponse,
    PrescriptionItemDetail,
    ReviewFindingResponse,
    PharmacistReviewDetail,
    EscalationDetail,
)
from app.services.verification import VerificationEngine, VerificationResponse

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions & Verification Queue"])



@router.get("/queue", response_model=list[PrescriptionQueueItemResponse])
def get_verification_queue(
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[PrescriptionQueueItemResponse]:
    """
    Retrieve hospital prescription verification queue.
    Strictly protected: accessible ONLY to Staff Pharmacists and Chief Pharmacists.
    Students and unauthenticated callers are rejected with 401 or 403.
    """
    prescriptions = db.query(Prescription).order_by(Prescription.created_at.desc()).all()
    response_items = []
    for rx in prescriptions:
        has_high_sev = any(f.severity == "HIGH" for f in rx.findings)
        response_items.append(
            PrescriptionQueueItemResponse(
                id=rx.id,
                prescription_number=rx.prescription_number,
                patient_id=rx.patient_id,
                patient_name=f"{rx.patient.first_name} {rx.patient.last_name}",
                patient_mrn=rx.patient.mrn,
                prescriber_name=rx.prescriber_name,
                prescriber_department=rx.prescriber_department,
                status=rx.status,
                scenario_key=rx.scenario_key,
                created_at=rx.created_at,
                findings_count=len(rx.findings),
                has_high_severity_finding=has_high_sev,
            )
        )
    return response_items


@router.post("/{prescription_id}/review", response_model=ReviewActionResponse)
def review_prescription(
    prescription_id: str,
    review_data: ReviewActionRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> ReviewActionResponse:
    """
    Submit clinical decision on a prescription: ACCEPT, OVERRIDE, or ESCALATE.
    
    Security & Safety Rules:
    1. Accessible ONLY to qualified pharmacists (Staff or Chief). Pharmacy Students are rejected with 403 Forbidden.
    2. Workflow Status Validation: Can only review prescriptions in 'pending' status. If already 'escalated',
       'reviewed', 'overridden', or 'resolved', the request is rejected with HTTP 409 Conflict.
    3. High-Priority Override Rule: Overriding a prescription with any HIGH severity finding MANDATES
       a non-empty written clinical rationale (after trimming whitespace). Missing/blank rationale is rejected with HTTP 422.
    4. Findings Derived from Database: Findings are derived strictly from trusted database records, never client input.
    5. Snapshotting: Current unreviewed findings are permanently linked to this review decision.
    6. All review actions record an append-only audit event with actor identity, action, and decision metadata.
    7. Transactional atomicity: Rolled back cleanly if any database error occurs.
    """
    rx = db.query(Prescription).filter_by(id=prescription_id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription with ID {prescription_id} not found",
        )

    # 1. Enforce explicit workflow state transitions
    if rx.status == "escalated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Prescription {rx.prescription_number} is currently escalated and awaiting "
                f"Chief Pharmacist resolution. Review actions cannot be performed directly."
            ),
        )
    elif rx.status in ("reviewed", "overridden", "resolved"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Prescription {rx.prescription_number} has already been finalized with "
                f"status '{rx.status}' and cannot be reviewed again."
            ),
        )
    elif rx.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid prescription status '{rx.status}' for review action.",
        )

    try:
        # 2. Derive findings strictly from trusted database records
        unreviewed_findings = [f for f in rx.findings if f.review_id is None]
        if not unreviewed_findings:
            # If no active unreviewed findings exist, execute deterministic verification
            engine = VerificationEngine(db)
            engine.verify(rx.id, persist=True)
            # Reload unreviewed findings from session
            unreviewed_findings = [f for f in rx.findings if f.review_id is None]

        has_high_severity_finding = any(f.severity == "HIGH" for f in unreviewed_findings)

        # 3. Enforce mandatory written rationale for high-priority approvals and overrides
        # Any action that effectively approves or accepts a prescription with an active HIGH-severity
        # finding requires a non-empty, trimmed clinical rationale in override_rationale.
        trimmed_rationale = (
            review_data.override_rationale.strip()
            if review_data.override_rationale
            else None
        )
        trimmed_notes = review_data.notes.strip() if review_data.notes else None

        if has_high_severity_finding and review_data.action in ("ACCEPT", "OVERRIDE"):
            if not trimmed_rationale:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Override rationale is mandatory when accepting or overriding a prescription with high-priority clinical findings.",
                )

        # 4. Create pharmacist review record
        review = PharmacistReview(
            prescription_id=rx.id,
            reviewer_id=current_user.id,
            action=review_data.action,
            override_rationale=trimmed_rationale if (review_data.action == "OVERRIDE" or has_high_severity_finding) else None,
            notes=trimmed_notes,
        )
        db.add(review)
        db.flush()  # populate review.id

        # 5. Snapshot unreviewed findings to this review record
        for f in unreviewed_findings:
            f.review_id = review.id

        # 6. Determine target prescription status and create escalation if applicable
        if review_data.action == "ACCEPT":
            target_status = "reviewed"
        elif review_data.action == "OVERRIDE":
            target_status = "overridden"
        elif review_data.action == "ESCALATE":
            target_status = "escalated"
            escalation = EscalationResolution(
                prescription_id=rx.id,
                escalated_by_id=current_user.id,
                escalation_reason=(
                    trimmed_notes
                    if trimmed_notes
                    else "Pharmacist escalated complex prescription for Chief Pharmacist review"
                ),
            )
            db.add(escalation)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown review action: {review_data.action}",
            )

        now = datetime.now(timezone.utc)
        # Atomic conditional update of prescription status:
        # Guarantees that only a prescription currently in 'pending' status can be transitioned.
        # Concurrent attempts on an already transitioned prescription are rejected with 409 Conflict.
        rx_updated = (
            db.query(Prescription)
            .filter(
                Prescription.id == rx.id,
                Prescription.status == "pending",
            )
            .update(
                {
                    "status": target_status,
                    "updated_at": now,
                },
                synchronize_session="fetch",
            )
        )
        if rx_updated == 0:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Conflict: Prescription {rx.prescription_number} is no longer in 'pending' status "
                    f"and was already reviewed or transitioned concurrently."
                ),
            )

        # 7. Record append-only audit log entry
        user_roles = [ur.role_id for ur in current_user.roles]
        audit_event = AuditEvent(
            actor_id=current_user.id,
            actor_username=current_user.username,
            actor_role=",".join(user_roles),
            action=f"REVIEW_{review_data.action}",
            entity_type="Prescription",
            entity_id=rx.id,
            details=json.dumps({
                "prescription_number": rx.prescription_number,
                "action": review_data.action,
                "review_id": review.id,
                "has_high_priority_finding": has_high_severity_finding,
                "override_rationale_provided": bool(trimmed_rationale),
                "findings_snapshotted": len(unreviewed_findings),
                "new_status": target_status,
            }),
        )
        db.add(audit_event)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database transaction failed during review submission: {str(exc)}",
        )

    return ReviewActionResponse(
        status="success",
        prescription_id=rx.id,
        prescription_number=rx.prescription_number,
        action=review_data.action,
        new_status=target_status,
        review_id=review.id,
        findings_snapshotted=len(unreviewed_findings),
        created_at=review.created_at,
    )


@router.get("/{prescription_id}", response_model=PrescriptionDetailResponse)
def get_prescription_detail(
    prescription_id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> PrescriptionDetailResponse:
    """
    Retrieve complete prescription record including patient demographics,
    ordered medication items, clinical findings, reviews, and escalations.
    """
    rx = db.query(Prescription).filter_by(id=prescription_id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription with ID {prescription_id} not found",
        )

    patient = rx.patient
    items_detail = [
        PrescriptionItemDetail(
            id=item.id,
            medication_id=item.medication_id,
            generic_name=item.medication.generic_name,
            brand_name=item.medication.brand_name,
            drug_class=item.medication.drug_class,
            dose_amount=item.dose_amount,
            dose_unit=item.dose_unit,
            frequency=item.frequency,
            route=item.route,
            duration_days=item.duration_days,
            quantity_prescribed=item.quantity_prescribed,
            instructions=item.instructions,
        )
        for item in rx.items
    ]

    findings_detail = [
        ReviewFindingResponse(
            id=f.id,
            rule_identifier=f.rule_identifier,
            category=f.category,
            severity=f.severity,
            status=f.status,
            evidence=f.evidence,
            rule_source=f.rule_source,
            human_review_required=f.human_review_required,
        )
        for f in rx.findings
    ]

    reviews_detail = []
    for rev in sorted(rx.reviews, key=lambda r: r.created_at, reverse=True):
        rev_roles = [ur.role_id for ur in rev.reviewer.roles]
        reviews_detail.append(
            PharmacistReviewDetail(
                id=rev.id,
                reviewer_id=rev.reviewer_id,
                reviewer_name=rev.reviewer.full_name,
                reviewer_role=",".join(rev_roles),
                action=rev.action,
                override_rationale=rev.override_rationale,
                notes=rev.notes,
                created_at=rev.created_at,
                findings_count=len(rev.findings),
            )
        )

    escalations_detail = []
    for esc in sorted(rx.escalations, key=lambda e: e.created_at, reverse=True):
        escalations_detail.append(
            EscalationDetail(
                id=esc.id,
                prescription_id=esc.prescription_id,
                escalated_by_id=esc.escalated_by_id,
                escalated_by_name=esc.escalated_by.full_name,
                escalation_reason=esc.escalation_reason,
                created_at=esc.created_at,
                resolved_by_id=esc.resolved_by_id,
                resolved_by_name=esc.resolved_by.full_name if esc.resolved_by else None,
                resolution_action=esc.resolution_action,
                resolution_notes=esc.resolution_notes,
                resolved_at=esc.resolved_at,
            )
        )

    return PrescriptionDetailResponse(
        id=rx.id,
        prescription_number=rx.prescription_number,
        patient_id=rx.patient_id,
        patient_name=f"{patient.first_name} {patient.last_name}",
        patient_mrn=patient.mrn,
        patient_dob=patient.date_of_birth.isoformat(),
        patient_gender=patient.gender,
        patient_weight_kg=patient.weight_kg,
        patient_height_cm=patient.height_cm,
        prescriber_name=rx.prescriber_name,
        prescriber_department=rx.prescriber_department,
        status=rx.status,
        scenario_key=rx.scenario_key,
        clinical_notes=rx.clinical_notes,
        created_at=rx.created_at,
        items=items_detail,
        findings=findings_detail,
        reviews=reviews_detail,
        escalations=escalations_detail,
    )


@router.get("/{prescription_id}/reviews", response_model=list[PharmacistReviewDetail])
def get_prescription_reviews(
    prescription_id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> list[PharmacistReviewDetail]:
    """
    Retrieve audit history of all pharmacist reviews and decisions for this prescription.
    """
    rx = db.query(Prescription).filter_by(id=prescription_id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription with ID {prescription_id} not found",
        )

    reviews_detail = []
    for rev in sorted(rx.reviews, key=lambda r: r.created_at, reverse=True):
        rev_roles = [ur.role_id for ur in rev.reviewer.roles]
        reviews_detail.append(
            PharmacistReviewDetail(
                id=rev.id,
                reviewer_id=rev.reviewer_id,
                reviewer_name=rev.reviewer.full_name,
                reviewer_role=",".join(rev_roles),
                action=rev.action,
                override_rationale=rev.override_rationale,
                notes=rev.notes,
                created_at=rev.created_at,
                findings_count=len(rev.findings),
            )
        )
    return reviews_detail


@router.post("/{prescription_id}/verify", response_model=VerificationResponse)
def verify_prescription(
    prescription_id: str,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
) -> VerificationResponse:
    """
    Trigger deterministic rule-based verification on a stored prescription.
    
    Security & Operational Constraints:
    - Strictly protected: accessible ONLY to Staff Pharmacists and Chief Pharmacists.
    - Evaluates stored prescription against local synthetic reference rules.
    - Deterministic output: running multiple times produces identical, stably sorted findings.
    - Persists unreviewed findings (review_id=None), never overwriting historical pharmacist review findings.
    - Does NOT alter prescription workflow status or create review records.
    - Appends an audit event recording the verification execution.
    """
    rx = db.query(Prescription).filter_by(id=prescription_id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription with ID {prescription_id} not found",
        )

    engine = VerificationEngine(db)
    try:
        response = engine.verify(prescription_id=prescription_id, persist=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Verification engine failure: {str(exc)}",
        )

    # Record append-only audit event
    user_roles = [ur.role_id for ur in current_user.roles]
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role=",".join(user_roles),
        action="PRESCRIPTION_VERIFIED",
        entity_type="Prescription",
        entity_id=rx.id,
        details=json.dumps({
            "prescription_number": rx.prescription_number,
            "total_findings": response.summary.total_findings,
            "conflicts_count": response.summary.conflicts_count,
            "review_required_count": response.summary.review_required_count,
            "max_severity": response.summary.max_severity,
            "requires_human_review": response.summary.requires_human_review,
        }),
    )
    db.add(audit_event)
    db.commit()

    return response

