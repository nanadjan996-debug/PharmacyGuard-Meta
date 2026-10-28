"""Deterministic Clinical Verification Engine Orchestrator."""
from sqlalchemy.orm import Session
from app.models.prescription import Prescription
from app.models.review import ReviewFinding
from app.services.verification.models import (
    GeneratedFinding,
    VerificationSummary,
    VerificationResponse,
    FindingSeverity,
)
from app.services.verification.indication import check_indications
from app.services.verification.allergy import check_allergies
from app.services.verification.duplication import check_duplications
from app.services.verification.interaction import check_interactions
from app.services.verification.dosage import check_dosages
from app.services.verification.inventory import check_inventory

# Ordering ranks for stable, deterministic sorting
SEVERITY_ORDER: dict[str, int] = {
    "HIGH": 0,
    "MODERATE": 1,
    "LOW": 2,
    "INFO": 3,
}

STATUS_ORDER: dict[str, int] = {
    "CONFLICT_DETECTED": 0,
    "REVIEW_REQUIRED": 1,
    "INSUFFICIENT_DATA": 2,
    "CLEAN": 3,
}

CATEGORY_ORDER: dict[str, int] = {
    "ALLERGY": 0,
    "THERAPEUTIC_DUPLICATION": 1,
    "DRUG_INTERACTION": 2,
    "INDICATION": 3,
    "DOSAGE": 4,
    "INVENTORY": 5,
}


def sort_findings(findings: list[GeneratedFinding]) -> list[GeneratedFinding]:
    """Sort findings deterministically by severity, status, category, and rule identifier."""
    return sorted(
        findings,
        key=lambda f: (
            SEVERITY_ORDER.get(f.severity, 99),
            STATUS_ORDER.get(f.status, 99),
            CATEGORY_ORDER.get(f.category, 99),
            f.rule_identifier,
            f.message,
        ),
    )


class VerificationEngine:
    """
    Deterministic rule-based clinical verification service.
    
    Evaluates a prescription's actual stored data across six independent rule services:
    1. Indication & Diagnosis alignment
    2. Allergy & Cross-reactivity checking
    3. Duplicate medication & Therapeutic duplication
    4. Drug-drug interactions
    5. Dosage, Frequency, and Daily limit calculations
    6. Inventory availability and stock shortages
    """

    def __init__(self, db: Session):
        self.db = db

    def verify(self, prescription_id: str, persist: bool = True) -> VerificationResponse:
        """
        Execute deterministic verification on a prescription by ID.
        
        Args:
            prescription_id: UUID of the prescription to verify.
            persist: If True, sync unreviewed findings to the database.
            
        Returns:
            VerificationResponse containing summary and ordered findings.
            
        Raises:
            ValueError: If the prescription is not found in the database.
        """
        prescription = self.db.query(Prescription).filter_by(id=prescription_id).first()
        if not prescription:
            raise ValueError(f"Prescription not found with ID: {prescription_id}")

        all_findings: list[GeneratedFinding] = []

        # Handle incomplete prescription data safely
        if not prescription.patient:
            all_findings.append(
                GeneratedFinding(
                    rule_identifier="RULE-ERR-NO-PATIENT",
                    category="INDICATION",
                    severity="HIGH",
                    status="INSUFFICIENT_DATA",
                    message="Prescription has no associated patient profile.",
                    evidence="Verification aborted: Prescription record lacks a valid foreign key to synthetic_patients.",
                    rule_source="Deterministic Verification Engine (Integrity Check)",
                    human_review_required=True,
                )
            )
            ordered_findings = sort_findings(all_findings)
            return self._build_response(prescription, ordered_findings, persist=persist)

        if not prescription.items:
            all_findings.append(
                GeneratedFinding(
                    rule_identifier="RULE-ERR-NO-ITEMS",
                    category="INDICATION",
                    severity="MODERATE",
                    status="INSUFFICIENT_DATA",
                    message="Prescription contains no medication items.",
                    evidence="Verification found 0 prescription items. Nothing to clinically evaluate.",
                    rule_source="Deterministic Verification Engine (Integrity Check)",
                    human_review_required=True,
                )
            )
            ordered_findings = sort_findings(all_findings)
            return self._build_response(prescription, ordered_findings, persist=persist)

        # 1. Diagnosis–Medication Indication Check
        all_findings.extend(check_indications(prescription, self.db))

        # 2. Allergy & Cross-Reactivity Check
        all_findings.extend(check_allergies(prescription, self.db))

        # 3. Duplicate Medication & Therapeutic Duplication Check
        all_findings.extend(check_duplications(prescription, self.db))

        # 4. Drug-Drug Interaction Check
        all_findings.extend(check_interactions(prescription, self.db))

        # 5. Dosage, Frequency & Daily Amount Check
        all_findings.extend(check_dosages(prescription, self.db))

        # 6. Inventory Availability & Stock Shortage Check
        all_findings.extend(check_inventory(prescription, self.db))

        # Sort all findings deterministically
        ordered_findings = sort_findings(all_findings)

        # Build response and optionally persist
        return self._build_response(prescription, ordered_findings, persist=persist)

    def _build_response(
        self,
        prescription: Prescription,
        findings: list[GeneratedFinding],
        persist: bool,
    ) -> VerificationResponse:
        """Calculate summary statistics, optionally persist unreviewed findings, and return response."""
        conflicts_count = sum(1 for f in findings if f.status == "CONFLICT_DETECTED")
        review_required_count = sum(1 for f in findings if f.status in ("REVIEW_REQUIRED", "INSUFFICIENT_DATA"))
        clean_count = sum(1 for f in findings if f.status == "CLEAN")

        # Determine max severity
        max_severity: FindingSeverity = "INFO"
        for s in ("HIGH", "MODERATE", "LOW"):
            if any(f.severity == s for f in findings):
                max_severity = s  # type: ignore
                break

        requires_human_review = any(
            f.human_review_required or f.severity in ("HIGH", "MODERATE")
            for f in findings
        )

        summary = VerificationSummary(
            prescription_id=prescription.id,
            prescription_number=prescription.prescription_number,
            total_findings=len(findings),
            conflicts_count=conflicts_count,
            review_required_count=review_required_count,
            clean_count=clean_count,
            max_severity=max_severity,
            requires_human_review=requires_human_review,
        )

        if persist:
            self._sync_findings_to_db(prescription.id, findings)

        return VerificationResponse(summary=summary, findings=findings)

    def _sync_findings_to_db(self, prescription_id: str, findings: list[GeneratedFinding]) -> None:
        """
        Persist generated findings to the database with transactional rollback guarantees.
        
        Contract:
        - Only findings where review_id is NULL (unreviewed findings) are replaced.
        - Historical findings tied to a completed PharmacistReview (review_id is NOT NULL)
          are NEVER overwritten or deleted.
        - Atomic execution: if any database error occurs during deletion or insertion,
          the transaction is fully rolled back, leaving findings unchanged.
        - The prescription status is NOT altered.
        - No pharmacist decisions or approvals are recorded.
        """
        try:
            # Delete only unreviewed findings for this prescription
            self.db.query(ReviewFinding).filter(
                ReviewFinding.prescription_id == prescription_id,
                ReviewFinding.review_id.is_(None),
            ).delete(synchronize_session="fetch")

            # Insert new unreviewed findings
            for f in findings:
                rf = ReviewFinding(
                    prescription_id=prescription_id,
                    review_id=None,
                    rule_identifier=f.rule_identifier,
                    category=f.category,
                    severity=f.severity,
                    status=f.status,
                    evidence=f"{f.message} | {f.evidence}",
                    rule_source=f.rule_source,
                    human_review_required=f.human_review_required,
                )
                self.db.add(rf)

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

