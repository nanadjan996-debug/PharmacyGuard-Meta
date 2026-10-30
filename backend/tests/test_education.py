"""Automated test suite for Milestone 7: Educational Simulation Backend (Audit & Scoring Remediation)."""
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
# 2. CONTENT-BASED REASONING RUBRIC (NO LENGTH BIAS)
# =====================================================================

def test_short_complete_reasoning_gets_full_credit(client):
    """
    Content-based rubric: A short explanation mentioning all required clinical elements
    must receive full credit (20/20) with zero character-count penalty.
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Short (98 chars) but complete explanation hitting:
    # 1. Structural beta-lactam cross-reactivity
    # 2. Severe anaphylaxis / ICU history
    # 3. Absolute contraindication / order rejection
    short_reasoning = "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated."
    payload = {
        "determination": "REJECT",
        "reasoning": short_reasoning,
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    feedback = res.json()["feedback"]

    assert feedback["reasoning_score"] == 20
    assert len(feedback["correctly_identified_reasoning_elements"]) == 3
    assert len(feedback["missed_reasoning_elements"]) == 0
    assert "Full credit" in feedback["reasoning_feedback"]
    assert res.json()["score_awarded"] == 100


def test_long_irrelevant_reasoning_receives_no_bonus(client):
    """
    Content-based rubric: A long, rambling explanation (>300 chars) that does not identify
    any required clinical reasoning elements must receive 0 reasoning points.
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    rambling_reasoning = (
        "The patient presented to the ambulatory care facility on a Tuesday afternoon reporting fatigue "
        "and seasonal nasal congestion. The weather in October has been particularly damp and cold, leading "
        "to higher clinic volumes across all departments. The attending physician completed routine vital signs "
        "and noted normal oxygen saturation. The electronic health record was updated following standard documentation "
        "protocols and hospital pharmacy intake policies."
    )
    assert len(rambling_reasoning) > 300

    payload = {
        "determination": "REJECT",
        "reasoning": rambling_reasoning,
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    feedback = res.json()["feedback"]

    assert feedback["reasoning_score"] == 0
    assert len(feedback["correctly_identified_reasoning_elements"]) == 0
    assert len(feedback["missed_reasoning_elements"]) == 3
    assert "No credit" in feedback["reasoning_feedback"]
    # Total score = 50 (det) + 30 (issues) + 0 (reasoning) = 80
    assert res.json()["score_awarded"] == 80


def test_partial_reasoning_receives_partial_credit(client):
    """
    Content-based rubric: Identifying some but not all reasoning elements awards partial credit
    and itemizes which elements were identified versus missed.
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Mentions beta-lactam cross-reactivity (+7 pts) but omits anaphylaxis history and contraindication
    partial_reasoning = "Amoxicillin has known beta-lactam cross-reactivity with the penicillin drug class."
    payload = {
        "determination": "REJECT",
        "reasoning": partial_reasoning,
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    feedback = res.json()["feedback"]

    assert feedback["reasoning_score"] == 7
    assert "Structural Beta-Lactam Cross-Reactivity" in feedback["correctly_identified_reasoning_elements"]
    assert "Severe Anaphylaxis / ICU History" in feedback["missed_reasoning_elements"]
    assert "Absolute Contraindication & Order Rejection" in feedback["missed_reasoning_elements"]
    assert "Partial credit" in feedback["reasoning_feedback"]


# =====================================================================
# 3. CASE-SPECIFIC DETERMINATIONS & ACCEPTABLE ALTERNATIVES
# =====================================================================

def test_case_specific_preferred_determinations(client):
    """
    Each case explicitly defines a preferred determination:
    - CASE-BEG-01: Preferred is REJECT (50 pts, status PREFERRED)
    - CASE-INT-01: Preferred is REJECT (50 pts, status PREFERRED)
    - CASE-ADV-01: Preferred is REJECT (50 pts, status PREFERRED)
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # Case 1
    p1 = {
        "determination": "REJECT",
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    r1 = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=p1, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["feedback"]["determination_status"] == "PREFERRED"
    assert r1.json()["feedback"]["determination_score"] == 50
    assert r1.json()["feedback"]["determination_correct"] is True

    # Case 2
    p2 = {
        "determination": "REJECT",
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) have analgesic ceiling effect and compounded GI bleeding risks.",
        "identified_issues": ["DUPLICATE_THERAPY"],
    }
    r2 = client.post("/api/v1/education/cases/CASE-INT-01/submit", json=p2, headers=headers)
    assert r2.status_code == 200
    assert r2.json()["feedback"]["determination_status"] == "PREFERRED"
    assert r2.json()["feedback"]["determination_score"] == 50

    # Case 3
    p3 = {
        "determination": "REJECT",
        "reasoning": "No documented Type 2 Diabetes indication. Prescribing 2000 mg/day exceeds max threshold for eGFR 38 mL/min (CKD Stage 3b) risking lactic acidosis.",
        "identified_issues": ["INDICATION", "DOSAGE"],
    }
    r3 = client.post("/api/v1/education/cases/CASE-ADV-01/submit", json=p3, headers=headers)
    assert r3.status_code == 200
    assert r3.json()["feedback"]["determination_status"] == "PREFERRED"
    assert r3.json()["feedback"]["determination_score"] == 50


def test_case_specific_acceptable_alternatives(client):
    """
    Acceptable alternatives are evaluated per-case:
    - ESCALATE is an explicitly configured acceptable alternative across the 3 demo cases (25 pts, status ACCEPTABLE_ALTERNATIVE)
    - Feedback distinguishes preferred from acceptable alternative
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "determination": "ESCALATE",
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis is contraindicated so escalating to Chief Pharmacist.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200
    fb = res.json()["feedback"]

    assert fb["determination_status"] == "ACCEPTABLE_ALTERNATIVE"
    assert fb["determination_score"] == 25
    assert fb["determination_correct"] is False  # Only preferred determination is marked fully correct
    assert "Acceptable alternative determination" in fb["determination_feedback"]
    assert "REJECT" in fb["determination_feedback"]


def test_unsupported_alternative_receives_zero_credit(client):
    """
    Determinations that are neither preferred nor an explicitly configured alternative
    receive 0 points and are marked UNSUPPORTED.
    """
    token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. OVERRIDE_WITH_RATIONALE is UNSUPPORTED for severe penicillin anaphylaxis
    payload_override = {
        "determination": "OVERRIDE_WITH_RATIONALE",
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis is contraindicated.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    res1 = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload_override, headers=headers)
    assert res1.status_code == 200
    fb1 = res1.json()["feedback"]
    assert fb1["determination_status"] == "UNSUPPORTED"
    assert fb1["determination_score"] == 0
    assert fb1["determination_correct"] is False
    assert "Unsafe or unsupported determination" in fb1["determination_feedback"]

    # 2. APPROVE_WITH_MONITORING is UNSUPPORTED for dual NSAIDs
    payload_mon = {
        "determination": "APPROVE_WITH_MONITORING",
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) have analgesic ceiling effect.",
        "identified_issues": ["DUPLICATE_THERAPY"],
    }
    res2 = client.post("/api/v1/education/cases/CASE-INT-01/submit", json=payload_mon, headers=headers)
    assert res2.status_code == 200
    fb2 = res2.json()["feedback"]
    assert fb2["determination_status"] == "UNSUPPORTED"
    assert fb2["determination_score"] == 0


# =====================================================================
# 4. SUBMISSION RBAC: STUDENTS ONLY (STAFF & CHIEF DENIED)
# =====================================================================

def test_submission_authorization_roles(client):
    """
    Role restriction on educational submissions:
    - Pharmacy Student: Authorized (200 OK)
    - Staff Pharmacist: Forbidden (403)
    - Chief Pharmacist: Forbidden (403)
    - Unauthenticated: Unauthorized (401)
    """
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")

    payload = {
        "determination": "REJECT",
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }

    # 1. Student succeeds
    res_student = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json=payload,
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert res_student.status_code == 200

    # 2. Staff Pharmacist denied (403 Forbidden)
    res_staff = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json=payload,
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res_staff.status_code == 403
    assert "pharmacy_student" in res_staff.json()["detail"].lower()

    # 3. Chief Pharmacist denied (403 Forbidden)
    res_chief = client.post(
        "/api/v1/education/cases/CASE-BEG-01/submit",
        json=payload,
        headers={"Authorization": f"Bearer {chief_token}"},
    )
    assert res_chief.status_code == 403
    assert "pharmacy_student" in res_chief.json()["detail"].lower()

    # 4. Unauthenticated denied (401 Unauthorized)
    res_unauth = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload)
    assert res_unauth.status_code == 401


# =====================================================================
# 5. INPUT VALIDATION & ERROR HANDLING
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
# 6. DUPLICATE SUBMISSION BEHAVIOR & SUBMISSION HISTORY
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

    # Attempt 1: Partial score (ESCALATE)
    payload_1 = {
        "determination": "ESCALATE",
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) have analgesic ceiling effect. GI bleeding risk requires escalation.",
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
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) have analgesic ceiling effect and compounded GI bleeding risks.",
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
# 7. SUBMISSION OWNERSHIP ENFORCEMENT
# =====================================================================

def test_submission_ownership_enforcement_between_students(client, db_session: Session):
    """
    Strict ownership guard:
    - Student A cannot view Student B's submission detail (403 Forbidden)
    - Student A can view their own submission (200 OK)
    - Unauthenticated access is rejected (401 Unauthorized)
    """
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
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated.",
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
# 8. STRICT SEPARATION FROM OPERATIONAL WORKFLOWS
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

    rx1 = db_session.query(Prescription).filter_by(id="rx-synth-001").first()
    initial_status = rx1.status
    initial_findings_count = len(rx1.findings)

    inv_amox = db_session.query(InventoryItem).filter_by(medication_id="MED-AMOX-500").first()
    initial_inv_qty = inv_amox.quantity_on_hand

    # Submit educational case for CASE-BEG-01
    payload = {
        "determination": "REJECT",
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated.",
        "identified_issues": ["ALLERGY_CROSS_REACTIVITY"],
    }
    res = client.post("/api/v1/education/cases/CASE-BEG-01/submit", json=payload, headers=headers)
    assert res.status_code == 200

    # Operational prescription unmodified
    db_session.refresh(rx1)
    assert rx1.status == initial_status
    assert len(rx1.findings) == initial_findings_count

    # Inventory unmodified
    db_session.refresh(inv_amox)
    assert inv_amox.quantity_on_hand == initial_inv_qty

    # Educational case ID cannot retrieve operational prescription
    assert client.get("/api/v1/prescriptions/CASE-BEG-01", headers=staff_headers).status_code == 404
    assert client.get("/api/v1/prescriptions/edu-case-001", headers=staff_headers).status_code == 404


# =====================================================================
# 9. PHARMACIST OVERSIGHT & IMMUTABILITY
# =====================================================================

def test_pharmacist_oversight_and_immutability(client, db_session: Session):
    """
    Supervisory oversight and academic record immutability:
    - Staff Pharmacists and Chief Pharmacists can browse cases
    - Chief Pharmacists can inspect student submissions for supervisory academic review
    - Staff Pharmacists cannot inspect student submissions (403 Forbidden)
    - Submissions cannot be updated or deleted via ORM (raises PermissionError)
    """
    staff_token = get_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_token = get_token(client, "chief_demo", "ChiefDemoPassword2026!")
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    student_token = get_token(client, "student_demo", "StudentDemoPassword2026!")
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Staff and Chief can browse cases
    assert client.get("/api/v1/education/cases", headers=staff_headers).status_code == 200
    assert client.get("/api/v1/education/cases", headers=chief_headers).status_code == 200

    # 2. Student submits a case
    payload = {
        "determination": "REJECT",
        "reasoning": "Dual systemic NSAIDs (Ketorolac + Ibuprofen) have analgesic ceiling effect and compounded GI bleeding risks.",
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

    # 4. Staff Pharmacist cannot inspect student's submission (403 Forbidden)
    staff_sub_res = client.get(f"/api/v1/education/submissions/{sub_id}", headers=staff_headers)
    assert staff_sub_res.status_code == 403

    # 5. ORM immutability check
    sub = db_session.query(StudentSubmission).filter_by(id=sub_id).first()
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
        "reasoning": "Beta-lactam cross-reactivity with severe penicillin anaphylaxis makes amoxicillin contraindicated.",
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
