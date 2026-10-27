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
    PrescriptionQueueItemResponse,
)

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


@router.post("/{prescription_id}/review")
def review_prescription(
    prescription_id: str,
    review_data: ReviewActionRequest,
    current_user: User = Depends(require_any_pharmacist),
    db: Session = Depends(get_db),
):
    """
    Submit clinical decision on a prescription: ACCEPT, OVERRIDE, or ESCALATE.
    
    Security & Safety Rules:
    1. Accessible ONLY to qualified pharmacists (Staff or Chief). Pharmacy Students are rejected with 403 Forbidden.
    2. High-Priority Override Rule: Overriding a prescription with any HIGH severity finding MANDATES
       a non-empty written clinical rationale. Missing or whitespace-only rationale is rejected with HTTP 422.
    3. All review actions record an append-only audit event with the actor identity and decision.
    """
    rx = db.query(Prescription).filter_by(id=prescription_id).first()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prescription with ID {prescription_id} not found",
        )

    has_high_severity_finding = any(f.severity == "HIGH" for f in rx.findings)

    # Enforce mandatory written rationale for high-priority overrides at the API layer
    if review_data.action == "OVERRIDE" and has_high_severity_finding:
        if not review_data.override_rationale or not review_data.override_rationale.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Override rationale is mandatory when overriding high-priority clinical findings.",
            )

    # Create pharmacist review record
    review = PharmacistReview(
        prescription_id=rx.id,
        reviewer_id=current_user.id,
        action=review_data.action,
        override_rationale=review_data.override_rationale.strip() if review_data.override_rationale else None,
        notes=review_data.notes.strip() if review_data.notes else None,
    )
    db.add(review)

    # Link existing findings to this review
    for f in rx.findings:
        f.review = review

    # Update prescription status
    if review_data.action == "ACCEPT":
        rx.status = "reviewed"
    elif review_data.action == "OVERRIDE":
        rx.status = "overridden"
    elif review_data.action == "ESCALATE":
        rx.status = "escalated"
        escalation = EscalationResolution(
            prescription_id=rx.id,
            escalated_by_id=current_user.id,
            escalation_reason=(
                review_data.notes.strip()
                if review_data.notes
                else "Pharmacist escalated complex prescription for Chief Pharmacist review"
            ),
        )
        db.add(escalation)

    rx.updated_at = datetime.now(timezone.utc)

    # Record append-only audit log entry
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
            "has_high_priority_finding": has_high_severity_finding,
            "override_rationale_provided": bool(review_data.override_rationale),
        }),
    )
    db.add(audit_event)
    db.commit()

    return {
        "status": "success",
        "prescription_id": rx.id,
        "prescription_number": rx.prescription_number,
        "action": review_data.action,
        "new_status": rx.status,
    }
