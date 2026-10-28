"""Drug-drug interaction deterministic verification service."""
import itertools
from sqlalchemy.orm import Session
from app.models.prescription import Prescription
from app.models.reference import DrugInteractionRule
from app.services.verification.models import GeneratedFinding


def check_interactions(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Evaluate pairs of prescribed medications against the configured demonstration
    drug interaction reference catalog.
    """
    findings: list[GeneratedFinding] = []
    items = prescription.items

    if len(items) <= 1:
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-INT-SINGLE-ITEM",
                category="DRUG_INTERACTION",
                severity="INFO",
                status="CLEAN",
                message="Single medication ordered; no concurrent prescription drug-drug interactions evaluated.",
                evidence="Interaction checking requires at least two concurrently ordered medications.",
                rule_source="Demo Drug Interaction Matrix",
                human_review_required=False,
            )
        )
        return findings

    all_rules = db.query(DrugInteractionRule).all()
    interactions_found = False

    # Check every distinct pair of medications
    for item_a, item_b in itertools.combinations(items, 2):
        med_a = item_a.medication
        med_b = item_b.medication

        a_identifiers = {
            med_a.id.strip().upper(),
            med_a.generic_name.strip().upper(),
            med_a.drug_class.strip().upper(),
        }
        b_identifiers = {
            med_b.id.strip().upper(),
            med_b.generic_name.strip().upper(),
            med_b.drug_class.strip().upper(),
        }

        matched_rule: DrugInteractionRule | None = None
        for rule in all_rules:
            rule_a = rule.drug_a_class_or_id.strip().upper()
            rule_b = rule.drug_b_class_or_id.strip().upper()

            # Direction 1: a matches rule_a and b matches rule_b
            if rule_a in a_identifiers and rule_b in b_identifiers:
                matched_rule = rule
                break
            # Direction 2: b matches rule_a and a matches rule_b
            if rule_a in b_identifiers and rule_b in a_identifiers:
                matched_rule = rule
                break

        if matched_rule:
            interactions_found = True
            rule_sev = matched_rule.severity.strip().upper()
            severity = rule_sev if rule_sev in ["HIGH", "MODERATE", "LOW", "INFO"] else "MODERATE"

            findings.append(
                GeneratedFinding(
                    rule_identifier=matched_rule.id,
                    category="DRUG_INTERACTION",
                    severity=severity,
                    status="CONFLICT_DETECTED",
                    message=f"Drug Interaction ({severity}): {med_a.generic_name} + {med_b.generic_name}.",
                    evidence=(
                        f"Interaction detected between {med_a.generic_name} ({med_a.drug_class}) and "
                        f"{med_b.generic_name} ({med_b.drug_class}). Clinical Effect: {matched_rule.clinical_effect}. "
                        f"Reference Evidence: {matched_rule.evidence}"
                    ),
                    rule_source=matched_rule.rule_source,
                    human_review_required=(severity in ["HIGH", "MODERATE"]),
                )
            )

    if not interactions_found:
        names = ", ".join([i.medication.generic_name for i in items])
        findings.append(
            GeneratedFinding(
                rule_identifier="RULE-INT-NO-CONFLICT",
                category="DRUG_INTERACTION",
                severity="INFO",
                status="CLEAN",
                message="No configured drug interactions detected among prescribed medications.",
                evidence=f"Concurrent evaluation of [{names}] against demo DDI catalog revealed no conflicts.",
                rule_source="Demo Drug Interaction Matrix",
                human_review_required=False,
            )
        )

    return findings
