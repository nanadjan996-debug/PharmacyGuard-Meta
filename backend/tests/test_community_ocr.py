"""Test Suite for Workflow B: Community Prescription Scanner & 7-Field Human Confirmation Gate."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.ocr.prescription_ocr_engine import PrescriptionOCREngine
from app.models.community import CommunityPrescriptionScan


@pytest.fixture
def pharmacist_token(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "pharmacist_demo", "password": "StaffDemoPassword2026!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(pharmacist_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {pharmacist_token}"}


class TestPrescriptionOCREngine:
    def test_ocr_parser_extracts_seven_core_fields(self):
        """Proves OCR parser extracts all 7 core clinical fields per Specification v3.1.1."""
        raw_text = (
            "Ridge Hospital OPD\n"
            "Rx: Amoxicillin/Clavulanic Acid 625mg tabs\n"
            "Take 1 tab po BID for 7 days\n"
            "Rx: Paracetamol 500mg tablets\n"
            "Take 2 tabs TID for 3 days as needed for pain\n"
        )
        result = PrescriptionOCREngine.extract_from_text(raw_text)
        assert len(result.items) >= 2

        item1 = result.items[0]
        # 1. Drug Name
        assert "Amoxicillin" in item1.drug_name
        # 2. Strength
        assert "625mg" in item1.strength
        # 3. Dosage form
        assert item1.dosage_form.lower() in ("tablet", "tab")
        # 4. Dose amount & unit
        assert item1.dose_amount == 1.0
        # 5. Route
        assert item1.route.lower() == "oral"
        # 6. Frequency
        assert item1.frequency == "BID"
        # 7. Duration
        assert item1.duration_days == 7

        # Confidence scores
        assert item1.confidence_drug_name >= 0.85
        assert item1.confidence_route >= 0.85

    def test_ocr_low_confidence_flag_on_ambiguous_text(self):
        """Ambiguous or unformatted prescription text produces low confidence (<0.85) requiring human inspection."""
        raw_text = "Some unformatted scribbled line without clear dosage"
        result = PrescriptionOCREngine.extract_from_text(raw_text)
        assert result.low_confidence_flag is True
        assert result.overall_confidence < 0.85

    def test_validate_human_gate_requires_all_seven_fields(self):
        """Human Gate validation rejects any item missing any of the 7 core fields."""
        incomplete_item = {
            "is_pharmacist_confirmed": True,
            "confirmed_drug_name": "Amoxicillin",
            "confirmed_strength": "",  # Missing strength
            "confirmed_dosage_form": "Capsule",
            "confirmed_dose_amount": 1.0,
            "confirmed_route": "Oral",
            "confirmed_frequency": "TID",
            "confirmed_duration_days": 5,
        }
        is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation([incomplete_item])
        assert is_valid is False
        assert "missing confirmed Strength" in reason


class TestCommunityPrescriptionScanAPI:
    def test_upload_community_prescription(self, client: TestClient, auth_headers: dict):
        """Uploading a prescription slip image creates a scan encounter in PENDING_REVIEW."""
        payload = {
            "filename": "ghana_opd_slip_001.jpg",
            "content_type": "image/jpeg",
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "patient_identifier": "SYN-RX-001",
            "raw_text_override": (
                "Korle Bu PolyClinic\n"
                "Ciprofloxacin 500mg tablets 1 tab BID for 5 days\n"
                "Metronidazole 400mg tablets 1 tab TID for 5 days\n"
            ),
        }
        response = client.post("/api/v1/community/prescriptions/upload", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["scan_number"].startswith("CRX-")
        assert data["status"] == "PENDING_REVIEW"
        assert len(data["items"]) == 2
        assert data["items"][0]["is_pharmacist_confirmed"] is False

    def test_dispense_blocked_before_human_gate_confirmation(self, client: TestClient, auth_headers: dict):
        """Safety Invariant: Dispensing is strictly blocked until pharmacist confirms all 7 core fields."""
        payload = {
            "filename": "unconfirmed_slip.jpg",
            "content_type": "image/jpeg",
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "patient_identifier": "SYN-RX-UNCONFIRMED",
            "raw_text_override": "Amoxicillin 500mg capsule 1 cap TID for 5 days",
        }
        create_resp = client.post("/api/v1/community/prescriptions/upload", json=payload, headers=auth_headers)
        scan_id = create_resp.json()["id"]

        # Attempt to dispense before human gate confirmation -> Must fail with 400
        dispense_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/dispense", headers=auth_headers)
        assert dispense_resp.status_code == 400
        assert "Dispensing Invariant Blocked" in dispense_resp.json()["detail"]

    def test_confirm_human_gate_and_dispense_flow(self, client: TestClient, auth_headers: dict):
        """Pharmacist inspects image, confirms all 7 fields, locks human gate, and dispenses."""
        payload = {
            "filename": "confirmed_slip.jpg",
            "content_type": "image/jpeg",
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "patient_identifier": "SYN-RX-CONFIRMED",
            "raw_text_override": "Artemether/Lumefantrine 20/120mg tabs 4 tabs BID for 3 days",
        }
        create_resp = client.post("/api/v1/community/prescriptions/upload", json=payload, headers=auth_headers)
        scan_data = create_resp.json()
        scan_id = scan_data["id"]
        item_id = scan_data["items"][0]["id"]

        # Pharmacist confirms all 7 core fields
        gate_payload = {
            "items": [
                {
                    "item_id": item_id,
                    "confirmed_drug_name": "Artemether/Lumefantrine",
                    "confirmed_strength": "20/120mg",
                    "confirmed_dosage_form": "Tablet",
                    "confirmed_dose_amount": 4.0,
                    "confirmed_dose_unit": "tablets",
                    "confirmed_route": "Oral",
                    "confirmed_frequency": "BID",
                    "confirmed_duration_days": 3,
                    "confirmed_instructions": "Take with milk or fatty meal",
                    "legal_category": "P",
                }
            ],
            "pharmacist_review_notes": "Prescription verified against physical slip. Dose confirmed appropriate.",
        }
        confirm_resp = client.post(
            f"/api/v1/community/prescriptions/{scan_id}/confirm-gate",
            json=gate_payload,
            headers=auth_headers,
        )
        assert confirm_resp.status_code == 200
        confirmed_data = confirm_resp.json()
        assert confirmed_data["status"] == "HUMAN_CONFIRMED"
        assert confirmed_data["pharmacist_confirmed_by"] == "pharmacist_demo"
        assert confirmed_data["items"][0]["is_pharmacist_confirmed"] is True

        # Now dispensing succeeds
        dispense_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/dispense", headers=auth_headers)
        assert dispense_resp.status_code == 200
        assert dispense_resp.json()["status"] == "DISPENSED"

