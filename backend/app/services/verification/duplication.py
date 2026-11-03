"""Duplicate medication and therapeutic duplication verification service."""
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.prescription import Prescription
from app.services.verification.models import GeneratedFinding


def check_duplications(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Detect duplicate active ingredients and configured therapeutic-class duplication,
    such as concurrent systemic NSAID therapy.
    """
    findings: list[GeneratedFinding] = []
    items = prescription.items

    if len(items) <= 1:
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-DUP-SINGLE-ITEM",
                category="THERAPEUTIC_DUPLICATION",
                severity="INFO",
                status="CLEAN",
                message="Single medication ordered; no therapeutic duplication detected.",
                evidence="Prescription contains a single medication line item.",
                rule_source="Clinical Duplication Monitoring Service",
                human_review_required=False,
            )
        )
        return findings

    # 1. Active Ingredient Duplication Check
    ingredient_map = defaultdict(list)
    for item in items:
        ingredient_map[item.medication.generic_name.strip().lower()].append(item)

    ingredient_dups_found = False
    for ingredient, matched_items in ingredient_map.items():
        if len(matched_items) > 1:
            ingredient_dups_found = True
            med_names = [f"{i.medication.brand_name} ({i.medication.standard_strength})" for i in matched_items]
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-DUP-ING-{ingredient.upper()[:10]}",
                    category="THERAPEUTIC_DUPLICATION",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=f"Duplicate active ingredient detected: {matched_items[0].medication.generic_name}.",
                    evidence=(
                        f"Multiple prescription items prescribe the same active ingredient ({matched_items[0].medication.generic_name}): "
                        f"{', '.join(med_names)}. Risk of unintentional additive overdosing."
                    ),
                    rule_source="Active Ingredient Identity Check",
                    human_review_required=True,
                )
            )

    # 2. Configured Therapeutic Class Duplication (e.g. Systemic NSAID)
    class_map = defaultdict(list)
    for item in items:
        class_map[item.medication.drug_class.strip()].append(item)

    # Configured classes where concurrent multiple systemic agents are restricted
    DUPLICATION_RESTRICTED_CLASSES = {
        "NSAID": (
            "Concurrent systemic NSAID therapy produces a ceiling effect for analgesia while "
            "substantially multiplying the risk of gastrointestinal bleeding, ulceration, and acute kidney injury."
        ),
        "ACE Inhibitor": (
            "Dual renin-angiotensin-aldosterone system inhibition is generally contraindicated due to severe hypotension and hyperkalemia risk."
        ),
        "Anticoagulant": (
            "Dual systemic anticoagulation substantially elevates life-threatening major hemorrhage risk."
        ),
    }

    class_dups_found = False
    for drug_class, matched_items in class_map.items():
        if len(matched_items) > 1 and drug_class in DUPLICATION_RESTRICTED_CLASSES:
            class_dups_found = True
            names = [f"{i.medication.generic_name} {i.dose_amount}{i.dose_unit}" for i in matched_items]
            clinical_risk = DUPLICATION_RESTRICTED_CLASSES[drug_class]
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-DUP-CLASS-{drug_class.upper()}",
                    category="THERAPEUTIC_DUPLICATION",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=f"Therapeutic class duplication: Multiple {drug_class} agents prescribed concurrently.",
                    evidence=(
                        f"Prescription contains {len(matched_items)} concurrent agents belonging to the same therapeutic class ({drug_class}): "
                        f"{', '.join(names)}. Clinical rationale: {clinical_risk}"
                    ),
                    rule_source=f"Clinical Duplication Reference DUP-2026-{drug_class.upper()}",
                    human_review_required=True,
                )
            )

    if not ingredient_dups_found and not class_dups_found:
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-DUP-CLEAN",
                category="THERAPEUTIC_DUPLICATION",
                severity="INFO",
                status="CLEAN",
                message="No duplicate active ingredients or restricted therapeutic class overlap detected.",
                evidence="All prescribed medications have distinct active ingredients and acceptable therapeutic diversity.",
                rule_source="Clinical Duplication Monitoring Service",
                human_review_required=False,
            )
        )

    return findings
