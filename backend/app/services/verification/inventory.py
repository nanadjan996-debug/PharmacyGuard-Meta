"""Inventory availability deterministic verification service."""
from sqlalchemy.orm import Session
from app.models.prescription import Prescription
from app.models.inventory import InventoryItem
from app.services.verification.models import GeneratedFinding


def check_inventory(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Compare prescribed medication, strength, formulation, and requested quantity
    against available synthetic inventory stock.
    
    Distinguishes:
    - Sufficient stock (CLEAN, INFO)
    - Low stock warning (REVIEW_REQUIRED, LOW)
    - Insufficient stock shortage (CONFLICT_DETECTED, HIGH)
    - Unavailable matching inventory (CONFLICT_DETECTED, HIGH)
    """
    findings: list[GeneratedFinding] = []

    for item in prescription.items:
        med = item.medication

        # 1. Look up inventory record for this medication
        inv = db.query(InventoryItem).filter_by(medication_id=med.id).first()

        if not inv:
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-INV-UNAVAILABLE-{med.id}",
                    category="INVENTORY",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=f"No matching inventory found for {med.generic_name} ({med.standard_strength}, {med.dosage_form}).",
                    evidence=(
                        f"UNAVAILABLE INVENTORY: No inventory record exists for medication ID '{med.id}' "
                        f"({med.brand_name} {med.standard_strength} {med.dosage_form}). "
                        f"Requested quantity: {item.quantity_prescribed} units. Central pharmacy replenishment required."
                    ),
                    rule_source="Hospital Formulary & Perpetual Inventory Service",
                    human_review_required=True,
                )
            )
            continue

        # 2. Check for insufficient stock (stock shortage)
        if inv.quantity_on_hand < item.quantity_prescribed:
            findings.append(
                GeneratedFinding(
                    rule_identifier="RULE-INV-STOCK-01",
                    category="INVENTORY",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=(
                        f"Insufficient inventory stock for {med.generic_name}: "
                        f"{inv.quantity_on_hand} available, {item.quantity_prescribed} required."
                    ),
                    evidence=(
                        f"SIMULATED INVENTORY SHORTAGE: {med.generic_name} {med.standard_strength} "
                        f"({inv.location}) on-hand quantity is {inv.quantity_on_hand} units, but prescription "
                        f"requires {item.quantity_prescribed} units. Reorder threshold is {inv.reorder_threshold} units. "
                        f"Fulfillment cannot be completed without reallocation or stock replenishment."
                    ),
                    rule_source="Hospital Formulary & Perpetual Inventory Service",
                    human_review_required=True,
                )
            )
            continue

        # 3. Check for low stock warning
        # (remaining after dispensing <= threshold, or currently on hand <= threshold)
        remaining_units = inv.quantity_on_hand - item.quantity_prescribed
        if remaining_units <= inv.reorder_threshold or inv.quantity_on_hand <= inv.reorder_threshold:
            findings.append(
                GeneratedFinding(
                    rule_identifier="RULE-INV-LOW-STOCK-01",
                    category="INVENTORY",
                    severity="LOW",
                    status="REVIEW_REQUIRED",
                    message=(
                        f"Low stock advisory for {med.generic_name}: dispensing {item.quantity_prescribed} units "
                        f"leaves {remaining_units} units (threshold: {inv.reorder_threshold})."
                    ),
                    evidence=(
                        f"INVENTORY LOW STOCK WARNING: Current stock of {inv.quantity_on_hand} units at {inv.location} "
                        f"is sufficient to fulfill this order of {item.quantity_prescribed} units, but will leave "
                        f"{remaining_units} units remaining, at or below the reorder threshold of {inv.reorder_threshold} units."
                    ),
                    rule_source="Hospital Formulary & Perpetual Inventory Service",
                    human_review_required=False,
                )
            )
            continue

        # 4. Clean sufficient stock
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-INV-SUFFICIENT-01",
                category="INVENTORY",
                severity="INFO",
                status="CLEAN",
                message=f"Sufficient inventory available for {med.generic_name} ({inv.quantity_on_hand} in stock).",
                evidence=(
                    f"Central inventory has {inv.quantity_on_hand} units of {med.generic_name} {med.standard_strength} "
                    f"available at {inv.location} (requested: {item.quantity_prescribed} units; reorder threshold: {inv.reorder_threshold})."
                ),
                rule_source="Hospital Formulary & Perpetual Inventory Service",
                human_review_required=False,
            )
        )

    return findings
