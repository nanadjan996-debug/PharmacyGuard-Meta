"""Automated test suite for Milestone 5: Review Workflow and Escalation Services."""
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import patch
import pytest
from sqlalchemy.orm import Session

from app.models.prescription import Prescription, PrescriptionItem
from app.models.review import PharmacistReview, ReviewFinding, EscalationResolution
from app.models.audit import AuditEvent
from app.models.user import User
from app.services.verification import VerificationEngine


def get_token(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def test_prescription(db_session: Session):
    """Create a fresh pending test prescription with synthetic patient and items."""
    rx = Prescription(
        id=str(uuid.uuid4()),
        prescription_number=f"RX-WF-{uuid.uuid4().hex[:6].upper()}",
        patient_id="pat-synth-001",
        prescriber_name="Dr. Test Workflow, MD",
        prescriber_department="Clinical Testing Service",
        status="pending",
        scenario_key="TEST_WORKFLOW_PENDING",
        clinical_notes="Prescription created specifically for workflow testing.",
    )
    db_session.add(rx)
    db_session.flush()

    item = PrescriptionItem(
        id=str(uuid.uuid4()),
        prescription_id=rx.id,
        medication_id="MED-LIS-10",
        dose_amount=10.0,
        dose_unit="mg",
        frequency="Once daily",
        route="Oral",
        duration_days=30,
        quantity_prescribed=30,
        instructions="Take 1 tablet daily.",
    )
    db_session.add(item)
    db_session.commit()
    return rx


@pytest.fixture
def high_conflict_prescription(db_session: Session):
    """Create a pending test prescription with a HIGH-severity allergy conflict."""
    rx = Prescription(
        id=str(uuid.uuid4()),
        prescription_number=f"RX-HIGH-{uuid.uuid4().hex[:6].upper()}",
        patient_id="pat-synth-003",  # Charles Vance with Penicillin anaphylaxis
        prescriber_name="Dr. Allergy Test, MD",
        prescriber_department="ENT Surgery",
        status="pending",
        scenario_key="TEST_WORKFLOW_HIGH_ALLERGY",
        clinical_notes="Severe allergy conflict prescription for override testing.",
    )
    db_session.add(rx)
    db_session.flush()

    item = PrescriptionItem(
        id=str(uuid.uuid4()),
        prescription_id=rx.id,
        medication_id="MED-AMOX-500",
        dose_amount=500.0,
        dose_unit="mg",
        frequency="TID",
        route="Oral",
        duration_days=10,
        quantity_prescribed=30,
        instructions="Take 1 capsule three times daily.",
    )
    db_session.add(item)
    db_session.commit()

    # Run deterministic verification to attach HIGH finding
    engine = VerificationEngine(db_session)
    engine.verify(rx.id, persist=True)
    return rx


# =====================================================================
# 1. REVIEW ACTIONS: ACCEPT, OVERRIDE, ESCALATE
# =====================================================================

def test_pharmacist_accept_review(client, db_session: Session, test_prescription):
    """Staff pharmacist accepts a clean pending prescription."""
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "action": "ACCEPT",
        "notes": "Verified against documented hypertension diagnosis; no conflicts detected.",
    }
    res = client.post(f"/api/v1/prescriptions/{test_prescription.id}/review", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["action"] == "ACCEPT"
    assert data["new_status"] == "reviewed"
    assert "review_id" in data
    assert data["findings_snapshotted"] > 0
    assert "Advisory" in data["disclaimer"]

    # Verify database state
    db_session.refresh(test_prescription)
    assert test_prescription.status == "reviewed"

    review = db_session.query(PharmacistReview).filter_by(id=data["review_id"]).first()
    assert review is not None
    assert review.action == "ACCEPT"
    assert review.reviewer_id == "usr-staff-001"
    assert len(review.findings) == data["findings_snapshotted"]

    # Verify audit event recorded
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="REVIEW_ACCEPT", entity_id=test_prescription.id)
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert audit.actor_username == "pharmacist_demo"


def test_override_rationales_blank_missing_valid(client, db_session: Session, high_conflict_prescription):
    """
    Overriding a prescription with a HIGH-severity finding:
    - Missing rationale -> 422 Unprocessable Entity
    - Whitespace-only rationale -> 422 Unprocessable Entity
    - Valid non-empty rationale -> 200 OK and status 'overridden'
    """
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Missing override_rationale
    res1 = client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json={"action": "OVERRIDE", "notes": "Trying without rationale"},
        headers=headers,
    )
    assert res1.status_code == 422
    assert "mandatory" in res1.json()["detail"].lower()

    # 2. Whitespace-only override_rationale
    res2 = client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json={"action": "OVERRIDE", "override_rationale": "    \t\n   "},
        headers=headers,
    )
    assert res2.status_code == 422
    assert "mandatory" in res2.json()["detail"].lower()

    # 3. Valid override with clinical rationale
    valid_payload = {
        "action": "OVERRIDE",
        "override_rationale": "Patient successfully underwent oral amoxicillin desensitization protocol under direct ICU supervision.",
        "notes": "Desensitization verified with Allergy & Immunology Fellow.",
    }
    res3 = client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json=valid_payload,
        headers=headers,
    )
    assert res3.status_code == 200
    data = res3.json()
    assert data["new_status"] == "overridden"
    assert data["action"] == "OVERRIDE"

    db_session.refresh(high_conflict_prescription)
    assert high_conflict_prescription.status == "overridden"

    # Audit check
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="REVIEW_OVERRIDE", entity_id=high_conflict_prescription.id)
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert "override_rationale_provided" in audit.details


def test_escalate_prescription_creates_traceable_escalation(client, db_session: Session, high_conflict_prescription):
    """
    Staff pharmacist escalates complex high-risk prescription:
    - Sets prescription status to 'escalated'
    - Creates pending EscalationResolution in DB
    - Appears in Chief Pharmacist queue
    """
    token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "action": "ESCALATE",
        "notes": "Patient has documented penicillin anaphylaxis and severe renal impairment. Escalating for Chief review of alternative carbapenem/fluoroquinolone regimen.",
    }
    res = client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["new_status"] == "escalated"

    db_session.refresh(high_conflict_prescription)
    assert high_conflict_prescription.status == "escalated"

    # Check EscalationResolution record
    esc = (
        db_session.query(EscalationResolution)
        .filter_by(prescription_id=high_conflict_prescription.id, resolved_at=None)
        .first()
    )
    assert esc is not None
    assert esc.escalated_by_id == "usr-staff-001"
    assert "penicillin anaphylaxis" in esc.escalation_reason.lower()

    # Chief Pharmacist sees it in /oversight/escalations queue
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    q_res = client.get("/api/v1/oversight/escalations", headers=chief_headers)
    assert q_res.status_code == 200
    q_items = q_res.json()
    target_esc = next((e for e in q_items if e["prescription_id"] == high_conflict_prescription.id), None)
    assert target_esc is not None
    assert target_esc["escalation_id"] == esc.id
    assert target_esc["has_high_severity_finding"] is True


# =====================================================================
# 2. ROLE RESTRICTIONS & AUTHORIZATION
# =====================================================================

def test_student_and_unauthorized_review_denial(client, test_prescription):
    """Students cannot review, override, or escalate prescriptions (403 Forbidden)."""
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {student_token}"}

    # Student trying ACCEPT
    res_accept = client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "ACCEPT"},
        headers=headers,
    )
    assert res_accept.status_code == 403

    # Student trying OVERRIDE
    res_override = client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "OVERRIDE", "override_rationale": "Student rationale"},
        headers=headers,
    )
    assert res_override.status_code == 403

    # Student trying ESCALATE
    res_escalate = client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "ESCALATE"},
        headers=headers,
    )
    assert res_escalate.status_code == 403

    # Unauthenticated request
    res_unauth = client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "ACCEPT"},
    )
    assert res_unauth.status_code == 401


def test_staff_pharmacist_forbidden_from_escalation_resolution(client, db_session: Session, high_conflict_prescription):
    """Staff Pharmacists and Students cannot resolve escalations (403 Forbidden)."""
    # Create escalation first
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json={"action": "ESCALATE", "notes": "Need chief assistance"},
        headers=staff_headers,
    )

    resolution_payload = {
        "resolution_action": "APPROVED_BY_CHIEF",
        "resolution_notes": "Attempted resolution by unauthorized staff pharmacist",
    }

    # Staff pharmacist attempt -> 403
    res_staff = client.post(
        f"/api/v1/oversight/escalations/{high_conflict_prescription.id}/resolve",
        json=resolution_payload,
        headers=staff_headers,
    )
    assert res_staff.status_code == 403

    # Student attempt -> 403
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    student_headers = {"Authorization": f"Bearer {student_token}"}
    res_student = client.post(
        f"/api/v1/oversight/escalations/{high_conflict_prescription.id}/resolve",
        json=resolution_payload,
        headers=student_headers,
    )
    assert res_student.status_code == 403


# =====================================================================
# 3. ESCALATION RESOLUTION & REPEATED RESOLUTION GUARDS
# =====================================================================

def test_chief_pharmacist_escalation_resolution_actions(client, db_session: Session):
    """
    Chief Pharmacist resolves escalations using authorized actions:
    1. APPROVED_BY_CHIEF -> new prescription status is 'reviewed'
    2. REJECTED_RETURNED_TO_PRESCRIBER -> new prescription status is 'resolved'
    3. MODIFIED_AND_APPROVED -> new prescription status is 'resolved'
    """
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Test APPROVED_BY_CHIEF
    rx_approve = Prescription(
        id=str(uuid.uuid4()),
        prescription_number=f"RX-CHIEF-APP-{uuid.uuid4().hex[:6].upper()}",
        patient_id="pat-synth-001",
        prescriber_name="Dr. Specialist, MD",
        prescriber_department="Pulmonology",
        status="pending",
    )
    db_session.add(rx_approve)
    db_session.commit()

    # Escalate it
    client.post(
        f"/api/v1/prescriptions/{rx_approve.id}/review",
        json={"action": "ESCALATE", "notes": "Escalating for chief approval"},
        headers=staff_headers,
    )

    resolve_payload = {
        "resolution_action": "APPROVED_BY_CHIEF",
        "resolution_notes": "Reviewed clinical documentation and risk/benefit ratio. Approved for single inpatient dose under telemetry monitoring.",
    }
    res_resolve = client.post(
        f"/api/v1/oversight/escalations/{rx_approve.id}/resolve",
        json=resolve_payload,
        headers=chief_headers,
    )
    assert res_resolve.status_code == 200
    data = res_resolve.json()
    assert data["resolution_action"] == "APPROVED_BY_CHIEF"
    assert data["prescription_status"] == "reviewed"
    assert data["resolved_by"] == "chief_demo"

    db_session.refresh(rx_approve)
    assert rx_approve.status == "reviewed"

    # Verify audit event
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="ESCALATION_RESOLVED", entity_id=rx_approve.id)
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert audit.actor_username == "chief_demo"


def test_cannot_resolve_escalation_twice(client, db_session: Session):
    """An escalation cannot be resolved twice through repeated or concurrent requests (409 Conflict)."""
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    rx = Prescription(
        id=str(uuid.uuid4()),
        prescription_number=f"RX-DOUBLE-{uuid.uuid4().hex[:6].upper()}",
        patient_id="pat-synth-001",
        prescriber_name="Dr. Duplicate, MD",
        prescriber_department="Cardiology",
        status="pending",
    )
    db_session.add(rx)
    db_session.commit()

    # Escalate
    client.post(
        f"/api/v1/prescriptions/{rx.id}/review",
        json={"action": "ESCALATE", "notes": "Double resolution test"},
        headers=staff_headers,
    )

    resolve_payload = {
        "resolution_action": "REJECTED_RETURNED_TO_PRESCRIBER",
        "resolution_notes": "Prescription contains severe interaction; ordered discontinuation and substitution.",
    }

    # First resolution -> 200 OK
    first_res = client.post(
        f"/api/v1/oversight/escalations/{rx.id}/resolve",
        json=resolve_payload,
        headers=chief_headers,
    )
    assert first_res.status_code == 200

    # Second resolution attempt on the same prescription -> 409 Conflict
    second_res = client.post(
        f"/api/v1/oversight/escalations/{rx.id}/resolve",
        json=resolve_payload,
        headers=chief_headers,
    )
    assert second_res.status_code == 409
    assert "already been resolved" in second_res.json()["detail"].lower()


# =====================================================================
# 4. INVALID WORKFLOW STATE TRANSITIONS
# =====================================================================

def test_invalid_transitions_rejected(client, db_session: Session, test_prescription):
    """
    Invalid workflow state transitions must be rejected with 409 Conflict:
    1. Reviewing an already 'reviewed' prescription
    2. Reviewing an actively 'escalated' prescription directly
    3. Resolving a prescription that has no escalation record
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}

    # 1. Accept prescription -> moves to 'reviewed'
    client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "ACCEPT"},
        headers=staff_headers,
    )

    # Attempt second review on finalized prescription -> 409 Conflict
    res_second_review = client.post(
        f"/api/v1/prescriptions/{test_prescription.id}/review",
        json={"action": "OVERRIDE", "override_rationale": "Trying to override already reviewed"},
        headers=staff_headers,
    )
    assert res_second_review.status_code == 409
    assert "already been finalized" in res_second_review.json()["detail"].lower()

    # 2. Direct review on an actively escalated prescription
    rx_esc = Prescription(
        id=str(uuid.uuid4()),
        prescription_number=f"RX-ESC-TEST-{uuid.uuid4().hex[:6].upper()}",
        patient_id="pat-synth-001",
        prescriber_name="Dr. Esc, MD",
        prescriber_department="Medicine",
        status="pending",
    )
    db_session.add(rx_esc)
    db_session.commit()
    client.post(
        f"/api/v1/prescriptions/{rx_esc.id}/review",
        json={"action": "ESCALATE", "notes": "Now in escalated state"},
        headers=staff_headers,
    )

    # Attempt direct accept while escalated -> 409 Conflict
    res_direct_review = client.post(
        f"/api/v1/prescriptions/{rx_esc.id}/review",
        json={"action": "ACCEPT"},
        headers=staff_headers,
    )
    assert res_direct_review.status_code == 409
    assert "currently escalated" in res_direct_review.json()["detail"].lower()

    # 3. Resolve a prescription that has no escalation record -> 404
    res_no_esc = client.post(
        f"/api/v1/oversight/escalations/{test_prescription.id}/resolve",
        json={"resolution_action": "APPROVED_BY_CHIEF", "resolution_notes": "Notes for nonexistent escalation"},
        headers=chief_headers,
    )
    assert res_no_esc.status_code == 404


# =====================================================================
# 5. FINDING SNAPSHOT & HISTORICAL DECISION PRESERVATION
# =====================================================================

def test_preserves_finding_snapshot_across_reverification(client, db_session: Session, high_conflict_prescription):
    """
    Submitting a review decision snapshots all current findings to that review.
    Subsequent re-verification runs:
    - Never delete or modify the reviewed findings (review_id is not None)
    - Preserve the review decision, reviewer identity, rationale, and findings count
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Perform override
    override_payload = {
        "action": "OVERRIDE",
        "override_rationale": "Verified safe under controlled inpatient desensitization protocol.",
        "notes": "Reviewed with attending.",
    }
    rev_res = client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json=override_payload,
        headers=staff_headers,
    )
    assert rev_res.status_code == 200
    review_id = rev_res.json()["review_id"]

    # Verify findings are snapshotted to review_id
    snapshotted = (
        db_session.query(ReviewFinding)
        .filter_by(review_id=review_id)
        .all()
    )
    snapshotted_count = len(snapshotted)
    snapshotted_ids = {f.id for f in snapshotted}
    assert snapshotted_count > 0

    # Re-run verification engine with persist=True
    engine = VerificationEngine(db_session)
    engine.verify(high_conflict_prescription.id, persist=True)

    # Check that snapshotted findings remain completely intact
    after_verification = (
        db_session.query(ReviewFinding)
        .filter_by(review_id=review_id)
        .all()
    )
    assert len(after_verification) == snapshotted_count
    assert {f.id for f in after_verification} == snapshotted_ids

    # Query prescription reviews endpoint
    reviews_res = client.get(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/reviews",
        headers=staff_headers,
    )
    assert reviews_res.status_code == 200
    revs = reviews_res.json()
    assert len(revs) >= 1
    assert revs[0]["id"] == review_id
    assert revs[0]["action"] == "OVERRIDE"
    assert revs[0]["findings_count"] == snapshotted_count


# =====================================================================
# 6. TRANSACTION ROLLBACK INTEGRITY
# =====================================================================

def test_review_transaction_rollback_on_failure(client, db_session: Session, test_prescription):
    """
    If a database error occurs during review submission,
    the transaction is rolled back cleanly:
    - Prescription status remains 'pending'
    - No partial PharmacistReview record is committed
    - No unlinked audit event is persisted
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {staff_token}"}

    # Verify first so findings are already present
    engine = VerificationEngine(db_session)
    engine.verify(test_prescription.id, persist=True)

    initial_status = test_prescription.status
    initial_review_count = db_session.query(PharmacistReview).filter_by(prescription_id=test_prescription.id).count()

    # Simulate database commit error during review
    with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated DB Disk Full Error")):
        res = client.post(
            f"/api/v1/prescriptions/{test_prescription.id}/review",
            json={"action": "ACCEPT", "notes": "Will fail commit"},
            headers=headers,
        )
        assert res.status_code == 500
        assert "Database transaction failed" in res.json()["detail"]

    # Verify rollback
    db_session.refresh(test_prescription)
    assert test_prescription.status == initial_status
    current_review_count = db_session.query(PharmacistReview).filter_by(prescription_id=test_prescription.id).count()
    assert current_review_count == initial_review_count


def test_escalation_resolution_rollback_on_failure(client, db_session: Session, high_conflict_prescription):
    """
    If a database error occurs during escalation resolution,
    the transaction is rolled back cleanly:
    - Prescription status remains 'escalated'
    - Escalation record remains unresolved (resolved_at is None)
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}

    # Escalate first
    client.post(
        f"/api/v1/prescriptions/{high_conflict_prescription.id}/review",
        json={"action": "ESCALATE", "notes": "Rollback test escalation"},
        headers=staff_headers,
    )
    db_session.refresh(high_conflict_prescription)
    assert high_conflict_prescription.status == "escalated"

    esc = (
        db_session.query(EscalationResolution)
        .filter_by(prescription_id=high_conflict_prescription.id)
        .first()
    )
    assert esc is not None
    assert esc.resolved_at is None

    # Simulate database commit error during resolution
    with patch.object(db_session, "commit", side_effect=RuntimeError("Simulated DB Disk Full on Resolution")):
        res = client.post(
            f"/api/v1/oversight/escalations/{high_conflict_prescription.id}/resolve",
            json={"resolution_action": "APPROVED_BY_CHIEF", "resolution_notes": "Should fail and rollback"},
            headers=chief_headers,
        )
        assert res.status_code == 500
        assert "Database transaction failed" in res.json()["detail"]

    # Verify rollback preserved escalated status and unresolved escalation
    db_session.refresh(high_conflict_prescription)
    assert high_conflict_prescription.status == "escalated"
    db_session.refresh(esc)
    assert esc.resolved_at is None
