"""Automated test suite for Meta Muse Spark Open AI Explanation via Baseten.

Verifies:
1. Correct model, base URL, and 14-second timeout configuration.
2. Missing API key graceful handling and deterministic fallback.
3. Successful Baseten response and schema validation.
4. Provider authentication failure (HTTP 401).
5. Provider timeout (14 seconds) and fallback.
6. Network failure recovery.
7. Invalid JSON rejection.
8. Incomplete / invalid Pydantic payload rejection.
9. Hallucinated rule identifier rejection.
10. Attempted alteration of deterministic severity rank rejection.
11. Attempted autonomous prescription approval rejection.
12. API endpoint integration (/verify and /ai-explanation) with RBAC enforcement.
"""
import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.orm import Session

from app.config import settings
from app.services.baseten_service import BasetenService
from app.services.verification.models import GeneratedFinding
from app.models.prescription import Prescription
from app.models.user import User


def get_auth_token(client, username: str, password: str) -> str:
    """Helper to authenticate and retrieve access token."""
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
def sample_findings():
    """Sample deterministic findings matching SCENARIO_3_ALLERGY."""
    return [
        GeneratedFinding(
            rule_identifier="RULE-ALG-PEN-01",
            category="ALLERGY",
            severity="HIGH",
            status="CONFLICT_DETECTED",
            message="Documented Penicillin hypersensitivity conflicts with prescribed Amoxicillin.",
            evidence="Patient has documented severe anaphylaxis to Penicillin G.",
            rule_source="Synthetic Cross-Reactivity Monograph",
            human_review_required=True,
        ),
        GeneratedFinding(
            rule_identifier="RULE-IND-AMX-01",
            category="INDICATION",
            severity="INFO",
            status="CLEAN",
            message="Amoxicillin matches documented diagnosis of Acute Sinusitis.",
            evidence="Infection diagnosis confirmed.",
            rule_source="Synthetic Clinical Practice Guidelines",
            human_review_required=False,
        ),
    ]


# =============================================================================
# 1. Configuration & Missing Key Tests
# =============================================================================

def test_baseten_configuration_defaults():
    """Verify Baseten client initializes with exact required model and parameters."""
    service = BasetenService(
        api_key="test-key",
        base_url="https://inference.baseten.co/v1",
        model_name="meta-models/muse-spark-open",
        timeout_seconds=14.0,
    )
    assert service.model_name == "meta-models/muse-spark-open"
    assert service.base_url == "https://inference.baseten.co/v1"
    assert service.timeout_seconds == 14.0
    assert service.is_configured is True


@pytest.mark.asyncio
async def test_baseten_missing_api_key_graceful_fallback(db_session: Session, sample_findings):
    """When API key is None or empty, returns unavailable status with deterministic preservation."""
    service = BasetenService(api_key=None)
    assert service.is_configured is False

    rx = db_session.query(Prescription).first()
    explanation = await service.generate_explanation(rx, sample_findings)

    assert explanation.ai_status == "unavailable"
    assert "not configured" in (explanation.status_detail or "")
    assert len(explanation.finding_explanations) == 0


# =============================================================================
# 2. Successful Inference & Schema Validation
# =============================================================================

@pytest.mark.asyncio
async def test_baseten_successful_explanation_flow(db_session: Session, sample_findings):
    """Simulates a valid response from Meta Muse Spark Open on Baseten."""
    mock_baseten_payload = {
        "summary": "Prescription contains a critical hypersensitivity conflict with documented Penicillin allergy.",
        "finding_explanations": [
            {
                "rule_identifier": "RULE-ALG-PEN-01",
                "category": "ALLERGY",
                "severity": "HIGH",
                "clinical_explanation": "Amoxicillin shares the core beta-lactam bicyclic ring structure with Penicillin, presenting an unacceptable risk of Type-I anaphylaxis.",
            },
            {
                "rule_identifier": "RULE-IND-AMX-01",
                "category": "INDICATION",
                "severity": "INFO",
                "clinical_explanation": "Amoxicillin is guideline-recommended for acute bacterial rhinosinusitis, but is contraindicated here due to allergy.",
            },
        ],
        "clinical_context": "52-year-old female presenting with severe acute sinusitis.",
        "uncertainties": ["Exact timeline of previous penicillin hypersensitivity episode."],
        "review_considerations": [
            "Consider switching to non-beta-lactam alternative such as Doxycycline or a respiratory fluoroquinolone.",
            "Verify severity of prior hypersensitivity reaction directly with patient.",
        ],
    }

    service = BasetenService(api_key="mock-valid-key")
    rx = db_session.query(Prescription).first()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(mock_baseten_payload)}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "available"
    assert res.status_detail is None
    assert len(res.finding_explanations) == 2
    assert res.finding_explanations[0].rule_identifier == "RULE-ALG-PEN-01"
    assert res.finding_explanations[0].severity == "HIGH"
    assert "beta-lactam" in res.finding_explanations[0].clinical_explanation
    assert len(res.review_considerations) == 2


# =============================================================================
# 3. Provider Failures, Timeouts, and Network Errors
# =============================================================================

@pytest.mark.asyncio
async def test_baseten_provider_auth_failure_401(db_session: Session, sample_findings):
    """HTTP 401 Unauthorized returns unavailable without crashing."""
    service = BasetenService(api_key="invalid-key")
    rx = db_session.query(Prescription).first()

    mock_resp = httpx.Response(status_code=401, text="Invalid API key provided")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.HTTPStatusError("Unauthorized", request=MagicMock(), response=mock_resp)):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "unavailable"
    assert "Invalid, revoked, or expired API key" in (res.status_detail or "")


@pytest.mark.asyncio
async def test_baseten_provider_timeout_14s(db_session: Session, sample_findings):
    """Enforces 14-second timeout limit and returns timeout status gracefully."""
    service = BasetenService(api_key="valid-key", timeout_seconds=14.0)
    rx = db_session.query(Prescription).first()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.TimeoutException("Read timed out")):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "timeout"
    assert "14" in (res.status_detail or "")
    assert "timed out" in res.summary.lower()


@pytest.mark.asyncio
async def test_baseten_network_connection_error(db_session: Session, sample_findings):
    """Network connection failure returns unavailable status with deterministic fallback."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=httpx.ConnectError("Connection refused")):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "unavailable"
    assert "Network error" in (res.status_detail or "")


# =============================================================================
# 4. Anti-Hallucination, Malformed Output, and Security Guards
# =============================================================================

@pytest.mark.asyncio
async def test_baseten_invalid_json_rejection(db_session: Session, sample_findings):
    """Model returning non-JSON or broken text is safely rejected."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": "This is plain text with no JSON formatting: Amoxicillin is fine."}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "parsing error" in (res.status_detail or "").lower()


@pytest.mark.asyncio
async def test_baseten_missing_required_fields_rejection(db_session: Session, sample_findings):
    """Payload lacking required summary or clinical context is rejected."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    incomplete_payload = {
        "finding_explanations": [],
        "uncertainties": ["missing summary"],
    }
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(incomplete_payload)}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "missing" in (res.status_detail or "").lower()


@pytest.mark.asyncio
async def test_baseten_hallucinated_rule_identifier_rejection(db_session: Session, sample_findings):
    """Model inventing a rule identifier not in deterministic findings is strictly rejected."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    hallucinated_payload = {
        "summary": "Everything looks okay.",
        "finding_explanations": [
            {
                "rule_identifier": "RULE-HALLUCINATED-999",
                "category": "ALLERGY",
                "severity": "HIGH",
                "clinical_explanation": "Fake rule explanation.",
            }
        ],
        "clinical_context": "Clinical context.",
        "uncertainties": [],
        "review_considerations": [],
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(hallucinated_payload)}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "Unknown rule identifier" in (res.status_detail or "")
    assert "RULE-HALLUCINATED-999" in (res.status_detail or "")


@pytest.mark.asyncio
async def test_baseten_altered_severity_rejection(db_session: Session, sample_findings):
    """Model attempting to downgrade or alter a deterministic finding severity is strictly rejected."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    tampered_severity_payload = {
        "summary": "Downgraded finding.",
        "finding_explanations": [
            {
                "rule_identifier": "RULE-ALG-PEN-01",
                "category": "ALLERGY",
                "severity": "LOW",  # Deterministic severity is HIGH!
                "clinical_explanation": "Attempting to claim allergy is only minor.",
            }
        ],
        "clinical_context": "Clinical context.",
        "uncertainties": [],
        "review_considerations": [],
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(tampered_severity_payload)}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "Severity mismatch" in (res.status_detail or "")


@pytest.mark.asyncio
async def test_baseten_autonomous_approval_rejection(db_session: Session, sample_findings):
    """Model attempting autonomous approval or dispensing authorization is strictly rejected."""
    service = BasetenService(api_key="valid-key")
    rx = db_session.query(Prescription).first()

    rogue_approval_payload = {
        "summary": "This prescription is approved and verified safe for immediate patient administration.",
        "finding_explanations": [],
        "clinical_context": "Dispense immediately without pharmacist review.",
        "uncertainties": [],
        "review_considerations": [],
    }

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "choices": [{"message": {"content": json.dumps(rogue_approval_payload)}}]
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "autonomous approval" in (res.status_detail or "").lower()


# =============================================================================
# 5. API Endpoints & RBAC Regression
# =============================================================================

def test_verify_endpoint_includes_ai_explanation(client, db_session: Session):
    """Verify endpoint executes deterministic engine and includes AI explanation."""
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
    assert "ai_explanation" in data
    assert data["ai_explanation"] is not None
    assert "ai_status" in data["ai_explanation"]


def test_ai_explanation_endpoint_staff_pharmacist(client, db_session: Session):
    """Staff Pharmacist can request on-demand AI explanation."""
    token = get_auth_token(client, "pharmacist_demo", "StaffDemoPassword2026!")
    rx = db_session.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()

    res = client.post(
        f"/api/v1/prescriptions/{rx.id}/ai-explanation",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert "clinical_context" in data
    assert "ai_status" in data
    assert "disclaimer" in data


def test_ai_explanation_endpoint_student_forbidden(client, db_session: Session):
    """Pharmacy student is forbidden from calling clinical operational AI explanation."""
    token = get_auth_token(client, "student_demo", "StudentDemoPassword2026!")
    rx = db_session.query(Prescription).first()

    res = client.post(
        f"/api/v1/prescriptions/{rx.id}/ai-explanation",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


def test_ai_explanation_endpoint_unauthenticated(client, db_session: Session):
    """Unauthenticated request is rejected with HTTP 401."""
    rx = db_session.query(Prescription).first()
    res = client.post(f"/api/v1/prescriptions/{rx.id}/ai-explanation")
    assert res.status_code == 401


def test_baseten_zero_phi_patient_deidentification(db_session: Session, sample_findings):
    """Verify that patient name, MRN, and personal identifiers are strictly excluded from AI payload."""
    service = BasetenService(api_key="mock-key")
    rx = db_session.query(Prescription).first()
    # Add clinical notes containing the patient's name
    first_name = rx.patient.first_name
    last_name = rx.patient.last_name
    rx.clinical_notes = f"Patient {first_name} {last_name} was seen today for consultation."

    context = service._extract_minimal_context(rx, sample_findings)

    # 1. Names and MRN are strictly excluded from the patient dictionary
    assert "first_name" not in context["patient"]
    assert "last_name" not in context["patient"]
    assert "name" not in context["patient"]
    assert "mrn" not in context["patient"]
    assert "date_of_birth" not in context["patient"]

    # 2. Clinical notes have patient name redacted to [PATIENT]
    assert first_name not in context["clinical_notes"]
    assert last_name not in context["clinical_notes"]
    assert "[PATIENT]" in context["clinical_notes"]
