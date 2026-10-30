"""Automated test suite for Milestone 7: Educational Simulation Backend."""
import json
from unittest.mock import patch
import pytest
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.education import EducationalCase, StudentSubmission
from app.models.prescription import Prescription
from app.models.inventory import InventoryItem
from app.models.audit import AuditEvent


def get_token(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


# =====================================================================
# 1. CASE LISTING, DETAIL & HIDDEN CRITERIA PROTECTION
# =====================================================================

def test_student_case_listing(client):
    """
    GET /api/v1/education/cases:
    - Lists synthetic cases available for pharmacy students
    - Includes case ID, title, difficulty, category, learning objectives, completion status
    - Answer keys and hidden evaluation criteria are strictly stripped
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/education/cases", headers=headers)
    assert res.status_code == 200
    cases = res.json()
    assert len(cases) >= 3

    case_codes = [c["case_code"] for c in cases]
    assert "CASE-BEG-01" in case_codes
    assert "CASE-INT-01" in case_codes
    assert "CASE-ADV-01" in case_codes

    for c in cases:
        assert "id" in c
        assert "case_code" in c
        assert "title" in c
        assert "difficulty" in c
        assert "category" in c
        assert "learning_objectives" in c
        assert len(c["learning_objectives"]) >= 1
        assert c["completion_status"] in ["COMPLETED", "NOT_ATTEMPTED"]
        assert "is_completed" in c
        assert "attempts_count" in c
        assert "disclaimer" in c
        assert "Advisory" in c["disclaimer"]

        # Hidden answer criteria MUST NOT be exposed
        assert "predefined_answer" not in c
        assert "predefined_explanation" not in c
        assert "key_learning_points" not in c


def test_case_detail_access_and_hidden_criteria_protection(client):
    """
    GET /api/v1/education/cases/{case_id}:
    - Returns patient summary, prescription summary, and clinical scenario
    - Resolves by case_code or UUID
    - Hidden answer criteria and grading rubrics are strictly excluded
    - Unknown case ID returns 404
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # By case_code
    res1 = client.get("/api/v1/education/cases/CASE-BEG-01", headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["case_code"] == "CASE-BEG-01"
    assert data1["difficulty"] == "BEGINNER"
    assert "patient_summary" in data1
    assert "prescription_summary" in data1
    assert "clinical_scenario" in data1
    assert "available_determinations" in data1
    assert "REJECT" in data1["available_determinations"]

    # Hidden criteria MUST NOT be present in detail response
    assert "predefined_answer" not in data1
    assert "predefined_explanation" not in data1
    assert "key_learning_points" not in data1

    # By UUID
    res2 = client.get(f"/api/v1/education/cases/{data1['id']}", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["case_code"] == "CASE-BEG-01"

    # Unknown case returns 404
    res_404 = client.get("/api/v1/education/cases/CASE-NONEXISTENT", headers=headers)
    assert res_404.status_code == 404


# =====================================================================
# 2. VALID SUBMISSION, FULL SCORING & PEDAGOGICAL FEEDBACK
# =====================================================================

def test_valid_student_submission_full_score(client):
    """
    POST /api/v1/education/cases/{case_id}/submit:
    - Student submits accurate assessment for CASE-BEG-01
    - Correct determination (50 pts) + accurate issue identification (30 pts) + substantive rationale (20 pts) = 100 pts
    - Evaluates against configured demonstration rules (RULE-ALG-PEN-01)
    - Returns transparent feedback, clinical rationale, learning points, and limitations statement
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "determination": "REJECT",
        "reasoning": (
            "Amoxicillin is an amino-penicillin that shares the beta-lactam core. "
            "In a patient with documented severe anaphylaxis to penicillin requiring ICU care, "
            "direct penicillins are strictly contraindicated. The order must be rejected immediately."
        ),
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    sub = res.json()

    assert sub["case_code"] == "CASE-BEG-01"
    assert sub["submitted_determination"] == "REJECT"
    assert sub["is_correct"] is True
    assert sub["score_awarded"] == 100
    assert sub["attempt_number"] >= 1

    feedback = sub["feedback"]
    assert feedback["determination_correct"] is True
    assert feedback["determination_score"] == 50
    assert feedback["issue_identification_score"] == 30
    assert feedback["reasoning_score"] == 20
    assert feedback["total_score"] == 100
    assert "ALLERGY_CROSS_REACTIVITY" in feedback["correctly_identified_issues"]
    assert len(feedback["missed_issues"]) == 0

    # Demo rule linkage
    assert len(feedback["expected_rules"]) >= 1
    rule = feedback["expected_rules"][0]
    assert rule["rule_identifier"] == "RULE-ALG-PEN-01"
    assert rule["severity"] == "HIGH"

    # Educational limitations and learning points
    assert len(feedback["key_learning_points"]) >= 1
    assert "Educational Simulation Boundary Notice" in feedback["educational_limitations"]
    assert "Advisory educational simulation prototype" in sub["disclaimer"]


# =====================================================================
# 3. INPUT VALIDATION & ERROR HANDLING
# =====================================================================

def test_invalid_submission_validation(client):
    """
    Input validation guards:
    - Empty or whitespace reasoning rejected (422)
    - Reasoning under 10 chars rejected (422)
    - Invalid determination choice rejected (422)
    - Submitting to unknown case rejected (404)
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Reasoning too short (<10 chars)
    res_short = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json={"determination": "REJECT", "reasoning": "Too short"},
        headers=headers,
    )
    assert res_short.status_code == 422

    # 2. Whitespace reasoning
    res_ws = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json={"determination": "REJECT", "reasoning": "          "},
        headers=headers,
    )
    assert res_ws.status_code == 422

    # 3. Invalid determination
    res_inv = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json={"determination": "IGNORE_AND_DISPENSE", "reasoning": "Valid clinical reasoning provided here."},
        headers=headers,
    )
    assert res_inv.status_code == 422

    # 4. Non-existent case
    res_404 = client.post(
        "/api/v1/education/cases/CASE-NOT-REAL/submit",
        json={"determination": "REJECT", "reasoning": "Valid clinical reasoning provided here."},
        headers=headers,
    )
    assert res_404.status_code == 404


# =====================================================================
# 4. PARTIAL SCORING & INCORRECT SUBMISSIONS
# =====================================================================

def test_partial_scoring_escalate_and_partial_issues(client):
    """
    Partial scoring logic:
    - Submitting ESCALATE when expected is REJECT awards 25/50 for determination (halts dispensing, but misses direct rejection)
    - Identifying 1 of 2 expected issues awards 15/30 for issue identification
    - Transparent feedback explains what was missed
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Case 1: ESCALATE instead of REJECT for CASE-BEG-01
    payload_esc = {
        "determination": "ESCALATE",
        "reasoning": "Patient has severe penicillin allergy; escalating order to Chief Pharmacist for review.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    res_esc = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload_esc, headers=headers)
    assert res_esc.status_code == 200
    esc_data = res_esc.json()
    assert esc_data["is_correct"] is False  # Must have correct determination to pass
    assert esc_data["feedback"]["determination_score"] == 25  # Partial credit
    assert esc_data["feedback"]["issue_identification_score"] == 30
    assert esc_data["score_awarded"] == 75
    assert "Partially correct" in esc_data["feedback"]["determination_feedback"]

    # Case 2: CASE-ADV-01 has 2 expected issues (INDICATION and DOSAGE)
    # Student identifies INDICATION but misses DOSAGE
    payload_adv = {
        "determination": "REJECT",
        "reasoning": "Patient has no documented Type 2 Diabetes diagnosis in active problem list. Indication is missing.",
        "identified_issues": ["INDICATION"],
    }
    res_adv = client.post("/api/v1/education/cases/CASE-ADV-01/submit", json=payload_adv, headers=headers)
    assert res_adv.status_code == 200
    adv_data = res_adv.json()
    assert adv_data["feedback"]["determination_score"] == 50
    assert adv_data["feedback"]["issue_identification_score"] == 15  # 1 of 2 issues = 15 pts
    assert "INDICATION" in adv_data["feedback"]["correctly_identified_issues"]
    assert "DOSAGE" in adv_data["feedback"]["missed_issues"]


def test_completely_incorrect_submission(client):
    """
    Submitting APPROVE on a contraindicated case:
    - Determination score is 0
    - Identifying no issues gives 0
    - Total score reflects failure to intercept severe clinical hazard
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "determination": "APPROVE",
        "reasoning": "Looks okay to dispense without changes.",
    }
    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["is_correct"] is False
    assert data["feedback"]["determination_score"] == 0
    assert data["score_awarded"] <= 12


# =====================================================================
# 5. DUPLICATE SUBMISSION BEHAVIOR & SUBMISSION HISTORY
# =====================================================================

def test_duplicate_submission_behavior_and_history_preservation(client, db_session: Session):
    """
    Repeat submissions by the same student:
    - Multiple submissions for the same case create separate attempt records
    - Previous attempt scores and feedback are never overwritten
    - Case listing updates completion_status, attempts_count, and best_score
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Count prior submissions for CASE-INT-01
    prior_subs = db_session.query(StudentSubmission).filter_by(student_id="usr-student-001").all()
    prior_count = len(prior_subs)

    # Attempt 1: Partial score (ESCALATE)
    payload_1 = {
        "determination": "ESCALATE",
        "reasoning": "Dual NSAIDs (ketorolac and ibuprofen) ordered concurrently. Escalating to supervisor.",
        "identified_issues": ["DUPLICATE_THERAPY"],
    }
    res_1 = client.post("/api/v1/education/cases/CASE-INT-01/submit", json=payload_1, headers=headers)
    assert res_1.status_code == 200
    data_1 = res_1.json()
    attempt_1_id = data_1["id"]
    attempt_1_score = data_1["score_awarded"]

    # Attempt 2: Full score (REJECT)
    payload_2 = {
        "determination": "REJECT",
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) are contraindicated due to high risk of gastrointestinal bleeding and renal failure without additive analgesia.",
        "identified_issues": ["DUPLICATE_THERAPY"],
    }
    res_2 = client.post("/api/v1/education/cases/CASE-INT-01/submit", json=payload_2, headers=headers)
    assert res_2.status_code == 200
    data_2 = res_2.json()
    attempt_2_id = data_2["id"]
    attempt_2_score = data_2["score_awarded"]

    assert attempt_1_id != attempt_2_id
    assert data_2["attempt_number"] > data_1["attempt_number"]

    # Verify attempt 1 was NOT modified in the database
    sub1_in_db = db_session.query(StudentSubmission).filter_by(id=attempt_1_id).first()
    assert sub1_in_db.score_awarded == attempt_1_score
    assert sub1_in_db.submitted_determination == "ESCALATE"

    # Verify case listing reflects attempts and best score
    res_cases = client.get("/api/v1/education/cases", headers=headers)
    assert res_cases.status_code == 200
    case_int = next(c for c in res_cases.json() if c["case_code"] == "CASE-INT-01")
    assert case_int["completion_status"] == "COMPLETED"
    assert case_int["is_completed"] is True
    assert case_int["attempts_count"] >= 2
    assert case_int["best_score"] == max(attempt_1_score, attempt_2_score)


def test_student_submission_history_listing(client):
    """
    GET /api/v1/education/submissions:
    - Returns student's personal submission history ordered by newest first
    - Includes attempt numbers, scores, and determinations
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/education/submissions", headers=headers)
    assert res.status_code == 200
    history = res.json()
    assert len(history) >= 1

    for item in history:
        assert "id" in item
        assert "case_code" in item
        assert "submitted_determination" in item
        assert "score_awarded" in item
        assert "attempt_number" in item


# =====================================================================
# 6. SUBMISSION OWNERSHIP ENFORCEMENT
# =====================================================================

def test_submission_ownership_enforcement_between_students(client, db_session: Session):
    """
    Strict ownership guard:
    - Student A cannot view Student B's submission detail (403 Forbidden)
    - Student A can view their own submission (200 OK)
    - Unauthenticated access is rejected (401 Unauthorized)
    """
    # 1. Create a second student in test database
    student2 = db_session.query(User).filter_by(username="student_demo_2").first()
    if not student2:
        student2 = User(
            id="usr-student-002",
            username="student_demo_2",
            email="jordan.lee@pharmacyguard.demo",
            full_name="Jordan Lee, P2 Student",
            hashed_password=hash_password("Student2Password2026!"),
            is_active=True,
        )
        db_session.add(student2)
        db_session.flush()
        db_session.add(UserRole(user_id=student2.id, role_id="pharmacy_student"))
        db_session.commit()

    token1 = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers1 = {"Authorization": f"Bearer {token1}"}
    token2 = get_token(client, "student_demo_2", "Student2Password2026!")
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Student 1 submits
    payload = {
        "determination": "REJECT",
        "reasoning": "Amoxicillin contraindicated in severe penicillin allergy with anaphylaxis history.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    res_sub = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers1)
    assert res_sub.status_code == 200
    sub_id = res_sub.json()["id"]

    # Student 1 accesses own submission -> 200 OK
    res_own = client.get(f"/api/v1/education/submissions/{sub_id}", headers=headers1)
    assert res_own.status_code == 200
    assert res_own.json()["id"] == sub_id

    # Student 2 attempts to access Student 1's submission -> 403 Forbidden
    res_other = client.get(f"/api/v1/education/submissions/{sub_id}", headers=headers2)
    assert res_other.status_code == 403
    assert "students can only access their own submissions" in res_other.json()["detail"].lower()

    # Unauthenticated access -> 401 Unauthorized
    res_unauth = client.get(f"/api/v1/education/submissions/{sub_id}")
    assert res_unauth.status_code == 401


# =====================================================================
# 7. STRICT SEPARATION FROM OPERATIONAL WORKFLOWS
# =====================================================================

def test_student_access_to_operational_endpoints_denied(client):
    """
    Operational workflow isolation:
    Students must be strictly rejected (403 Forbidden) from:
    - Prescription verification queue
    - Prescription review actions
    - Prescription review audit history
    - Inventory viewing and mutation
    - Chief Pharmacist oversight and escalation queues
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Operational prescription queue
    assert client.get("/api/v1/prescriptions/queue", headers=headers).status_code == 403

    # 2. Operational prescription review action
    assert client.post(
        "/api/v1/prescriptions/rx-synth-001/review",
        json={"action": "ACCEPT"},
        headers=headers,
    ).status_code == 403

    # 3. Operational prescription reviews audit history
    assert client.get("/api/v1/prescriptions/rx-synth-001/reviews", headers=headers).status_code == 403

    # 4. Live inventory list
    assert client.get("/api/v1/inventory", headers=headers).status_code == 403

    # 5. Inventory transaction mutation
    assert client.post(
        "/api/v1/inventory/transactions",
        json={"medication_id": "MED-LIS-10", "transaction_type": "RESTOCK", "direction": "INCREASE", "quantity": 10},
        headers=headers,
    ).status_code == 403

    # 6. Oversight dashboard & escalations
    assert client.get("/api/v1/oversight/dashboard", headers=headers).status_code == 403
    assert client.get("/api/v1/oversight/escalations", headers=headers).status_code == 403


def test_educational_submission_does_not_mutate_operational_data(client, db_session: Session):
    """
    Cross-domain immutability:
    Submitting an educational case must NEVER:
    - Alter operational prescription status
    - Alter operational prescription findings
    - Mutate inventory balances
    - Allow educational case IDs to access operational prescription routes
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Capture initial state of operational prescription 1 and inventory
    rx1 = db_session.query(Prescription).filter_by(id="rx-synth-001").first()
    initial_status = rx1.status
    initial_findings_count = len(rx1.findings)

    inv_amox = db_session.query(InventoryItem).filter_by(medication_id="MED-AMOX-500").first()
    initial_inv_qty = inv_amox.quantity_on_hand

    # Submit educational case for CASE-BEG-01 (Amoxicillin case)
    payload = {
        "determination": "REJECT",
        "reasoning": "Amoxicillin contraindicated due to severe anaphylactic penicillin allergy.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200

    # Verify operational prescription 1 is completely unmodified
    db_session.refresh(rx1)
    assert rx1.status == initial_status
    assert len(rx1.findings) == initial_findings_count

    # Verify inventory is completely unmodified
    db_session.refresh(inv_amox)
    assert inv_amox.quantity_on_hand == initial_inv_qty

    # Verify educational case ID cannot be used to retrieve an operational prescription
    assert client.get("/api/v1/prescriptions/CASE-BEG-01", headers=staff_headers).status_code == 404
    assert client.get("/api/v1/prescriptions/edu-case-001", headers=staff_headers).status_code == 404


# =====================================================================
# 8. PHARMACIST ACCESS BEHAVIOR TO EDUCATIONAL ENDPOINTS
# =====================================================================

def test_pharmacist_access_behavior_to_education(client, db_session: Session):
    """
    Pharmacist permissions in educational simulation:
    - Staff Pharmacist and Chief Pharmacist can browse educational cases (200 OK)
    - Chief Pharmacist has academic supervisor authority to inspect student submissions (200 OK)
    - Staff Pharmacist cannot inspect student submissions (403 Forbidden)
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Staff Pharmacist and Chief Pharmacist can browse cases
    assert client.get("/api/v1/education/cases", headers=staff_headers).status_code == 200
    assert client.get("/api/v1/education/cases", headers=chief_headers).status_code == 200

    # 2. Student submits a case
    payload = {
        "determination": "REJECT",
        "reasoning": "Dual NSAIDs contraindicated due to ceiling effect and severe gastrointestinal hemorrhage risk.",
        "identified_issues": ["DUPLICATE_THERAPY"],
    }
    sub_res = client.post("/api/v1/education/cases/CASE-INT-01/submit", json=payload, headers=student_headers)
    assert sub_res.status_code == 200
    sub_id = sub_res.json()["id"]

    # 3. Chief Pharmacist can access student's submission for supervisory review
    chief_sub_res = client.get(f"/api/v1/education/submissions/{sub_id}", headers=chief_headers)
    assert chief_sub_res.status_code == 200
    assert chief_sub_res.json()["id"] == sub_id
    assert chief_sub_res.json()["student_name"] == "Alex Rivera, P3 Pharmacy Candidate"

    # 4. Staff Pharmacist cannot inspect another student's submission (403 Forbidden)
    staff_sub_res = client.get(f"/api/v1/education/submissions/{sub_id}", headers=staff_headers)
    assert staff_sub_res.status_code == 403


# =====================================================================
# 9. IMMUTABILITY, AUDIT TRAIL & TRANSACTION ROLLBACK
# =====================================================================

def test_submission_immutability_blocks_update_and_delete(db_session: Session):
    """
    ORM-level immutability for student submissions:
    Direct update or delete on StudentSubmission raises PermissionError
    """
    sub = db_session.query(StudentSubmission).first()
    assert sub is not None

    with pytest.raises(PermissionError, match="immutable"):
        sub.score_awarded = 999
        db_session.flush()

    db_session.rollback()

    with pytest.raises(PermissionError, match="cannot be deleted"):
        db_session.delete(sub)
        db_session.flush()

    db_session.rollback()


def test_audit_event_logged_and_rollback_on_failure(client, db_session: Session):
    """
    Audit logging and atomic transactional rollback:
    - Successful submission creates an append-only AuditEvent
    - Database failure during submission triggers complete rollback with zero partial writes
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "determination": "REJECT",
        "reasoning": "Amoxicillin contraindicated due to severe beta-lactam anaphylaxis history.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    initial_audits_count = db_session.query(AuditEvent).filter_by(action="STUDENT_CASE_SUBMITTED").count()

    # 1. Successful submission logs audit event
    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200

    new_audits_count = db_session.query(AuditEvent).filter_by(action="STUDENT_CASE_SUBMITTED").count()
    assert new_audits_count == initial_audits_count + 1

    latest_audit = (
        db_session.query(AuditEvent)
        .filter_by(action="STUDENT_CASE_SUBMITTED")
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert latest_audit.actor_username == "student_demo"
    details = json.loads(latest_audit.details)
    assert details["case_code"] == "CASE-BEG-01"
    assert "score_awarded" in details

    # 2. Simulated database commit failure triggers rollback
    initial_subs_count = db_session.query(StudentSubmission).count()
    with patch("sqlalchemy.orm.Session.commit", side_effect=RuntimeError("Simulated database failure")):
        res_fail = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
        assert res_fail.status_code == 500

    # Confirm no orphaned submission was persisted
    final_subs_count = db_session.query(StudentSubmission).count()
    assert final_subs_count == initial_subs_count

