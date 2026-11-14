"""Automated test suite for Community Pharmacy Counter Consultations & RedFlagEngine."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.verification.red_flag_engine import RedFlagEngine
from app.models.community import CommunityConsultation, ClinicalRuleMeta
from app.models.user import User


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


# =====================================================================
# PART 1: RED-FLAG ENGINE UNIT TESTS (GOLDEN CLINICAL TEST CASES)
# =====================================================================

class TestRedFlagEngine:
    def test_rf_mal_sev_01_positive_case(self):
        """Child 3yo with high fever, vomiting, prostration -> EMERGENCY REFERRAL."""
        result = RedFlagEngine.evaluate(
            age_years=3,
            temperature_c=39.5,
            mrdt_status="CONFIRMED_POSITIVE",
            symptoms=["fever", "prostration", "repeated_vomiting"],
            proposed_medications=["Artemether-Lumefantrine 20/120mg"],
        )
        assert result.referral_triggered is True
        assert result.referral_urgency == "EMERGENCY"
        assert any(f.rule_identifier == "RF-MAL-SEV-01" for f in result.findings)
        
        sev_mal = next(f for f in result.findings if f.rule_identifier == "RF-MAL-SEV-01")
        assert "strictly contraindicated" in sev_mal.action_required.lower()
        assert "BLOCKED_PENDING_CLINICAL_APPROVAL" in sev_mal.action_required
        assert result.referral_note is not None
        assert "EMERGENCY REFERRAL" in result.referral_note

    def test_rf_mal_sev_01_negative_case(self):
        """Adult 24yo with uncomplicated malaria, alert, drinking fluids -> NO RED FLAG."""
        result = RedFlagEngine.evaluate(
            age_years=24,
            temperature_c=38.4,
            mrdt_status="CONFIRMED_POSITIVE",
            symptoms=["fever", "headache", "chills"],
            proposed_medications=["Artemether-Lumefantrine"],
        )
        assert result.referral_triggered is False
        assert len(result.findings) == 0
        assert result.referral_note is None

    def test_rf_mal_sev_01_missing_weight_emergency(self):
        """Child with severe prostration but unmeasured weight -> Referral triggered without crash."""
        result = RedFlagEngine.evaluate(
            age_years=2,
            weight_kg=None,
            temperature_c=39.2,
            mrdt_status="CONFIRMED_POSITIVE",
            symptoms=["fever", "prostration"],
        )
        assert result.referral_triggered is True
        assert "Unmeasured" in (result.referral_note or "")

    def test_rf_cvd_hyp_01_positive_case(self):
        """BP 196/124 with acute blurry vision and severe headache -> EMERGENCY REFERRAL."""
        result = RedFlagEngine.evaluate(
            age_years=55,
            sbp_mmhg=196,
            dbp_mmhg=124,
            symptoms=["severe_headache", "blurred_vision"],
        )
        assert result.referral_triggered is True
        assert result.referral_urgency == "EMERGENCY"
        assert any(f.rule_identifier == "RF-CVD-HYP-01" for f in result.findings)

    def test_rf_cvd_hyp_01_negative_case(self):
        """Mild elevation (138/86) with tension headache -> NO RED FLAG."""
        result = RedFlagEngine.evaluate(
            age_years=55,
            sbp_mmhg=138,
            dbp_mmhg=86,
            symptoms=["headache"],
        )
        assert result.referral_triggered is False

    def test_rf_abd_acu_01_positive_case(self):
        """Acute severe abdominal pain with rigidity and rebound tenderness -> SURGICAL EMERGENCY."""
        result = RedFlagEngine.evaluate(
            age_years=28,
            symptoms=["acute_abdominal_pain", "abdominal_rigidity", "rebound_tenderness"],
        )
        assert result.referral_triggered is True
        assert any(f.rule_identifier == "RF-ABD-ACU-01" for f in result.findings)
        abdo_finding = next(f for f in result.findings if f.rule_identifier == "RF-ABD-ACU-01")
        assert "surgical emergency" in abdo_finding.title.lower()

    def test_rf_ped_res_01_positive_case(self):
        """14-month-old infant with cough, RR 54 bpm and subcostal chest indrawing -> IMCI EMERGENCY."""
        result = RedFlagEngine.evaluate(
            age_years=1,
            age_months=14,
            respiratory_rate_bpm=54,
            symptoms=["cough", "subcostal_chest_indrawing"],
        )
        assert result.referral_triggered is True
        assert any(f.rule_identifier == "RF-PED-RES-01" for f in result.findings)

    def test_rf_ped_res_01_negative_case(self):
        """14-month-old infant with clear rhinorrhea, RR 28 bpm, no indrawing -> NO RED FLAG."""
        result = RedFlagEngine.evaluate(
            age_years=1,
            age_months=14,
            respiratory_rate_bpm=28,
            symptoms=["rhinorrhea"],
        )
        assert result.referral_triggered is False

    def test_rf_neu_men_01_positive_case(self):
        """19yo with fever (39.1°C), neck stiffness, and photophobia -> MENINGITIS EMERGENCY."""
        result = RedFlagEngine.evaluate(
            age_years=19,
            temperature_c=39.1,
            symptoms=["fever", "neck_stiffness", "photophobia"],
        )
        assert result.referral_triggered is True
        assert any(f.rule_identifier == "RF-NEU-MEN-01" for f in result.findings)


# =====================================================================
# PART 2: COMMUNITY CONSULTATION REST API TESTS
# =====================================================================

class TestCommunityConsultationAPI:
    def test_create_walk_in_consultation_uncomplicated(self, client: TestClient, auth_headers: dict):
        payload = {
            "patient_identifier": "SYN-WALK-IN-01",
            "age_years": 26,
            "gender": "FEMALE",
            "weight_kg": 58.0,
            "temperature_c": 38.1,
            "mrdt_status": "CONFIRMED_POSITIVE",
            "g6pd_status": "REPORTED_UNKNOWN",
            "chief_complaint": "Fever, body aches, and mild headache for 2 days",
            "symptoms": ["fever", "body_aches", "mild_headache"],
            "allergies": [{"allergen": "Penicillin", "state": "CONFIRMED_OBJECTIVE", "reaction": "Hives"}],
            "current_medications": ["Paracetamol 500mg as needed"],
            "proposed_items": [
                {
                    "drug_name": "Artemether-Lumefantrine",
                    "strength": "20/120mg",
                    "dosage_form": "Tablet",
                    "dose_amount": 4.0,
                    "dose_unit": "tablets",
                    "frequency": "BID",
                    "duration_days": 3,
                    "route": "Oral",
                    "instructions": "Take with fatty food or milk",
                    "legal_category": "P",
                }
            ],
        }
        response = client.post("/api/v1/community/consultations", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["consultation_number"].startswith("CC-")
        assert data["status"] == "VERIFICATION_COMPLETED"
        assert data["referral_triggered"] is False
        assert len(data["items"]) == 1
        assert data["items"][0]["drug_name"] == "Artemether-Lumefantrine"
        assert len(data["findings"]) == 0

    def test_create_walk_in_consultation_severe_red_flag(self, client: TestClient, auth_headers: dict):
        payload = {
            "patient_identifier": "SYN-PEDIATRIC-SEV-01",
            "age_years": 2,
            "age_months": 28,
            "gender": "MALE",
            "weight_kg": 12.0,
            "temperature_c": 39.8,
            "mrdt_status": "CONFIRMED_POSITIVE",
            "chief_complaint": "Severe fever, unable to drink, child cannot sit up unaided",
            "symptoms": ["fever", "prostration", "repeated_vomiting"],
            "proposed_items": [],
        }
        response = client.post("/api/v1/community/consultations", json=payload, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["referral_triggered"] is True
        assert data["referral_urgency"] == "EMERGENCY"
        assert len(data["findings"]) >= 1
        assert any(f["rule_identifier"] == "RF-MAL-SEV-01" for f in data["findings"])
        assert data["referral_notes"] is not None

    def test_consultation_lifecycle_state_machine(self, client: TestClient, auth_headers: dict):
        # 1. Create consultation
        create_payload = {
            "patient_identifier": "SYN-LIFECYCLE-01",
            "age_years": 32,
            "chief_complaint": "Mild headache and fatigue",
            "symptoms": ["headache"],
            "proposed_items": [
                {
                    "drug_name": "Paracetamol",
                    "strength": "500mg",
                    "dosage_form": "Tablet",
                    "dose_amount": 1000.0,
                    "dose_unit": "mg",
                    "frequency": "TID",
                    "duration_days": 3,
                    "route": "Oral",
                    "legal_category": "OTC",
                }
            ],
        }
        c_resp = client.post("/api/v1/community/consultations", json=create_payload, headers=auth_headers)
        assert c_resp.status_code == 201
        c_id = c_resp.json()["id"]
        assert c_resp.json()["status"] == "VERIFICATION_COMPLETED"

        # 2. Attempt illegal transition (cannot jump to APPROVED_FOR_DISPENSING without FINDINGS_REVIEWED)
        bad_trans = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "APPROVED_FOR_DISPENSING"},
            headers=auth_headers,
        )
        assert bad_trans.status_code == 400
        assert "Illegal transition" in bad_trans.json()["detail"]

        # 3. Transition to FINDINGS_REVIEWED
        step1 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "FINDINGS_REVIEWED", "pharmacist_notes": "Reviewed no red flags found."},
            headers=auth_headers,
        )
        assert step1.status_code == 200
        assert step1.json()["status"] == "FINDINGS_REVIEWED"

        # 4. Transition to APPROVED_FOR_DISPENSING
        step2 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "APPROVED_FOR_DISPENSING"},
            headers=auth_headers,
        )
        assert step2.status_code == 200
        assert step2.json()["status"] == "APPROVED_FOR_DISPENSING"

        # 5. Transition to COMPLETED
        step3 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "COMPLETED", "pharmacist_notes": "Counseled on hydration and taking after meals."},
            headers=auth_headers,
        )
        assert step3.status_code == 200
        assert step3.json()["status"] == "COMPLETED"
        assert step3.json()["version"] == 1

        # 6. Amend consultation (version increment)
        step4 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "AMENDED", "pharmacist_notes": "Corrected patient contact follow-up note."},
            headers=auth_headers,
        )
        assert step4.status_code == 200
        assert step4.json()["status"] == "AMENDED"
        assert step4.json()["version"] == 2

    def test_emergency_referral_rejects_dispensing_with_short_rationale(
        self, client: TestClient, auth_headers: dict
    ):
        """Clinical Safety Invariant: Emergency referral cannot transition to APPROVED_FOR_DISPENSING with short text."""
        sev_payload = {
            "patient_identifier": "SYN-EMERGENCY-OVERRIDE-SHORT",
            "age_years": 45,
            "sbp_mmhg": 198,
            "dbp_mmhg": 128,
            "chief_complaint": "Very high blood pressure with blurry vision",
            "symptoms": ["severe_headache", "blurred_vision"],
            "proposed_items": [],
        }
        c_resp = client.post("/api/v1/community/consultations", json=sev_payload, headers=auth_headers)
        assert c_resp.status_code == 201
        c_id = c_resp.json()["id"]

        # Step to FINDINGS_REVIEWED
        step_rev = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "FINDINGS_REVIEWED"},
            headers=auth_headers,
        )
        assert step_rev.status_code == 200

        # Attempt transition with short rationale -> Must be strictly rejected with HTTP 403 Forbidden
        bad_short = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "APPROVED_FOR_DISPENSING", "dispense_rationale": "Short"},
            headers=auth_headers,
        )
        assert bad_short.status_code == 403
        assert "Clinical Safety Invariant" in bad_short.json()["detail"]
        assert "Emergency referral cannot be overridden" in bad_short.json()["detail"]

    def test_emergency_referral_rejects_dispensing_with_long_plausible_rationale(
        self, client: TestClient, auth_headers: dict
    ):
        """Clinical Safety Invariant: Emergency referral cannot transition to APPROVED_FOR_DISPENSING even with long rationale."""
        sev_payload = {
            "patient_identifier": "SYN-EMERGENCY-OVERRIDE-LONG",
            "age_years": 3,
            "temperature_c": 39.6,
            "mrdt_status": "CONFIRMED_POSITIVE",
            "chief_complaint": "Child convulsing with fever and prostration",
            "symptoms": ["fever", "convulsions", "prostration"],
            "proposed_items": [],
        }
        c_resp = client.post("/api/v1/community/consultations", json=sev_payload, headers=auth_headers)
        assert c_resp.status_code == 201
        c_id = c_resp.json()["id"]

        client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "FINDINGS_REVIEWED"},
            headers=auth_headers,
        )

        # Attempt to bypass emergency referral with long, plausible-sounding text
        long_rationale = (
            "Patient relative insisted on immediate oral medication at counter and signed informal waiver; "
            "pharmacist discussed risks and agreed to dispense routine antimalarial under observation."
        )
        bad_long = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "APPROVED_FOR_DISPENSING", "dispense_rationale": long_rationale},
            headers=auth_headers,
        )
        assert bad_long.status_code == 403
        assert "Clinical Safety Invariant" in bad_long.json()["detail"]
        assert "Emergency referral cannot be overridden" in bad_long.json()["detail"]

    def test_emergency_referral_rejects_dispensed_directly(
        self, client: TestClient, auth_headers: dict
    ):
        """Emergency referral cannot be bypassed directly to DISPENSED or COMPLETED skipping referral."""
        sev_payload = {
            "patient_identifier": "SYN-EMERGENCY-BYPASS-DIRECT",
            "age_years": 28,
            "chief_complaint": "Suspected meningitis with neck stiffness",
            "symptoms": ["fever", "neck_stiffness", "photophobia"],
            "temperature_c": 39.1,
            "proposed_items": [],
        }
        c_resp = client.post("/api/v1/community/consultations", json=sev_payload, headers=auth_headers)
        assert c_resp.status_code == 201
        c_id = c_resp.json()["id"]

        # Attempt illegal direct transition to DISPENSED
        direct_disp = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "DISPENSED"},
            headers=auth_headers,
        )
        assert direct_disp.status_code in (400, 403)

    def test_emergency_referral_permits_completed_referral_transition(
        self, client: TestClient, auth_headers: dict
    ):
        """Emergency referral safely completes through permitted REFERRED -> COMPLETED path."""
        sev_payload = {
            "patient_identifier": "SYN-EMERGENCY-PERMITTED-PATH",
            "age_years": 2,
            "temperature_c": 39.4,
            "mrdt_status": "CONFIRMED_POSITIVE",
            "chief_complaint": "Child prostrated and unable to drink",
            "symptoms": ["fever", "unable_to_drink", "prostration"],
            "proposed_items": [],
        }
        c_resp = client.post("/api/v1/community/consultations", json=sev_payload, headers=auth_headers)
        assert c_resp.status_code == 201
        c_id = c_resp.json()["id"]

        # Step 1: FINDINGS_REVIEWED
        r1 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={"target_state": "FINDINGS_REVIEWED"},
            headers=auth_headers,
        )
        assert r1.status_code == 200

        # Step 2: REFERRED (Permitted emergency action)
        r2 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={
                "target_state": "REFERRED",
                "referral_notes": "Emergency transfer arranged to Princess Marie Louise Children's Hospital via ambulance.",
            },
            headers=auth_headers,
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "REFERRED"

        # Step 3: COMPLETED (Referral handoff completed and acknowledged)
        r3 = client.post(
            f"/api/v1/community/consultations/{c_id}/transition",
            json={
                "target_state": "COMPLETED",
                "pharmacist_notes": "Emergency transport dispatched. Printed referral sheet handed to escort.",
            },
            headers=auth_headers,
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "COMPLETED"

    def test_five_epistemic_states_and_missing_data_integrity(
        self, client: TestClient, auth_headers: dict
    ):
        """Validates all 5 epistemic states and ensures missing data is not assumed negative."""
        payload = {
            "patient_identifier": "SYN-EPISTEMIC-TEST-01",
            "age_years": 32,
            "gender": "FEMALE",
            "temperature_c": 38.3,
            "mrdt_status": "NOT_DONE",  # Missing diagnostic must NOT be treated as negative
            "g6pd_status": "NOT_COLLECTED",
            "chief_complaint": "Fever and generalized fatigue",
            "symptoms": ["fever"],
            "allergies": [
                {"allergen": "Penicillin", "state": "CONFIRMED_OBJECTIVE", "reaction": "Anaphylaxis in 2021 hospital record"},
                {"allergen": "Sulfonamides", "state": "REPORTED_UNVERIFIED", "reaction": "Patient states mother told her she was allergic"},
                {"allergen": "Aspirin", "state": "PATIENT_UNKNOWN", "reaction": "Patient never taken before"},
                {"allergen": "NSAIDs", "state": "NOT_COLLECTED", "reaction": None},
                {"allergen": "Latex", "state": "CLINICALLY_IRRELEVANT", "reaction": "Dental exposure only"},
            ],
            "proposed_items": [],
        }
        resp = client.post("/api/v1/community/consultations", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert len(data["allergies"]) == 5
        states = [a["state"] for a in data["allergies"]]
        assert "CONFIRMED_OBJECTIVE" in states
        assert "REPORTED_UNVERIFIED" in states
        assert "PATIENT_UNKNOWN" in states
        assert "NOT_COLLECTED" in states
        assert "CLINICALLY_IRRELEVANT" in states

        # Epistemic invariant: mrdt_status NOT_DONE is retained and not assumed negative
        assert data["mrdt_status"] == "NOT_DONE"
        assert data["g6pd_status"] == "NOT_COLLECTED"

    def test_list_clinical_rules_meta(self, client: TestClient, auth_headers: dict):
        """Clinical rules metadata table tracks approval status, source reference, and governance."""
        response = client.get("/api/v1/community/rules", headers=auth_headers)
        assert response.status_code == 200
        rules = response.json()
        assert len(rules) >= 5
        for r in rules:
            assert r["approval_status"] == "BLOCKED_PENDING_FACULTY_APPROVAL"
            assert r["is_active"] is False
            assert "source_reference" in r
            assert len(r["source_reference"]) > 10

    def test_open_ended_clinical_intake_preserves_custom_data(self, client: TestClient, auth_headers: dict):
        """Open-ended intake accepts arbitrary symptoms, comorbidities, home meds, and custom POC tests."""
        payload = {
            "patient_identifier": "SYN-OPEN-INTAKE-01",
            "age_years": 48,
            "gender": "MALE",
            "weight_kg": 76.5,
            "temperature_c": 36.8,
            "sbp_mmhg": 135,
            "dbp_mmhg": 85,
            "chief_complaint": "Patient presents with persistent localized rash on bilateral forearms and lower back pain.",
            "symptoms": ["pruritic_maculopapular_rash", "lower_back_pain", "mild_dysuria"],
            "medical_history": ["Asthma", "Peptic Ulcer Disease", "Hypertension"],
            "current_medications": ["Amlodipine 10mg OD", "Salbutamol Inhaler PRN"],
            "diagnostic_tests": [
                {
                    "test_name": "Urine Dipstick (POC)",
                    "result": "Leukocytes 1+, Nitrite Negative, Protein Trace",
                    "epistemic_status": "CONFIRMED_OBJECTIVE",
                }
            ],
            "allergies": [
                {"allergen": "Penicillin", "state": "CONFIRMED_OBJECTIVE", "reaction": "Urticaria in 2018"}
            ],
            "proposed_items": [
                {
                    "drug_name": "Cetirizine",
                    "strength": "10mg",
                    "dosage_form": "Tablet",
                    "dose_amount": 10.0,
                    "dose_unit": "mg",
                    "frequency": "OD",
                    "duration_days": 5,
                    "route": "Oral",
                    "instructions": "Take at bedtime",
                    "legal_category": "OTC",
                }
            ],
        }

        resp = client.post("/api/v1/community/consultations", json=payload, headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()

        # Verify open-ended data persistence
        assert data["medical_history"] == ["Asthma", "Peptic Ulcer Disease", "Hypertension"]
        assert data["current_medications"] == ["Amlodipine 10mg OD", "Salbutamol Inhaler PRN"]
        assert len(data["diagnostic_tests"]) == 1
        assert data["diagnostic_tests"][0]["test_name"] == "Urine Dipstick (POC)"
        assert "pruritic_maculopapular_rash" in data["symptoms"]
        assert "lower_back_pain" in data["symptoms"]
        assert data["items"][0]["drug_name"] == "Cetirizine"

        # Verify transparent boundary reporting
        assert data["evaluated_rules_count"] >= 5
        assert len(data["uncovered_clinical_areas"]) > 0
        assert any("Open-ended" in area for area in data["uncovered_clinical_areas"])

    def test_afebrile_severe_danger_signs_trigger_emergency_referral(self):
        """Afebrile patient with convulsions and blackwater must trigger emergency referral."""
        res = RedFlagEngine.evaluate(
            age_years=25,
            temperature_c=36.4,  # Completely afebrile
            mrdt_status="NOT_DONE",  # Unperformed test
            symptoms=["convulsions", "dark_urine", "prostration"],
        )
        assert res.referral_triggered is True
        assert res.referral_urgency == "EMERGENCY"
        assert any(f.rule_identifier == "RF-EMG-CRIT-01" for f in res.findings)

    def test_asymptomatic_severe_hypertension_triggers_urgency_advisory(self):
        """Severe BP (190/115) without acute end-organ symptoms triggers urgent re-measurement protocol."""
        res = RedFlagEngine.evaluate(
            age_years=55,
            sbp_mmhg=190,
            dbp_mmhg=115,
            symptoms=["mild_fatigue"],  # No acute CVD symptoms
        )
        assert res.referral_urgency == "URGENT"
        assert any(f.rule_identifier == "RF-CVD-URG-01" for f in res.findings)
        assert not any(f.rule_identifier == "RF-CVD-HYP-01" for f in res.findings)
