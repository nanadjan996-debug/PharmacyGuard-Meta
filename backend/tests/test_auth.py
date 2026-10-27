"""Tests for Milestone 3: Authentication, JWT validation, server-side RBAC, and audit tracking."""
from datetime import timedelta
import pytest
from app.core.security import create_access_token, hash_password
from app.models.user import User, UserRole
from app.models.audit import AuditEvent
from app.models.prescription import Prescription
from app.models.inventory import InventoryItem


def get_token_for_user(client, username, password):
    res = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]


def test_valid_login_staff_pharmacist(client, db_session):
    """Test successful login for staff pharmacist account and audit log verification."""
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "pharmacist_demo", "password": "StaffDemoPassword2026!"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "pharmacist_demo"
    assert "staff_pharmacist" in data["user"]["roles"]

    # Verify audit event recorded without password or token
    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="LOGIN_SUCCESS", actor_username="pharmacist_demo")
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert "StaffDemoPassword2026!" not in audit.details
    assert data["access_token"] not in audit.details


def test_valid_login_chief_and_student(client):
    """Test successful login for chief pharmacist and pharmacy student accounts."""
    chief_res = client.post(
        "/api/v1/auth/login",
        json={"username": "chief_demo", "password": "ChiefDemoPassword2026!"},
    )
    assert chief_res.status_code == 200
    assert "chief_pharmacist" in chief_res.json()["user"]["roles"]

    student_res = client.post(
        "/api/v1/auth/login",
        json={"username": "student_demo", "password": "StudentDemoPassword2026!"},
    )
    assert student_res.status_code == 200
    assert "pharmacy_student" in student_res.json()["user"]["roles"]


def test_login_invalid_password_returns_generic_error(client, db_session):
    """Wrong password must return generic 401 message and log failed attempt."""
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "pharmacist_demo", "password": "IncorrectPassword123!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password"

    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="LOGIN_FAILED", actor_username="pharmacist_demo")
        .order_by(AuditEvent.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert "IncorrectPassword123!" not in audit.details


def test_login_unknown_user_returns_identical_generic_error(client, db_session):
    """Non-existent username must return identical 401 error to prevent username enumeration."""
    res = client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent_pharmacist_999", "password": "AnyPassword123!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid username or password"

    audit = (
        db_session.query(AuditEvent)
        .filter_by(action="LOGIN_FAILED", actor_username="nonexistent_pharmacist_999")
        .first()
    )
    assert audit is not None


def test_login_inactive_user_rejected(client, db_session):
    """Inactive users must be rejected with 403 Forbidden."""
    inactive_user = User(
        id="usr-inactive-test",
        username="inactive_demo_user",
        email="inactive@demo.test",
        full_name="Inactive Staff",
        hashed_password=hash_password("InactivePass123!"),
        is_active=False,
    )
    db_session.add(inactive_user)
    db_session.commit()

    res = client.post(
        "/api/v1/auth/login",
        json={"username": "inactive_demo_user", "password": "InactivePass123!"},
    )
    assert res.status_code == 403
    assert "inactive" in res.json()["detail"].lower()


def test_missing_and_malformed_tokens(client):
    """Endpoints requiring authentication must reject missing or malformed tokens."""
    # No Authorization header
    res1 = client.get("/api/v1/auth/me")
    assert res1.status_code == 401

    # Malformed / non-bearer header
    res2 = client.get("/api/v1/auth/me", headers={"Authorization": "Basic 12345"})
    assert res2.status_code == 401

    # Garbage token
    res3 = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-valid-token"})
    assert res3.status_code == 401
    assert "malformed" in res3.json()["detail"].lower() or "invalid" in res3.json()["detail"].lower()


def test_expired_token_rejected(client):
    """Expired JWT tokens must be rejected with 401."""
    expired_token = create_access_token(
        subject="usr-staff-001",
        username="pharmacist_demo",
        roles=["staff_pharmacist"],
        expires_delta=timedelta(seconds=-10),
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_auth_me_and_logout(client):
    """Test /me profile loading and /logout endpoint."""
    token = get_token_for_user(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {token}"}

    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "pharmacist_demo"

    logout_res = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert logout_res.json()["status"] == "logged_out"


def test_rbac_permission_matrix(client):
    """Verify role permissions across staff pharmacist, chief pharmacist, and student."""
    staff_token = get_token_for_user(client, "pharmacist_demo", "StaffDemoPassword2026!")
    chief_token = get_token_for_user(client, "chief_demo", "ChiefDemoPassword2026!")
    student_token = get_token_for_user(client, "student_demo", "StudentDemoPassword2026!")

    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    chief_headers = {"Authorization": f"Bearer {chief_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}

    # 1. Staff Pharmacist can view verification queue
    assert client.get("/api/v1/prescriptions/queue", headers=staff_headers).status_code == 200

    # 2. Student CANNOT view verification queue (403 Forbidden)
    assert client.get("/api/v1/prescriptions/queue", headers=student_headers).status_code == 403

    # 3. Staff Pharmacist CANNOT access Chief escalations (403 Forbidden)
    assert client.get("/api/v1/oversight/escalations", headers=staff_headers).status_code == 403

    # 4. Student CANNOT access Chief escalations (403 Forbidden)
    assert client.get("/api/v1/oversight/escalations", headers=student_headers).status_code == 403

    # 5. Chief Pharmacist CAN access escalations
    assert client.get("/api/v1/oversight/escalations", headers=chief_headers).status_code == 200

    # 6. Staff Pharmacist CANNOT adjust inventory (403 Forbidden)
    adj_payload = {"inventory_item_id": "inv-med-lis-10", "quantity_delta": 10, "reason": "Test restock"}
    assert client.post("/api/v1/oversight/inventory/adjust", json=adj_payload, headers=staff_headers).status_code == 403

    # 7. Student CANNOT adjust inventory (403 Forbidden)
    assert client.post("/api/v1/oversight/inventory/adjust", json=adj_payload, headers=student_headers).status_code == 403

    # 8. Chief Pharmacist CAN adjust inventory
    chief_adj = client.post("/api/v1/oversight/inventory/adjust", json=adj_payload, headers=chief_headers)
    assert chief_adj.status_code == 200
    assert chief_adj.json()["status"] == "success"


def test_student_forbidden_from_prescriptions_review(client):
    """Students calling clinical review endpoints directly must be blocked with 403 Forbidden."""
    student_token = get_token_for_user(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {student_token}"}

    payload = {"action": "ACCEPT", "notes": "Student trying to approve"}
    res = client.post("/api/v1/prescriptions/rx-synth-001/review", json=payload, headers=headers)
    assert res.status_code == 403


def test_high_priority_override_requires_written_rationale(client):
    """Overriding a prescription with HIGH severity finding requires a non-empty rationale."""
    staff_token = get_token_for_user(client, "pharmacist_demo", "StaffDemoPassword2026!")
    headers = {"Authorization": f"Bearer {staff_token}"}

    # rx-synth-003 has a HIGH severity allergy conflict
    # Attempt override with missing / empty rationale -> must be rejected with 422 Unprocessable Entity
    invalid_override = {"action": "OVERRIDE", "override_rationale": "   "}
    res_rejected = client.post(
        "/api/v1/prescriptions/rx-synth-003/review",
        json=invalid_override,
        headers=headers,
    )
    assert res_rejected.status_code == 422
    assert "rationale is mandatory" in res_rejected.json()["detail"].lower()

    # Valid override with written rationale -> 200 OK
    valid_override = {
        "action": "OVERRIDE",
        "override_rationale": "Patient underwent supervised desensitization protocol in allergy clinic; cleared for oral challenge under observation.",
    }
    res_accepted = client.post(
        "/api/v1/prescriptions/rx-synth-003/review",
        json=valid_override,
        headers=headers,
    )
    assert res_accepted.status_code == 200
    assert res_accepted.json()["new_status"] == "overridden"


def test_student_educational_case_submission(client):
    """Students can access educational cases and submit clinical determinations."""
    student_token = get_token_for_user(client, "student_demo", "StudentDemoPassword2026!")
    headers = {"Authorization": f"Bearer {student_token}"}

    cases_res = client.get("/api/v1/education/cases", headers=headers)
    assert cases_res.status_code == 200
    cases = cases_res.json()
    assert len(cases) >= 3

    target_case = next(c for c in cases if c["case_code"] == "CASE-BEG-01")

    # Submit student determination
    sub_payload = {
        "determination": "REJECT",
        "reasoning": "Amoxicillin shares the core beta-lactam ring with penicillin. In severe anaphylaxis, direct cross-allergenicity is contraindicated.",
    }
    sub_res = client.post(f"/api/v1/education/cases/{target_case['id']}/submit", json=sub_payload, headers=headers)
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    assert sub_data["is_correct"] is True
    assert sub_data["score_awarded"] == 100
    assert len(sub_data["predefined_explanation"]) > 30


def test_audit_event_immutability(db_session):
    """Ensure that modifying or deleting an AuditEvent raises PermissionError at the ORM layer."""
    event = db_session.query(AuditEvent).first()
    assert event is not None

    # Attempt to modify
    event.action = "TAMPERED_ACTION"
    with pytest.raises(PermissionError) as exc_info:
        db_session.flush()
    assert "immutable" in str(exc_info.value).lower()
    db_session.rollback()

    # Attempt to delete
    event = db_session.query(AuditEvent).first()
    db_session.delete(event)
    with pytest.raises(PermissionError) as exc_info:
        db_session.flush()
    assert "append-only" in str(exc_info.value).lower()
    db_session.rollback()
