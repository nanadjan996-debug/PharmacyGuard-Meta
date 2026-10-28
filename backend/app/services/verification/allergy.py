"""Allergy and Cross-Reactivity deterministic verification service."""
from sqlalchemy.orm import Session
from app.models.prescription import Prescription
from app.models.reference import AllergyCrossReactivityRule
from app.services.verification.models import GeneratedFinding


def check_allergies(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Compare documented synthetic allergies against prescribed medications
    and configured demonstration cross-reactivity rules.
    """
    findings: list[GeneratedFinding] = []
    patient = prescription.patient
    allergies = patient.allergies

    if not allergies:
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-ALG-CLEAN-NKDA",
                category="ALLERGY",
                severity="INFO",
                status="CLEAN",
                message="No documented drug allergies on patient profile.",
                evidence=f"Patient {patient.first_name} {patient.last_name} (MRN: {patient.mrn}) has no documented drug allergies (NKDA).",
                rule_source="Patient Medical Record (Allergy History)",
                human_review_required=False,
            )
        )
        return findings

    all_cross_rules = db.query(AllergyCrossReactivityRule).all()
    allergy_conflicts_found = False

    for item in prescription.items:
        med = item.medication
        for allergy in allergies:
            allergen_clean = allergy.allergen.strip().lower()
            generic_clean = med.generic_name.strip().lower()
            brand_clean = med.brand_name.strip().lower()
            class_clean = med.drug_class.strip().lower()

            is_direct_match = (
                allergen_clean in generic_clean
                or allergen_clean in brand_clean
                or allergen_clean in class_clean
                or class_clean in allergen_clean
            )

            # Check cross-reactivity rules
            matching_cross_rule: AllergyCrossReactivityRule | None = None
            for cr in all_cross_rules:
                if (
                    cr.allergen_class.strip().lower() == allergen_clean
                    and cr.cross_reactive_class.strip().lower() == class_clean
                ):
                    matching_cross_rule = cr
                    break

            if is_direct_match or matching_cross_rule:
                allergy_conflicts_found = True
                is_anaphylaxis_or_severe = allergy.severity in ["Anaphylaxis", "Severe"]
                risk_is_high = matching_cross_rule and matching_cross_rule.risk_level.lower() == "high"

                severity = "HIGH" if (is_anaphylaxis_or_severe or risk_is_high) else "MODERATE"
                rule_id = (
                    matching_cross_rule.id
                    if matching_cross_rule
                    else f"RULE-ALG-DIRECT-{med.id}"
                )
                source = (
                    matching_cross_rule.rule_source
                    if matching_cross_rule
                    else "Direct Allergen Identity Check"
                )

                rule_type = "Cross-reactivity" if (matching_cross_rule and not is_direct_match) else "Direct allergen"
                rate_str = f" (Estimated risk: {matching_cross_rule.cross_reactivity_rate_pct}%)" if matching_cross_rule else ""

                findings.append(
                    GeneratedFinding(
                        rule_identifier=rule_id,
                        category="ALLERGY",
                        severity=severity,
                        status="CONFLICT_DETECTED",
                        message=f"{severity} ALLERGY CONFLICT: {rule_type} match for {med.generic_name}.",
                        evidence=(
                            f"Patient documented allergy: {allergy.allergen} (Severity: {allergy.severity}, "
                            f"Reaction: '{allergy.reaction}'). Prescribed: {med.generic_name} ({med.drug_class}){rate_str}. "
                            f"Clinical risk: {matching_cross_rule.evidence if matching_cross_rule else 'Direct chemical/class identity match.'}"
                        ),
                        rule_source=source,
                        human_review_required=True,
                    )
                )

    if not allergy_conflicts_found:
        documented_allergens = ", ".join([a.allergen for a in allergies])
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-ALG-NO-CONFLICT",
                category="ALLERGY",
                severity="INFO",
                status="CLEAN",
                message="No conflict with documented patient allergies.",
                evidence=(
                    f"Prescribed medications evaluated against documented patient allergies ({documented_allergens}). "
                    f"No direct matches or demonstration cross-reactivity conflicts identified."
                ),
                rule_source="Demo Allergy & Cross-Reactivity Catalog",
                human_review_required=False,
            )
        )

    return findings
