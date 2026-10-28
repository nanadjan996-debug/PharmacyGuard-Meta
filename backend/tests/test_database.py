"""Tests for Milestone 2: Database models, relationships, foreign-key integrity, and synthetic benchmark seed data."""
import pytest
from datetime import date
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.core.database import SessionLocal, get_db_context, Base, engine
from app.core.security import verify_password
from app.core.seed_data import seed_database
from app import models as _models  # noqa: F401
from app.models.user import User, Role, UserRole
from app.models.patient import SyntheticPatient, PatientDiagnosis, PatientAllergy
from app.models.reference import MedicationReference, IndicationRule, AllergyCrossReactivityRule, DrugInteractionRule
from app.models.prescription import Prescription, PrescriptionItem
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.review import PharmacistReview, ReviewFinding
from app.models.audit import AuditEvent
from app.models.education import EducationalCase, StudentSubmission


@pytest.fixture(scope="module")
def db_session():
    """Module-level session with initialized and seeded data."""
    Base.metadata.create_all(bind=engine)
    with get_db_context() as db:
        seed_database(db)
        yield db




def test_seed_idempotency(db_session):
    """Running seed_database a second time must not duplicate any records."""
    second_run_stats = seed_database(db_session)
    for key, count in second_run_stats.items():
        assert count == 0, f"Expected 0 new {key} on re-seed, but got {count}"


def test_roles_and_demo_users(db_session):
    """Verify distinct demo users for staff pharmacist, chief pharmacist, and student exist with hashed credentials."""
    users = db_session.query(User).all()
    user_map = {u.username: u for u in users}

    assert "pharmacist_demo" in user_map
    assert "chief_demo" in user_map
    assert "student_demo" in user_map

    # Test bcrypt verification for staff pharmacist
    staff = user_map["pharmacist_demo"]
    assert staff.full_name == "Sarah Lin, PharmD"
    assert verify_password("StaffDemoPassword2026!", staff.hashed_password) is True
    assert verify_password("wrong_password", staff.hashed_password) is False
    assert len(staff.roles) == 1
    assert staff.roles[0].role_id == "staff_pharmacist"

    # Test chief pharmacist
    chief = user_map["chief_demo"]
    assert chief.full_name == "Marcus Vance, PharmD, BCPS"
    assert verify_password("ChiefDemoPassword2026!", chief.hashed_password) is True
    assert len(chief.roles) == 1
    assert chief.roles[0].role_id == "chief_pharmacist"

    # Test student
    student = user_map["student_demo"]
    assert student.full_name == "Alex Rivera, P3 Pharmacy Candidate"
    assert verify_password("StudentDemoPassword2026!", student.hashed_password) is True
    assert len(student.roles) == 1
    assert student.roles[0].role_id == "pharmacy_student"


def test_five_synthetic_benchmark_scenarios(db_session):
    """Verify all 5 blueprint benchmark prescriptions exist with their synthetic patients and findings."""
    scenarios = db_session.query(Prescription).order_by(Prescription.prescription_number).all()
    scenario_map = {rx.scenario_key: rx for rx in scenarios}

    # Scenario 1: Clean Demo Case
    rx1 = scenario_map.get("SCENARIO_1_CLEAN")
    assert rx1 is not None
    assert rx1.patient.mrn == "SYNTH-MRN-001"
    assert rx1.patient.first_name == "Arthur"
    assert len(rx1.items) == 1
    assert rx1.items[0].medication_id == "MED-LIS-10"
    assert any(f.status == "CLEAN" for f in rx1.findings)

    # Scenario 2: Indication Review Required
    rx2 = scenario_map.get("SCENARIO_2_INDICATION")
    assert rx2 is not None
    assert rx2.patient.mrn == "SYNTH-MRN-002"
    assert rx2.patient.first_name == "Beatrice"
    assert rx2.items[0].medication_id == "MED-MET-500"
    assert any(f.category == "INDICATION" and f.status == "REVIEW_REQUIRED" for f in rx2.findings)

    # Scenario 3: Severe Allergy Conflict
    rx3 = scenario_map.get("SCENARIO_3_ALLERGY")
    assert rx3 is not None
    assert rx3.patient.mrn == "SYNTH-MRN-003"
    assert rx3.patient.first_name == "Charles"
    assert len(rx3.patient.allergies) == 1
    assert rx3.patient.allergies[0].allergen == "Penicillin"
    assert rx3.items[0].medication_id == "MED-AMOX-500"
    assert any(f.category == "ALLERGY" and f.severity == "HIGH" for f in rx3.findings)

    # Scenario 4: Duplicate Systemic NSAID Therapy
    rx4 = scenario_map.get("SCENARIO_4_DUPLICATE_NSAID")
    assert rx4 is not None
    assert rx4.patient.mrn == "SYNTH-MRN-004"
    assert rx4.patient.first_name == "Diana"
    assert len(rx4.items) == 2
    med_ids = {item.medication_id for item in rx4.items}
    assert "MED-KETO-10" in med_ids
    assert "MED-IBU-600" in med_ids
    assert any(f.category == "THERAPEUTIC_DUPLICATION" and f.severity == "HIGH" for f in rx4.findings)

    # Scenario 5: Polypharmacy with Simulated Stock Shortage
    rx5 = scenario_map.get("SCENARIO_5_STOCK_SHORTAGE")
    assert rx5 is not None
    assert rx5.patient.mrn == "SYNTH-MRN-005"
    assert rx5.patient.first_name == "Edward"
    assert len(rx5.items) == 2
    assert any(f.category == "INVENTORY" and f.severity == "HIGH" for f in rx5.findings)


def test_inventory_tracking_and_low_stock(db_session):
    """Verify inventory items, tracking, and low-stock computation."""
    cefdinir_inv = db_session.query(InventoryItem).filter_by(medication_id="MED-CEF-500").first()
    assert cefdinir_inv is not None
    assert cefdinir_inv.quantity_on_hand == 12
    assert cefdinir_inv.reorder_threshold == 25
    assert cefdinir_inv.is_low_stock is True  # 12 <= 25

    lisinopril_inv = db_session.query(InventoryItem).filter_by(medication_id="MED-LIS-10").first()
    assert lisinopril_inv is not None
    assert lisinopril_inv.quantity_on_hand == 350
    assert lisinopril_inv.reorder_threshold == 50
    assert lisinopril_inv.is_low_stock is False


def test_educational_cases(db_session):
    """Verify separate educational case tiers for pharmacy students."""
    cases = db_session.query(EducationalCase).all()
    assert len(cases) >= 3

    case_codes = {c.case_code for c in cases}
    assert "CASE-BEG-01" in case_codes
    assert "CASE-INT-01" in case_codes
    assert "CASE-ADV-01" in case_codes

    for c in cases:
        assert c.difficulty in ["BEGINNER", "INTERMEDIATE", "ADVANCED"]
        assert c.predefined_answer in ["REJECT", "APPROVE_WITH_MONITORING", "OVERRIDE_WITH_RATIONALE", "ESCALATE"]
        assert len(c.predefined_explanation) > 50


def test_foreign_key_enforcement(db_session):
    """Verify that foreign key constraints are strictly enforced in SQLite."""
    # Attempting to insert a PrescriptionItem referencing a non-existent medication must raise IntegrityError
    invalid_item = PrescriptionItem(
        prescription_id="rx-synth-001",
        medication_id="MED-DOES-NOT-EXIST-999",
        dose_amount=10.0,
        dose_unit="mg",
        frequency="Daily",
        route="Oral",
        duration_days=5,
        quantity_prescribed=5,
        instructions="Take 1",
    )
    db_session.add(invalid_item)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_cascade_delete_integrity(db_session):
    """Verify cascading deletions delete associated child items without orphan records."""
    # Create a temporary test prescription
    p = db_session.query(SyntheticPatient).first()
    temp_rx = Prescription(
        prescription_number="RX-TEMP-TEST-001",
        patient_id=p.id,
        prescriber_name="Test Doctor",
        prescriber_department="Test Dept",
        status="pending",
    )
    db_session.add(temp_rx)
    db_session.flush()

    item = PrescriptionItem(
        prescription_id=temp_rx.id,
        medication_id="MED-LIS-10",
        dose_amount=10.0,
        dose_unit="mg",
        frequency="Once daily",
        route="Oral",
        duration_days=10,
        quantity_prescribed=10,
        instructions="Test instructions",
    )
    finding = ReviewFinding(
        prescription_id=temp_rx.id,
        rule_identifier="TEST-RULE-001",
        category="DOSAGE",
        severity="INFO",
        status="CLEAN",
        evidence="Test finding",
        rule_source="Test Source",
        human_review_required=False,
    )
    db_session.add(item)
    db_session.add(finding)
    db_session.commit()

    temp_rx_id = temp_rx.id
    # Ensure items exist
    assert db_session.query(PrescriptionItem).filter_by(prescription_id=temp_rx_id).count() == 1
    assert db_session.query(ReviewFinding).filter_by(prescription_id=temp_rx_id).count() == 1

    # Delete parent prescription
    db_session.delete(temp_rx)
    db_session.commit()

    # Verify children were cascade-deleted
    assert db_session.query(PrescriptionItem).filter_by(prescription_id=temp_rx_id).count() == 0
    assert db_session.query(ReviewFinding).filter_by(prescription_id=temp_rx_id).count() == 0


def test_append_only_audit_log(db_session):
    """Verify append-only audit log contains system events with JSON details."""
    audit_events = db_session.query(AuditEvent).all()
    assert len(audit_events) >= 1
    init_event = db_session.query(AuditEvent).filter_by(action="SYSTEM_DATABASE_INITIALIZED").first()
    assert init_event is not None
    assert init_event.actor_username == "SYSTEM"
    assert "synthetic" in init_event.details
