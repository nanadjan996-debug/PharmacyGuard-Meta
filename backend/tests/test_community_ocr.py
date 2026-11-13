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
            "confirm_drug_name": True,
            "confirmed_drug_name": "Amoxicillin",
            "confirm_strength": True,
            "confirmed_strength": "",  # Missing strength
            "confirm_dosage_form": True,
            "confirmed_dosage_form": "Capsule",
            "confirm_dose": True,
            "confirmed_dose_amount": 1.0,
            "confirm_route": True,
            "confirmed_route": "Oral",
            "confirm_frequency": True,
            "confirmed_frequency": "TID",
            "confirm_duration": True,
            "confirmed_duration_days": 5,
        }
        is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation([incomplete_item])
        assert is_valid is False
        assert "missing confirmed Strength" in reason

    def test_validate_human_gate_rejects_unconfirmed_fields_even_with_valid_values(self):
        """Proves that merely containing non-empty values does NOT satisfy the gate: each field must be explicitly confirmed."""
        unconfirmed_item = {
            "is_pharmacist_confirmed": True,
            "confirm_drug_name": True,
            "confirmed_drug_name": "Amoxicillin",
            "confirm_strength": True,
            "confirmed_strength": "500mg",
            "confirm_dosage_form": True,
            "confirmed_dosage_form": "Capsule",
            "confirm_dose": False,  # Not explicitly confirmed by pharmacist!
            "confirmed_dose_amount": 1.0,
            "confirm_route": True,
            "confirmed_route": "Oral",
            "confirm_frequency": True,
            "confirmed_frequency": "TID",
            "confirm_duration": True,
            "confirmed_duration_days": 5,
        }
        is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation([unconfirmed_item])
        assert is_valid is False
        assert "Dose Amount has not been explicitly confirmed" in reason

    def test_ocr_extracts_patient_metadata_distinct_from_clinical_fields(self):
        """Proves patient name, age, date are extracted as encounter metadata without replacing 7 clinical fields."""
        raw_text = (
            "Regional Hospital OPD\n"
            "Patient: Kwame Mensah | Age: 45y | Date: 2026-11-12\n"
            "Rx: Ciprofloxacin 500mg tablets\n"
            "Take 1 tab po BID for 5 days\n"
        )
        result = PrescriptionOCREngine.extract_from_text(raw_text)
        assert result.patient_name == "Kwame Mensah"
        assert result.patient_age == "45y"
        assert result.prescription_date == "2026-11-12"
        assert len(result.items) == 1
        item = result.items[0]
        # All 7 core clinical fields extracted independently:
        assert item.drug_name == "Ciprofloxacin"
        assert item.strength == "500mg"
        assert item.dosage_form == "Tablet"
        assert item.dose_amount == 1.0
        assert item.route == "Oral"
        assert item.frequency == "BID"
        assert item.duration_days == 5

    def test_ocr_does_not_infer_missing_dose_or_duration(self):
        """Invariant: Low-confidence or missing OCR dose/duration are NOT inferred. Pharmacist must manually supply."""
        raw_text = (
            "Ridge Hospital OPD\n"
            "Rx: Metronidazole 400mg tablets\n"
            "Take po TID\n"
        )
        result = PrescriptionOCREngine.extract_from_text(raw_text)
        assert len(result.items) == 1
        item = result.items[0]
        assert item.drug_name == "Metronidazole"
        assert item.strength == "400mg"
        assert item.dosage_form == "Tablet"
        # Dose amount not in text -> None (0.0 confidence)
        assert item.dose_amount is None
        assert item.confidence_dose == 0.0
        # Duration not in text -> None (0.0 confidence)
        assert item.duration_days is None
        assert item.confidence_duration == 0.0
        assert item.requires_review is True
        assert result.low_confidence_flag is True

    def test_validate_human_gate_rejects_missing_dose_or_duration(self):
        """Human Gate rejects confirmation if dose or duration is missing or non-positive."""
        missing_dose = {
            "is_pharmacist_confirmed": True,
            "confirm_drug_name": True,
            "confirmed_drug_name": "Amoxicillin",
            "confirm_strength": True,
            "confirmed_strength": "500mg",
            "confirm_dosage_form": True,
            "confirmed_dosage_form": "Capsule",
            "confirm_dose": True,
            "confirmed_dose_amount": None,
            "confirm_route": True,
            "confirmed_route": "Oral",
            "confirm_frequency": True,
            "confirmed_frequency": "TID",
            "confirm_duration": True,
            "confirmed_duration_days": 5,
        }
        is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation([missing_dose])
        assert is_valid is False
        assert "Dose Amount" in reason

        missing_duration = {
            "is_pharmacist_confirmed": True,
            "confirm_drug_name": True,
            "confirmed_drug_name": "Amoxicillin",
            "confirm_strength": True,
            "confirmed_strength": "500mg",
            "confirm_dosage_form": True,
            "confirmed_dosage_form": "Capsule",
            "confirm_dose": True,
            "confirmed_dose_amount": 1.0,
            "confirm_route": True,
            "confirmed_route": "Oral",
            "confirm_frequency": True,
            "confirmed_frequency": "TID",
            "confirm_duration": True,
            "confirmed_duration_days": None,
        }
        is_valid, reason = PrescriptionOCREngine.validate_human_gate_confirmation([missing_duration])
        assert is_valid is False
        assert "Duration" in reason


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

        # Pharmacist confirms all 7 core fields affirmatively
        gate_payload = {
            "items": [
                {
                    "item_id": item_id,
                    "confirmed_drug_name": "Artemether/Lumefantrine",
                    "confirm_drug_name": True,
                    "confirmed_strength": "20/120mg",
                    "confirm_strength": True,
                    "confirmed_dosage_form": "Tablet",
                    "confirm_dosage_form": True,
                    "confirmed_dose_amount": 4.0,
                    "confirm_dose": True,
                    "confirmed_dose_unit": "tablets",
                    "confirmed_route": "Oral",
                    "confirm_route": True,
                    "confirmed_frequency": "BID",
                    "confirm_frequency": True,
                    "confirmed_duration_days": 3,
                    "confirm_duration": True,
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
        item_resp = confirmed_data["items"][0]
        assert item_resp["is_pharmacist_confirmed"] is True
        assert item_resp["is_drug_name_confirmed"] is True
        assert item_resp["is_strength_confirmed"] is True
        assert item_resp["is_dosage_form_confirmed"] is True
        assert item_resp["is_dose_confirmed"] is True
        assert item_resp["is_route_confirmed"] is True
        assert item_resp["is_frequency_confirmed"] is True
        assert item_resp["is_duration_confirmed"] is True
        assert item_resp["confirmed_by"] == "pharmacist_demo"
        assert item_resp["confirmed_at"] is not None

        # Now dispensing succeeds
        dispense_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/dispense", headers=auth_headers)
        assert dispense_resp.status_code == 200
        assert dispense_resp.json()["status"] == "DISPENSED"

    def test_upload_with_missing_dose_requires_manual_pharmacist_entry(self, client: TestClient, auth_headers: dict):
        """OCR items with missing dose/duration start as None and require manual pharmacist supply."""
        payload = {
            "filename": "missing_dose_slip.jpg",
            "content_type": "image/jpeg",
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "patient_identifier": "SYN-RX-MANUAL",
            "raw_text_override": (
                "Patient: Ama Serwaa | Age: 29y | Date: 2026-11-13\n"
                "Rx: Metronidazole 400mg tablets\n"
                "Take po TID\n"
            ),
        }
        resp = client.post("/api/v1/community/prescriptions/upload", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["patient_name"] == "Ama Serwaa"
        assert data["patient_age"] == "29y"
        assert data["prescription_date"] == "2026-11-13"
        scan_id = data["id"]
        item = data["items"][0]
        assert item["ocr_dose_amount"] is None
        assert item["ocr_duration_days"] is None
        assert item["confirmed_dose_amount"] is None
        assert item["confirmed_duration_days"] is None

        # Confirm gate with missing/zero dose fails
        fail_payload = {
            "items": [
                {
                    "item_id": item["id"],
                    "confirmed_drug_name": "Metronidazole",
                    "confirm_drug_name": True,
                    "confirmed_strength": "400mg",
                    "confirm_strength": True,
                    "confirmed_dosage_form": "Tablet",
                    "confirm_dosage_form": True,
                    "confirmed_dose_amount": 0,  # Invalid: must be > 0
                    "confirm_dose": True,
                    "confirmed_route": "Oral",
                    "confirm_route": True,
                    "confirmed_frequency": "TID",
                    "confirm_frequency": True,
                    "confirmed_duration_days": 5,
                    "confirm_duration": True,
                }
            ]
        }
        fail_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/confirm-gate", json=fail_payload, headers=auth_headers)
        assert fail_resp.status_code == 422

        # Supply valid dose & duration manually -> Succeeds
        success_payload = {
            "items": [
                {
                    "item_id": item["id"],
                    "confirmed_drug_name": "Metronidazole",
                    "confirm_drug_name": True,
                    "confirmed_strength": "400mg",
                    "confirm_strength": True,
                    "confirmed_dosage_form": "Tablet",
                    "confirm_dosage_form": True,
                    "confirmed_dose_amount": 1.0,
                    "confirm_dose": True,
                    "confirmed_dose_unit": "tablet",
                    "confirmed_route": "Oral",
                    "confirm_route": True,
                    "confirmed_frequency": "TID",
                    "confirm_frequency": True,
                    "confirmed_duration_days": 5,
                    "confirm_duration": True,
                    "legal_category": "POM",
                }
            ],
            "pharmacist_review_notes": "Dose and duration manually supplied from slip cross-check.",
        }
        succ_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/confirm-gate", json=success_payload, headers=auth_headers)
        assert succ_resp.status_code == 200
        assert succ_resp.json()["status"] == "HUMAN_CONFIRMED"
        assert succ_resp.json()["items"][0]["confirmed_dose_amount"] == 1.0
        assert succ_resp.json()["items"][0]["confirmed_duration_days"] == 5

    def test_high_confidence_ocr_rejected_without_explicit_pharmacist_affirmation(self, client: TestClient, auth_headers: dict):
        """Even high-confidence OCR items are strictly rejected if pharmacist has not affirmatively confirmed all 7 fields."""
        payload = {
            "filename": "high_conf_slip.jpg",
            "content_type": "image/jpeg",
            "image_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
            "patient_identifier": "SYN-RX-HIGH-CONF",
            "raw_text_override": "Rx: Ciprofloxacin 500mg tablets 1 tab po BID for 5 days",
        }
        create_resp = client.post("/api/v1/community/prescriptions/upload", json=payload, headers=auth_headers)
        assert create_resp.status_code == 201
        data = create_resp.json()
        item = data["items"][0]
        scan_id = data["id"]

        # Attempt confirmation where confirm_duration is False
        unconfirmed_payload = {
            "items": [
                {
                    "item_id": item["id"],
                    "confirmed_drug_name": "Ciprofloxacin",
                    "confirm_drug_name": True,
                    "confirmed_strength": "500mg",
                    "confirm_strength": True,
                    "confirmed_dosage_form": "Tablet",
                    "confirm_dosage_form": True,
                    "confirmed_dose_amount": 1.0,
                    "confirm_dose": True,
                    "confirmed_route": "Oral",
                    "confirm_route": True,
                    "confirmed_frequency": "BID",
                    "confirm_frequency": True,
                    "confirmed_duration_days": 5,
                    "confirm_duration": False,  # Missing affirmative confirmation!
                }
            ]
        }
        fail_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/confirm-gate", json=unconfirmed_payload, headers=auth_headers)
        assert fail_resp.status_code == 422
        assert "Duration has not been explicitly confirmed" in fail_resp.json()["detail"]

        # Now affirmatively confirm all 7 -> Succeeds
        unconfirmed_payload["items"][0]["confirm_duration"] = True
        succ_resp = client.post(f"/api/v1/community/prescriptions/{scan_id}/confirm-gate", json=unconfirmed_payload, headers=auth_headers)
        assert succ_resp.status_code == 200
        assert succ_resp.json()["status"] == "HUMAN_CONFIRMED"

