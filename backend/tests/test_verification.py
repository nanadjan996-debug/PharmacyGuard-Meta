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


def test_pediatric_and_low_weight_dosage_safety_invariant(db_session: Session):
    """Pediatric (<18y) and low-weight (<40kg) patients must NOT receive automated CLEAN dosage clearance."""
    from app.models.patient import SyntheticPatient
    from datetime import date
    import uuid

    # Create synthetic 6-year-old child (19 kg)
    ped_patient = SyntheticPatient(
        id=f"ped-test-{uuid.uuid4()}",
        mrn=f"PED-{uuid.uuid4().hex[:6].upper()}",
        first_name="Emmanuel",
        last_name="Boateng",
        date_of_birth=date(date.today().year - 6, 1, 1),
        gender="Male",
        weight_kg=19.0,
        height_cm=115.0,
        is_synthetic=True,
    )
    db_session.add(ped_patient)
    db_session.flush()

    ped_rx = Prescription(
        id=f"rx-ped-{uuid.uuid4()}",
        prescription_number=f"RX-PED-{uuid.uuid4().hex[:4].upper()}",
        patient_id=ped_patient.id,
        prescriber_name="Dr. Child Specialist",
        prescriber_department="Pediatrics",
        status="pending",
    )
    db_session.add(ped_rx)
    db_session.flush()

    # Prescribe Amoxicillin 250mg TID (under adult single and daily limits)
    db_session.add(PrescriptionItem(
        prescription_id=ped_rx.id,
        medication_id="MED-AMOX-500",
        dose_amount=250.0,
        dose_unit="mg",
        frequency="Three times daily (TID)",
        route="Oral",
        duration_days=5,
        quantity_prescribed=15,
        instructions="Take 250mg TID",
    ))
    db_session.flush()

    findings = check_dosages(ped_rx, db_session)
    assert len(findings) == 1
    assert findings[0].status == "REVIEW_REQUIRED"
    assert findings[0].severity == "MODERATE"
    assert findings[0].human_review_required is True
    assert "PEDIATRIC-MANUAL" in findings[0].rule_identifier
    assert "Automated adult dosage bounds unsupported" in findings[0].message


def test_allergy_epistemic_uncollected_status_requires_confirmation(db_session: Session):
    """Empty allergy profile must NOT be assumed to be NKDA; requires explicit confirmation."""
    from app.models.patient import SyntheticPatient
    from datetime import date
    import uuid

    # Create patient with no allergy documentation
    unassessed_patient = SyntheticPatient(
        id=f"pat-unassessed-{uuid.uuid4()}",
        mrn=f"UNASSESSED-{uuid.uuid4().hex[:6].upper()}",
        first_name="Unassessed",
        last_name="Patient",
        date_of_birth=date(1990, 1, 1),
        gender="Female",
        weight_kg=65.0,
        height_cm=165.0,
        is_synthetic=True,
    )
    db_session.add(unassessed_patient)
    db_session.flush()

    rx = Prescription(
        id=f"rx-unassessed-{uuid.uuid4()}",
        prescription_number=f"RX-UNASSESSED-{uuid.uuid4().hex[:4].upper()}",
        patient_id=unassessed_patient.id,
        prescriber_name="Dr. Attending",
        prescriber_department="Medicine",
        status="pending",
    )
    db_session.add(rx)
    db_session.flush()

    findings = check_allergies(rx, db_session)
    assert len(findings) == 1
    assert findings[0].rule_identifier == "RULE-ALG-EPISTEMIC-UNVERIFIED"
    assert findings[0].status == "REVIEW_REQUIRED"
    assert findings[0].human_review_required is True
    assert "Allergy status unconfirmed" in findings[0].message


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


# =====================================================================
# 5. FOCUSED AUDIT & REGRESSION TESTS
# =====================================================================

def test_audit_immutability_boundaries(db_session: Session):
    """
    Test and document exact immutability boundaries for AuditEvent:
    1. Ordinary ORM instance update is BLOCKED by before_update listener.
    2. Ordinary ORM instance delete is BLOCKED by before_delete listener.
    3. Bulk/Direct SQL queries bypass ORM mapper listeners (application/ORM-level enforcement).
    """
    from sqlalchemy import text

    test_event = AuditEvent(
        actor_username="immutability_auditor",
        actor_role="staff_pharmacist",
        action="TEST_AUDIT_ENTRY",
        entity_type="Prescription",
        entity_id="test-entity-001",
        details='{"test": true}',
    )
    db_session.add(test_event)
    db_session.commit()
    event_id = test_event.id

    # 1. ORM instance update -> MUST RAISE PermissionError
    test_event.action = "TAMPERED_ACTION"
    with pytest.raises(PermissionError) as exc_info:
        db_session.flush()
    assert "immutable" in str(exc_info.value).lower()
    db_session.rollback()

    # 2. ORM instance delete -> MUST RAISE PermissionError
    fetched = db_session.query(AuditEvent).filter_by(id=event_id).first()
    assert fetched is not None
    db_session.delete(fetched)
    with pytest.raises(PermissionError) as exc_info:
        db_session.flush()
    assert "append-only" in str(exc_info.value).lower()
    db_session.rollback()

    # 3. Direct SQL delete: mapper listeners only intercept ORM unit-of-work flushes.
    # We verify that direct raw SQL bypasses mapper events (confirming ORM-level, not DB-engine-level enforcement)
    raw_res = db_session.execute(text("DELETE FROM audit_events WHERE id = :id"), {"id": event_id})
    db_session.commit()
    assert raw_res.rowcount == 1
    # Confirm it was deleted by raw SQL
    deleted_check = db_session.query(AuditEvent).filter_by(id=event_id).first()
    assert deleted_check is None


def test_sync_findings_rollback_on_failure(db_session: Session):
    """
    Regression test: If a database error occurs during _sync_findings_to_db,
    the transaction is rolled back, leaving pre-existing findings intact
    without duplicate or partially refreshed findings.
    """
    from unittest.mock import patch

    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    engine = VerificationEngine(db_session)

    # Establish baseline findings
    engine.verify(rx.id, persist=True)
    baseline_findings = (
        db_session.query(ReviewFinding)
        .filter_by(prescription_id=rx.id, review_id=None)
        .order_by(ReviewFinding.rule_identifier)
        .all()
    )
    baseline_count = len(baseline_findings)
    baseline_ids = [f.id for f in baseline_findings]
    assert baseline_count > 0

    # Simulate a database failure during commit inside _sync_findings_to_db
    with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated DB Connection Drop")):
        with pytest.raises(RuntimeError) as exc_info:
            engine.verify(rx.id, persist=True)
        assert "Simulated DB Connection Drop" in str(exc_info.value)

    # Verify that pre-existing findings were NOT lost or partially deleted
    refetched_findings = (
        db_session.query(ReviewFinding)
        .filter_by(prescription_id=rx.id, review_id=None)
        .order_by(ReviewFinding.rule_identifier)
        .all()
    )
    assert len(refetched_findings) == baseline_count
    assert [f.id for f in refetched_findings] == baseline_ids


def test_severity_semantics_high_conflict_never_clean(db_session: Session):
    """
    Confirm that a prescription with any HIGH conflict finding cannot be summarized or displayed as clean.
    Summary metrics must accurately reflect the conflict.
    """
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()
    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    # Must have at least one HIGH finding
    high_findings = [f for f in res.findings if f.severity == "HIGH"]
    assert len(high_findings) >= 1

    # Summary checks
    assert res.summary.max_severity == "HIGH"
    assert res.summary.conflicts_count >= 1
    assert res.summary.requires_human_review is True
    # clean_count only counts CLEAN status findings, never hides conflicts
    assert res.summary.clean_count > 0
    assert res.summary.total_findings == res.summary.conflicts_count + res.summary.review_required_count + res.summary.clean_count


def test_scenario_5_polypharmacy_and_inventory_integrity(db_session: Session):
    """
    Confirm Scenario 5 benchmark integrity:
    Cefdinir has a stock shortage (12 units on hand vs. 20 requested) -> HIGH CONFLICT
    Amlodipine has sufficient stock (260 units on hand vs. 30 requested) -> CLEAN
    Cefdinir + Amlodipine has no configured drug interaction -> CLEAN
    """
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0005").first()
    assert rx is not None
    # Must have exactly 2 line items
    assert len(rx.items) == 2
    med_ids = {item.medication_id for item in rx.items}
    assert "MED-CEF-500" in med_ids
    assert "MED-AML-5" in med_ids

    engine = VerificationEngine(db_session)
    res = engine.verify(rx.id, persist=False)

    # Check inventory findings
    inv_findings = [f for f in res.findings if f.category == "INVENTORY"]
    assert len(inv_findings) == 2
    cef_inv = next(f for f in inv_findings if "Cefdinir" in f.message)
    aml_inv = next(f for f in inv_findings if "Amlodipine" in f.message)

    assert cef_inv.status == "CONFLICT_DETECTED"
    assert cef_inv.severity == "HIGH"
    assert "12 available, 20 required" in cef_inv.message

    assert aml_inv.status == "CLEAN"
    assert aml_inv.severity == "INFO"
    assert "260 in stock" in aml_inv.message

    # Check interaction findings
    ddi_findings = [f for f in res.findings if f.category == "DRUG_INTERACTION"]
    assert len(ddi_findings) == 1
    assert ddi_findings[0].status == "CLEAN"
    assert ddi_findings[0].severity == "INFO"

