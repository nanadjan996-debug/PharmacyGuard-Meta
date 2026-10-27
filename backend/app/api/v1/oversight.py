"""Chief Pharmacist oversight endpoints: escalations, override ledger, inventory adjustments, and audit log."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_chief_pharmacist
from app.models.user import User
from app.models.prescription import Prescription
from app.models.review import PharmacistReview, EscalationResolution
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.audit import AuditEvent
from app.schemas.review import EscalationResolutionRequest
from app.schemas.inventory import InventoryAdjustmentRequest

router = APIRouter(prefix="/oversight", tags=["Chief Pharmacist Oversight"])


@router.get("/escalations")
def get_escalated_cases(
    current_user: User = Depends(require_chief_pharmacist),
    db: Session = Depends(get_db),
):
    """
    Retrieve all escalated prescriptions awaiting Chief Pharmacist resolution.
    Strictly protected: Chief Pharmacist ONLY. Staff Pharmacists and Students receive 403 Forbidden.
    """
    escalations = (
        db.query(EscalationResolution)
        .filter(EscalationResolution.resolved_at.is_(None))
        .order_by(EscalationResolution.created_at.asc())
        .all()
    )
    results = []
    for esc in escalations:
        rx = esc.prescription
        results.append({
            "escalation_id": esc.id,
            "prescription_id": rx.id,
            "prescription_number": rx.prescription_number,
            "patient_name": f"{rx.patient.first_name} {rx.patient.last_name}",
            "escalated_by": esc.escalated_by.full_name,
            "escalation_reason": esc.escalation_reason,
            "created_at": esc.created_at,
        })
    return results


@router.post("/escalations/{prescription_id}/resolve")
def resolve_escalated_case(
    prescription_id: str,
    resolution_data: EscalationResolutionRequest,
    current_user: User = Depends(require_chief_pharmacist),
    db: Session = Depends(get_db),
):
    """
    Resolve an escalated case. Chief Pharmacist ONLY.
    Updates escalation record with resolution notes, timestamp, and sets prescription status.
    """
    escalation = (
        db.query(EscalationResolution)
        .filter_by(prescription_id=prescription_id, resolved_at=None)
        .first()
    )
    if not escalation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active pending escalation found for prescription {prescription_id}",
        )

    rx = escalation.prescription
    escalation.resolved_by_id = current_user.id
    escalation.resolution_action = resolution_data.resolution_action
    escalation.resolution_notes = resolution_data.resolution_notes.strip()
    escalation.resolved_at = datetime.now(timezone.utc)

    if resolution_data.resolution_action == "APPROVED_BY_CHIEF":
        rx.status = "reviewed"
    elif resolution_data.resolution_action == "REJECTED_RETURNED_TO_PRESCRIBER":
        rx.status = "resolved"
    else:
        rx.status = "resolved"

    rx.updated_at = datetime.now(timezone.utc)

    # Record append-only audit event
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role="chief_pharmacist",
        action="ESCALATION_RESOLVED",
        entity_type="Prescription",
        entity_id=rx.id,
        details=json.dumps({
            "prescription_number": rx.prescription_number,
            "resolution_action": resolution_data.resolution_action,
            "resolved_by": current_user.username,
        }),
    )
    db.add(audit_event)
    db.commit()

    return {
        "status": "success",
        "prescription_id": rx.id,
        "resolution_action": resolution_data.resolution_action,
        "prescription_status": rx.status,
    }


@router.get("/override-ledger")
def get_override_ledger(
    current_user: User = Depends(require_chief_pharmacist),
    db: Session = Depends(get_db),
):
    """
    Retrieve audit ledger of all staff pharmacist overrides with written clinical rationales.
    Chief Pharmacist ONLY.
    """
    overrides = (
        db.query(PharmacistReview)
        .filter_by(action="OVERRIDE")
        .order_by(PharmacistReview.created_at.desc())
        .all()
    )
    results = []
    for ov in overrides:
        results.append({
            "review_id": ov.id,
            "prescription_number": ov.prescription.prescription_number,
            "patient_name": f"{ov.prescription.patient.first_name} {ov.prescription.patient.last_name}",
            "reviewer_name": ov.reviewer.full_name,
            "override_rationale": ov.override_rationale,
            "notes": ov.notes,
            "created_at": ov.created_at,
        })
    return results


@router.post("/inventory/adjust")
def adjust_inventory_quantity(
    adjustment: InventoryAdjustmentRequest,
    current_user: User = Depends(require_chief_pharmacist),
    db: Session = Depends(get_db),
):
    """
    Adjust simulated stock levels with mandatory audited rationale and actor attribution.
    Chief Pharmacist ONLY. Students and Staff Pharmacists receive 403 Forbidden.
    """
    item = db.query(InventoryItem).filter_by(id=adjustment.inventory_item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item {adjustment.inventory_item_id} not found",
        )

    new_quantity = item.quantity_on_hand + adjustment.quantity_delta
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Adjustment delta {adjustment.quantity_delta} would result in negative inventory ({new_quantity}).",
        )

    item.quantity_on_hand = new_quantity
    item.last_updated = datetime.now(timezone.utc)

    # Record inventory transaction
    txn = InventoryTransaction(
        inventory_item_id=item.id,
        actor_id=current_user.id,
        transaction_type="ADJUSTMENT",
        quantity_delta=adjustment.quantity_delta,
        quantity_after=new_quantity,
        reason=adjustment.reason.strip(),
    )
    db.add(txn)

    # Record append-only audit event
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role="chief_pharmacist",
        action="INVENTORY_ADJUSTED",
        entity_type="InventoryItem",
        entity_id=item.id,
        details=json.dumps({
            "medication_id": item.medication_id,
            "quantity_delta": adjustment.quantity_delta,
            "new_quantity": new_quantity,
            "reason": adjustment.reason,
        }),
    )
    db.add(audit_event)
    db.commit()

    return {
        "status": "success",
        "inventory_item_id": item.id,
        "medication_id": item.medication_id,
        "quantity_on_hand": item.quantity_on_hand,
        "is_low_stock": item.is_low_stock,
    }


@router.get("/audit-log")
def get_audit_log(
    limit: int = 50,
    current_user: User = Depends(require_chief_pharmacist),
    db: Session = Depends(get_db),
):
    """
    View append-only audit event log. Chief Pharmacist ONLY.
    """
    events = (
        db.query(AuditEvent)
        .order_by(AuditEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "timestamp": e.timestamp,
            "actor_username": e.actor_username,
            "actor_role": e.actor_role,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "details": json.loads(e.details) if e.details.startswith("{") else e.details,
            "ip_address": e.ip_address,
        }
        for e in events
    ]
