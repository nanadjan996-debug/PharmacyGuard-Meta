"""Diagnosis–Medication Indication verification service."""
from sqlalchemy.orm import Session
from app.models.prescription import Prescription, PrescriptionItem
from app.models.reference import IndicationRule
from app.services.verification.models import GeneratedFinding


def check_indications(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Compare each prescribed medication against configured demonstration indication rules
    and the patient's active documented diagnoses.
    
    Missing supporting diagnostic information is reported as REVIEW_REQUIRED / INSUFFICIENT_DATA,
    never as definitive proof that the medication is clinically inappropriate.
    """
    findings: list[GeneratedFinding] = []
    patient = prescription.patient
    active_diagnoses = [d for d in patient.diagnoses if d.is_active]
    patient_icd10_codes = {d.icd10_code.strip().upper() for d in active_diagnoses}
    patient_diag_summary = ", ".join([f"{d.icd10_code} ({d.description})" for d in active_diagnoses])

    for item in prescription.items:
        med = item.medication
        # Query configured demonstration indication rules for this medication
        rules = db.query(IndicationRule).filter_by(medication_id=med.id).all()

        if not rules:
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-IND-UNKNOWN-{med.id}",
                    category="INDICATION",
                    severity="MODERATE",
                    status="INSUFFICIENT_DATA",
                    message=f"No demonstration indication rule configured for {med.generic_name}.",
                    evidence=(
                        f"{med.generic_name} ({med.standard_strength}) prescribed without a matching "
                        f"demonstration indication rule in the reference catalog. Manual pharmacist indication review required. "
                        f"Documented diagnoses: {patient_diag_summary or 'None'}."
                    ),
                    rule_source="Demo Indication Rule Catalog (Unconfigured Reference)",
                    human_review_required=True,
                )
            )
            continue

        matched_rule: IndicationRule | None = None
        matched_icd10: str | None = None

        for rule in rules:
            approved_codes = [c.strip().upper() for c in rule.approved_icd10_codes.split(",") if c.strip()]
            for app_code in approved_codes:
                for pat_code in patient_icd10_codes:
                    # Match exact or prefix (e.g., E11 matches E11.9)
                    if pat_code == app_code or pat_code.startswith(app_code) or app_code.startswith(pat_code):
                        matched_rule = rule
                        matched_icd10 = pat_code
                        break
                if matched_rule:
                    break
            if matched_rule:
                break

        if matched_rule:
            diag_obj = next((d for d in active_diagnoses if d.icd10_code.strip().upper() == matched_icd10), None)
            diag_desc = diag_obj.description if diag_obj else matched_icd10
            findings.append(
                GeneratedFinding(
                    rule_identifier=matched_rule.id,
                    category="INDICATION",
                    severity="INFO",
                    status="CLEAN",
                    message=f"Documented indication verified for {med.generic_name}.",
                    evidence=(
                        f"Prescription for {med.generic_name} {item.dose_amount}{item.dose_unit} aligns with "
                        f"documented diagnosis {matched_icd10} ({diag_desc}) under approved indication: "
                        f"'{matched_rule.indication_name}'."
                    ),
                    rule_source=matched_rule.rule_source,
                    human_review_required=False,
                )
            )
        else:
            primary_rule = rules[0]
            findings.append(
                GeneratedFinding(
                    rule_identifier=primary_rule.id,
                    category="INDICATION",
                    severity="MODERATE",
                    status="REVIEW_REQUIRED",
                    message=f"Indication review required: Missing supporting diagnosis for {med.generic_name}.",
                    evidence=(
                        f"{med.generic_name} prescribed without active supporting diagnosis in patient profile. "
                        f"Configured approved ICD-10 codes for '{primary_rule.indication_name}': [{primary_rule.approved_icd10_codes}]. "
                        f"Patient documented diagnoses: {patient_diag_summary or 'No documented diagnoses'}."
                    ),
                    rule_source=primary_rule.rule_source,
                    human_review_required=True,
                )
            )

    return findings
