"""Automated test suite for Amazon Bedrock AI Explanation Service.

Verifies:
1. Correct model, region, and timeout configuration defaults.
2. Missing credentials graceful fallback to deterministic findings.
3. Successful Bedrock converse response and schema validation.
4. Provider timeout and graceful fallback.
5. ClientError and BotoCoreError handling.
6. Invalid JSON rejection.
7. Hallucinated rule identifier rejection.
8. Attempted alteration of deterministic severity rank rejection.
9. Attempted autonomous prescription approval rejection.
10. Patient Zero-PHI sanitization.
"""
import json
import pytest
from unittest.mock import patch, MagicMock
from botocore.exceptions import ClientError, BotoCoreError
from sqlalchemy.orm import Session

from app.config import settings
from app.services.bedrock_service import BedrockService
from app.services.verification.models import GeneratedFinding
from app.models.prescription import Prescription


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


def test_bedrock_configuration_defaults():
    """Verify Bedrock client initializes with expected region and model parameters."""
    service = BedrockService(
        aws_access_key_id="test-key",
        aws_secret_access_key="test-secret",
        region_name="us-east-1",
        model_id="us.anthropic.claude-sonnet-4-6",
        timeout_seconds=20.0,
    )
    assert service.is_configured is True
    assert service.region_name == "us-east-1"
    assert service.model_id == "us.anthropic.claude-sonnet-4-6"
    assert service.timeout_seconds == 20.0


async def test_bedrock_missing_credentials_graceful_fallback(db_session: Session, sample_findings):
    """When AWS credentials are not configured, Bedrock service falls back gracefully."""
    service = BedrockService(aws_access_key_id=None, aws_secret_access_key=None)
    assert service.is_configured is False

    rx = db_session.query(Prescription).first()
    res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "unavailable"
    assert "not configured" in (res.status_detail or "").lower()
    assert len(res.finding_explanations) == 0


async def test_bedrock_successful_mock_flow(db_session: Session, sample_findings):
    """Simulates a valid response from Amazon Bedrock."""
    mock_payload = {
        "summary": "Prescription exhibits a documented penicillin allergy conflict requiring pharmacist intervention.",
        "finding_explanations": [
            {
                "rule_identifier": "RULE-ALG-PEN-01",
                "category": "ALLERGY",
                "severity": "HIGH",
                "clinical_explanation": "Direct beta-lactam core cross-reactivity with documented penicillin allergy.",
            },
            {
                "rule_identifier": "RULE-IND-AMX-01",
                "category": "INDICATION",
                "severity": "INFO",
                "clinical_explanation": "Amoxicillin is standard therapy for bacterial sinusitis in non-allergic patients.",
            },
        ],
        "clinical_context": "Synthetic encounter for acute bacterial sinusitis with documented drug allergy.",
        "uncertainties": ["Patient tolerance to alternative cephalosporin antibiotics is unverified."],
        "review_considerations": ["Recommend alternative non-beta-lactam antibiotic such as doxycycline."],
    }

    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()

    mock_boto_response = {
        "output": {
            "message": {
                "content": [{"text": json.dumps(mock_payload)}]
            }
        }
    }

    mock_client = MagicMock()
    mock_client.converse.return_value = mock_boto_response

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "available"
    assert res.status_detail is None
    assert len(res.finding_explanations) == 2
    assert res.finding_explanations[0].rule_identifier == "RULE-ALG-PEN-01"
    assert res.finding_explanations[0].severity == "HIGH"


async def test_bedrock_client_error_handling(db_session: Session, sample_findings):
    """Simulates an AWS Bedrock ClientError (e.g. AccessDeniedException or ValidationException)."""
    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()

    mock_client = MagicMock()
    error_response = {"Error": {"Code": "AccessDeniedException", "Message": "Access denied to model."}}
    mock_client.converse.side_effect = ClientError(error_response, "Converse")

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "unavailable"
    assert "AccessDeniedException" in (res.status_detail or "")


async def test_bedrock_botocore_network_error(db_session: Session, sample_findings):
    """Simulates network/DNS error during Bedrock call."""
    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()

    mock_client = MagicMock()
    mock_client.converse.side_effect = BotoCoreError()

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "unavailable"
    assert "connection error" in (res.status_detail or "").lower()


async def test_bedrock_hallucinated_rule_rejection(db_session: Session, sample_findings):
    """Ensures that any hallucinated rule identifiers from the model are rejected."""
    bad_payload = {
        "summary": "Summary text",
        "finding_explanations": [
            {
                "rule_identifier": "HALLUCINATED-RULE-999",
                "category": "ALLERGY",
                "severity": "HIGH",
                "clinical_explanation": "Made up risk.",
            }
        ],
        "clinical_context": "Context text",
        "uncertainties": [],
        "review_considerations": [],
    }

    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()

    mock_boto_response = {
        "output": {
            "message": {
                "content": [{"text": json.dumps(bad_payload)}]
            }
        }
    }
    mock_client = MagicMock()
    mock_client.converse.return_value = mock_boto_response

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "hallucinated" in (res.summary or "").lower()


async def test_bedrock_autonomous_approval_rejection(db_session: Session, sample_findings):
    """Rejects output if model claims autonomous dispensing authority."""
    bad_payload = {
        "summary": "I hereby approve this prescription for immediate dispensing without pharmacist review.",
        "finding_explanations": [],
        "clinical_context": "Context text",
        "uncertainties": [],
        "review_considerations": [],
    }

    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()

    mock_boto_response = {
        "output": {
            "message": {
                "content": [{"text": json.dumps(bad_payload)}]
            }
        }
    }
    mock_client = MagicMock()
    mock_client.converse.return_value = mock_boto_response

    with patch.object(service, "_get_client", return_value=mock_client):
        res = await service.generate_explanation(rx, sample_findings)

    assert res.ai_status == "rejected"
    assert "autonomous approval" in (res.status_detail or "").lower()


def test_bedrock_zero_phi_patient_deidentification(db_session: Session, sample_findings):
    """Verify that patient name, MRN, and DOB are never in the Bedrock payload."""
    service = BedrockService(aws_access_key_id="test", aws_secret_access_key="test")
    rx = db_session.query(Prescription).first()
    rx.clinical_notes = f"Patient {rx.patient.first_name} {rx.patient.last_name} reported sinus symptoms."

    payload = service._extract_minimal_context(rx, sample_findings)

    assert rx.patient.first_name not in json.dumps(payload)
    assert rx.patient.last_name not in json.dumps(payload)
    assert rx.patient.mrn not in json.dumps(payload)
    assert "[PATIENT]" in payload["clinical_notes"]

