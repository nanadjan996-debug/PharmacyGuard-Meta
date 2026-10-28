"""Automated test suite for Milestone 4: Deterministic Clinical Verification Engine."""
import uuid
from datetime import date
import pytest
from sqlalchemy.orm import Session

from app.models.patient import SyntheticPatient, PatientDiagnosis, PatientAllergy
from app.models.prescription import Prescription, PrescriptionItem
from app.models.reference import MedicationReference, IndicationRule, DosageRule, AllergyCrossReactivityRule, DrugInteractionRule
from app.models.inventory import InventoryItem
from app.models.review import PharmacistReview, ReviewFinding
from app.models.audit import AuditEvent
from app.services.verification import (
    VerificationEngine,
    check_indications,
    check_allergies,
    check_duplications,
    check_interactions,
    check_dosages,
    check_inventory,
)
from app.services.verification.dosage import parse_frequency_multiplier, convert_to_mg


def get_auth_token(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


# =====================================================================
# 1. INDIVIDUAL SERVICE UNIT TESTS
# =====================================================================

def test_indication_service_direct_match(db_session: Session):
    """Prescription matching documented ICD-10 diagnosis produces CLEAN finding."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    assert rx is not None
    findings = check_indications(rx, db_session)
    assert len(findings) == 1
    assert findings[0].status == "CLEAN"
    assert findings[0].severity == "INFO"
    assert "I10" in findings[0].evidence


def test_indication_service_unmatched(db_session: Session):
    """Prescription without supporting diagnosis produces REVIEW_REQUIRED finding."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0002").first()
    assert rx is not None
    findings = check_indications(rx, db_session)
    assert len(findings) == 1
    assert findings[0].status == "REVIEW_REQUIRED"
    assert findings[0].severity == "MODERATE"
    assert findings[0].human_review_required is True


def test_allergy_service_anaphylaxis_conflict(db_session: Session):
    """Prescription of penicillin-class med to patient with documented penicillin anaphylaxis yields HIGH conflict."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()
    assert rx is not None
    findings = check_allergies(rx, db_session)
    assert len(findings) >= 1
    conflict = [f for f in findings if f.status == "CONFLICT_DETECTED"]
    assert len(conflict) >= 1
    assert conflict[0].severity == "HIGH"
    assert conflict[0].human_review_required is True
    assert "Anaphylaxis" in conflict[0].evidence or "Penicillin" in conflict[0].evidence


def test_duplication_service_single_med(db_session: Session):
    """Prescription with a single medication item emits CLEAN therapeutic duplication check."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    findings = check_duplications(rx, db_session)
    assert len(findings) == 1
    assert findings[0].status == "CLEAN"
    assert findings[0].severity == "INFO"


def test_duplication_service_dual_systemic_nsaid(db_session: Session):
    """Prescription with Ketorolac and Ibuprofen triggers therapeutic class duplication conflict."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0004").first()
    findings = check_duplications(rx, db_session)
    conflicts = [f for f in findings if f.status == "CONFLICT_DETECTED"]
    assert len(conflicts) >= 1
    assert any("NSAID" in f.message or "NSAID" in f.evidence for f in conflicts)
    assert any(f.severity == "HIGH" for f in conflicts)


def test_interaction_service_detected(db_session: Session):
    """Prescription with Ketorolac and Ibuprofen triggers configured drug interaction rule."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0004").first()
    findings = check_interactions(rx, db_session)
    assert len(findings) >= 1
    conflict = [f for f in findings if f.status == "CONFLICT_DETECTED"]
    assert len(conflict) >= 1
    assert conflict[0].severity == "HIGH"
    assert "gastrointestinal" in conflict[0].evidence.lower() or "nsaid" in conflict[0].evidence.lower()


def test_dosage_arithmetic_and_unit_conversion():
    """Test unit conversions, invalid units, and frequency parsing."""
    # Convert to mg
    mg, err = convert_to_mg(500, "mg")
    assert mg == 500.0 and err is None

    mg_g, err = convert_to_mg(1.5, "g")
    assert mg_g == 1500.0 and err is None

    mg_mcg, err = convert_to_mg(250, "mcg")
    assert mg_mcg == 0.25 and err is None

    _, err_puffs = convert_to_mg(2, "puffs")
    assert err_puffs is not None

    _, err_zero = convert_to_mg(0, "mg")
    assert err_zero is not None

    # Frequency parsing
    assert parse_frequency_multiplier("Once daily") == 1.0
    assert parse_frequency_multiplier("BID") == 2.0
    assert parse_frequency_multiplier("Twice daily (BID)") == 2.0
    assert parse_frequency_multiplier("TID") == 3.0
    assert parse_frequency_multiplier("Q6H") == 4.0
    assert parse_frequency_multiplier("every 8 hours") == 3.0
    assert parse_frequency_multiplier("every 4 hours") == 6.0
    assert parse_frequency_multiplier("PRN as needed") is None


def test_dosage_service_limits(db_session: Session):
    """Test dosage single dose limit, daily limit, and sub-therapeutic detection."""
    # Scenario 1 (Lisinopril 10mg QD) should be clean
    rx1 = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    findings = check_dosages(rx1, db_session)
    assert len(findings) == 1
    assert findings[0].status == "CLEAN"
    assert findings[0].severity == "INFO"


def test_inventory_service_shortage_detected(db_session: Session):
    """Scenario 5: Cefdinir 20 units requested, 12 available triggers stock shortage."""
    rx5 = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0005").first()
    findings = check_inventory(rx5, db_session)
    shortages = [f for f in findings if f.status == "CONFLICT_DETECTED" and f.rule_identifier == "RULE-INV-STOCK-01"]
    assert len(shortages) == 1
    assert shortages[0].severity == "HIGH"
    assert "12 units" in shortages[0].evidence
    assert "20 units" in shortages[0].evidence


# =====================================================================
# 2. THE FIVE SEEDED BENCHMARK SCENARIOS
# =====================================================================

def test_engine_scenario_1_routine(db_session: Session):
    """Benchmark Scenario 1: Routine Lisinopril 10mg for Hypertension -> Clean."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    assert res.summary.prescription_number == "RX-2026-0001"
    assert res.summary.conflicts_count == 0
    assert res.summary.max_severity == "INFO"
    assert res.summary.requires_human_review is False
    assert res.summary.clean_count > 0


def test_engine_scenario_2_indication_review(db_session: Session):
    """Benchmark Scenario 2: Metformin without documented T2D diagnosis -> Review Required."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0002").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    assert res.summary.prescription_number == "RX-2026-0002"
    assert res.summary.conflicts_count == 0
    assert res.summary.review_required_count >= 1
    assert res.summary.requires_human_review is True

    ind_finding = next((f for f in res.findings if f.category == "INDICATION"), None)
    assert ind_finding is not None
    assert ind_finding.status == "REVIEW_REQUIRED"
    assert ind_finding.severity == "MODERATE"


def test_engine_scenario_3_allergy_conflict(db_session: Session):
    """Benchmark Scenario 3: Amoxicillin with penicillin anaphylaxis -> High Conflict."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    assert res.summary.prescription_number == "RX-2026-0003"
    assert res.summary.conflicts_count >= 1
    assert res.summary.max_severity == "HIGH"
    assert res.summary.requires_human_review is True

    alg_finding = next((f for f in res.findings if f.category == "ALLERGY"), None)
    assert alg_finding is not None
    assert alg_finding.status == "CONFLICT_DETECTED"
    assert alg_finding.severity == "HIGH"


def test_engine_scenario_4_duplicate_nsaid(db_session: Session):
    """Benchmark Scenario 4: Ketorolac + Ibuprofen dual systemic NSAIDs -> Duplication Conflict."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0004").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    assert res.summary.prescription_number == "RX-2026-0004"
    assert res.summary.conflicts_count >= 1
    assert res.summary.max_severity == "HIGH"

    dup_finding = next((f for f in res.findings if f.category == "THERAPEUTIC_DUPLICATION"), None)
    assert dup_finding is not None
    assert dup_finding.status == "CONFLICT_DETECTED"
    assert dup_finding.severity == "HIGH"


def test_engine_scenario_5_stock_shortage(db_session: Session):
    """Benchmark Scenario 5: Cefdinir 20 requested, 12 in stock -> Inventory Shortage Conflict."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0005").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    assert res.summary.prescription_number == "RX-2026-0005"
    assert res.summary.conflicts_count >= 1
    assert res.summary.max_severity == "HIGH"

    inv_finding = next((f for f in res.findings if f.category == "INVENTORY" and f.status == "CONFLICT_DETECTED"), None)
    assert inv_finding is not None
    assert inv_finding.severity == "HIGH"
    assert "12 available" in inv_finding.message or "12 units" in inv_finding.evidence


# =====================================================================
# 3. DETERMINISM, ORDERING, & IDEMPOTENT PERSISTENCE
# =====================================================================

def test_deterministic_output_and_ordering(db_session: Session):
    """Repeated verification runs produce identical outputs and stable severity sorting."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0004").first()
    engine = VerificationEngine(db_session)

    res1 = engine.verify(rx.id, persist=False)
    res2 = engine.verify(rx.id, persist=False)

    # Identical summary
    assert res1.summary.total_findings == res2.summary.total_findings
    assert res1.summary.conflicts_count == res2.summary.conflicts_count
    assert res1.summary.max_severity == res2.summary.max_severity

    # Identical findings order
    for f1, f2 in zip(res1.findings, res2.findings):
        assert f1.rule_identifier == f2.rule_identifier
        assert f1.severity == f2.severity
        assert f1.status == f2.status
        assert f1.category == f2.category

    # Verify severity order is strictly non-increasing (HIGH <= MODERATE <= LOW <= INFO)
    severity_rank = {"HIGH": 0, "MODERATE": 1, "LOW": 2, "INFO": 3}
    ranks = [severity_rank[f.severity] for f in res1.findings]
    assert ranks == sorted(ranks)


def test_idempotent_findings_persistence(db_session: Session):
    """Re-verifying a prescription replaces unreviewed findings without duplication or changing status."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0002").first()
    initial_status = rx.status
    engine = VerificationEngine(db_session)

    # First run with persist=True
    res1 = engine.verify(rx.id, persist=True)
    count1 = db_session.query(ReviewFinding).filter_by(prescription_id=rx.id, review_id=None).count()

    # Second run with persist=True
    res2 = engine.verify(rx.id, persist=True)
    count2 = db_session.query(ReviewFinding).filter_by(prescription_id=rx.id, review_id=None).count()

    assert count1 == count2 == res1.summary.total_findings
    # Status must not be altered
    assert rx.status == initial_status


def test_preserves_historical_reviewed_findings(db_session: Session):
    """Re-verifying never deletes or overwrites findings already linked to a PharmacistReview."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    # Create a dummy review and attach a historical finding
    user = rx.patient  # Just need an ID or get a user
    review = PharmacistReview(
        prescription_id=rx.id,
        reviewer_id="usr-staff-001",
        action="ACCEPT",
        notes="Historical accepted review",
    )
    db_session.add(review)
    db_session.flush()

    historical_finding = ReviewFinding(
        prescription_id=rx.id,
        review_id=review.id,
        rule_identifier="RULE-HISTORICAL-001",
        category="INDICATION",
        severity="INFO",
        status="CLEAN",
        evidence="Historical preserved finding",
        rule_source="Historical Test",
        human_review_required=False,
    )
    db_session.add(historical_finding)
    db_session.commit()

    # Now verify the prescription with persist=True
    engine = VerificationEngine(db_session)
    engine.verify(rx.id, persist=True)

    # Check that historical finding still exists
    refetched = db_session.query(ReviewFinding).filter_by(id=historical_finding.id).first()
    assert refetched is not None
    assert refetched.review_id == review.id


# =====================================================================
# 4. API ENDPOINT & RBAC TESTS
# =====================================================================

def test_verify_endpoint_staff_pharmacist(client, db_session: Session):
    """Staff pharmacist can trigger verification endpoint and receives full response."""
    token = get_auth_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()

    res = client.post(
        f"/api/v1/prescriptions/{rx.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "findings" in data
    assert data["summary"]["prescription_number"] == "RX-2026-0001"
    assert len(data["findings"]) > 0

    # Verify audit event was logged
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="PRESCRIPTION_VERIFIED", entity_id=rx.id)
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert audit.actor_username == "pharmacist_demo"


def test_verify_endpoint_chief_pharmacist(client, db_session: Session):
    """Chief pharmacist can also trigger verification endpoint."""
    token = get_auth_token(client, "chief_demo", "ChiefDemoPassword2026!")
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()

    res = client.post(
        f"/api/v1/prescriptions/{rx.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["summary"]["max_severity"] == "HIGH"


def test_verify_endpoint_student_forbidden(client, db_session: Session):
    """Pharmacy student is rejected with HTTP 403 Forbidden."""
    token = get_auth_token(client, "student_demo", "StudentDemoPassword2026!")
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()

    res = client.post(
        f"/api/v1/prescriptions/{rx.id}/verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_verify_endpoint_unauthenticated(client, db_session: Session):
    """Unauthenticated request is rejected with HTTP 401 Unauthorized."""
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()

    res = client.post(f"/api/v1/prescriptions/{rx.id}/verify")
    assert res.status_code == 401


def test_verify_endpoint_nonexistent_prescription(client):
    """Nonexistent prescription ID returns 404 Not Found."""
    token = get_auth_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    res = client.post(
        f"/api/v1/prescriptions/{uuid.uuid4()}/verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 404
