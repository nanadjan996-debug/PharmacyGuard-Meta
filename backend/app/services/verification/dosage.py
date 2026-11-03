"""Dosage and frequency deterministic verification service."""
import re
from sqlalchemy.orm import Session
from app.models.prescription import Prescription, PrescriptionItem
from app.models.reference import DosageRule
from app.services.verification.models import GeneratedFinding

# Standard clinical frequency multiplier lookup (times per 24 hours)
FREQUENCY_MULTIPLIERS: dict[str, float] = {
    "once daily": 1.0,
    "qd": 1.0,
    "q24h": 1.0,
    "every morning": 1.0,
    "daily": 1.0,
    "twice daily (bid)": 2.0,
    "twice daily": 2.0,
    "bid": 2.0,
    "q12h": 2.0,
    "every 12 hours": 2.0,
    "three times daily (tid)": 3.0,
    "three times daily": 3.0,
    "tid": 3.0,
    "q8h": 3.0,
    "every 8 hours": 3.0,
    "every 8 hours (q8h)": 3.0,
    "four times daily (qid)": 4.0,
    "four times daily": 4.0,
    "qid": 4.0,
    "q6h": 4.0,
    "every 6 hours": 4.0,
    "every 6 hours (q6h)": 4.0,
    "every 4 hours (q4h)": 6.0,
    "every 4 hours": 6.0,
    "q4h": 6.0,
}


def parse_frequency_multiplier(frequency_str: str) -> float | None:
    """
    Parse a clinical dosing frequency string into a 24-hour daily multiplier.
    Returns None if the frequency format cannot be deterministically evaluated.
    """
    if not frequency_str:
        return None
    cleaned = frequency_str.strip().lower()

    # Direct match
    if cleaned in FREQUENCY_MULTIPLIERS:
        return FREQUENCY_MULTIPLIERS[cleaned]

    # Keyword search
    for key, mult in FREQUENCY_MULTIPLIERS.items():
        if key in cleaned:
            return mult

    # Regex patterns for custom intervals: e.g. "q(X)h" or "every (X) hours"
    q_match = re.search(r"q(\d+)h", cleaned)
    if q_match:
        hours = int(q_match.group(1))
        if 0 < hours <= 24:
            return 24.0 / hours

    every_match = re.search(r"every\s+(\d+)\s+hours?", cleaned)
    if every_match:
        hours = int(every_match.group(1))
        if 0 < hours <= 24:
            return 24.0 / hours

    return None


def convert_to_mg(amount: float, unit: str) -> tuple[float | None, str | None]:
    """
    Convert a dose amount and unit into milligrams (mg).
    Returns (amount_in_mg, error_message).
    """
    if amount is None or amount <= 0:
        return None, f"Invalid non-positive dose amount: {amount}"

    u = (unit or "").strip().lower()
    if u == "mg":
        return amount, None
    elif u == "g":
        return amount * 1000.0, None
    elif u == "mcg":
        return amount / 1000.0, None
    else:
        return None, f"Unsupported dosage unit '{unit}'. Reference rules require milligram (mg) equivalence."


def check_dosages(prescription: Prescription, db: Session) -> list[GeneratedFinding]:
    """
    Evaluate prescribed dose, unit, and frequency against configured demonstration dosage limits.
    Calculates daily amount using explicit unit normalization and dosing frequency.
    Safely handles missing values, invalid inputs, and unconfigured reference rules.
    """
    findings: list[GeneratedFinding] = []

    for item in prescription.items:
        med = item.medication

        # 1. Validate dosage amount and unit
        dose_mg, unit_err = convert_to_mg(item.dose_amount, item.dose_unit)
        if unit_err is not None or dose_mg is None:
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-DOSE-UNIT-INVALID-{med.id}",
                    category="DOSAGE",
                    severity="HIGH" if item.dose_amount <= 0 else "MODERATE",
                    status="CONFLICT_DETECTED" if item.dose_amount <= 0 else "INSUFFICIENT_DATA",
                    message=f"Dose calculation error for {med.generic_name}: {unit_err}",
                    evidence=(
                        f"Prescription item specifies dose {item.dose_amount} {item.dose_unit}. "
                        f"Cannot safely perform automated deterministic dosage evaluation: {unit_err}"
                    ),
                    rule_source="Dosage Calculation & Unit Safety Module",
                    human_review_required=True,
                )
            )
            continue

        # 2. Parse frequency into daily multiplier
        multiplier = parse_frequency_multiplier(item.frequency)
        if multiplier is None:
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-DOSE-FREQ-UNKNOWN-{med.id}",
                    category="DOSAGE",
                    severity="MODERATE",
                    status="INSUFFICIENT_DATA",
                    message=f"Unrecognized dosing frequency '{item.frequency}' for {med.generic_name}.",
                    evidence=(
                        f"{med.generic_name} prescribed with frequency '{item.frequency}'. "
                        f"Deterministic daily multiplier cannot be established. Manual dosing review required."
                    ),
                    rule_source="Dosage Frequency Parser",
                    human_review_required=True,
                )
            )
            continue

        daily_dose_mg = dose_mg * multiplier

        # 3. Lookup configured demonstration dosage rules for this medication
        rule = db.query(DosageRule).filter_by(medication_id=med.id).first()
        if not rule:
            findings.append(
                GeneratedFinding(
                    rule_identifier=f"RULE-DOSE-MISSING-RULE-{med.id}",
                    category="DOSAGE",
                    severity="MODERATE",
                    status="INSUFFICIENT_DATA",
                    message=f"No demonstration dosage reference rule configured for {med.generic_name}.",
                    evidence=(
                        f"{med.generic_name} ({dose_mg} mg {item.frequency}, {daily_dose_mg:.1f} mg/day) "
                        f"lacks a configured demonstration dosage limit in reference catalog. Manual pharmacist review required."
                    ),
                    rule_source="Clinical Dosing Reference Catalog (USP-NF/Lexicomp)",
                    human_review_required=True,
                )
            )
            continue

        # 4. Check single dose limit
        if dose_mg > rule.max_single_dose_mg:
            findings.append(
                GeneratedFinding(
                    rule_identifier=rule.id,
                    category="DOSAGE",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=(
                        f"Single dose of {med.generic_name} ({dose_mg} mg) exceeds maximum "
                        f"demonstration single dose limit ({rule.max_single_dose_mg} mg)."
                    ),
                    evidence=(
                        f"DOSAGE LIMIT EXCEEDED: Prescribed single dose is {dose_mg} mg, "
                        f"exceeding max single dose of {rule.max_single_dose_mg} mg. "
                        f"Frequency: {item.frequency} (calculated daily: {daily_dose_mg:.1f} mg). {rule.evidence}"
                    ),
                    rule_source=rule.rule_source,
                    human_review_required=True,
                )
            )
            continue

        # 5. Check daily dose limits
        if daily_dose_mg > rule.max_daily_dose_mg:
            findings.append(
                GeneratedFinding(
                    rule_identifier=rule.id,
                    category="DOSAGE",
                    severity="HIGH",
                    status="CONFLICT_DETECTED",
                    message=(
                        f"Calculated daily dose of {med.generic_name} ({daily_dose_mg:.1f} mg/day) exceeds "
                        f"maximum demonstration daily limit ({rule.max_daily_dose_mg} mg/day)."
                    ),
                    evidence=(
                        f"MAXIMUM DAILY DOSE EXCEEDED: Prescribed {dose_mg} mg {item.frequency} yields "
                        f"{daily_dose_mg:.1f} mg/day, exceeding the reference upper threshold of {rule.max_daily_dose_mg} mg/day. "
                        f"{rule.evidence}"
                    ),
                    rule_source=rule.rule_source,
                    human_review_required=True,
                )
            )
        elif daily_dose_mg < rule.min_daily_dose_mg:
            findings.append(
                GeneratedFinding(
                    rule_identifier=rule.id,
                    category="DOSAGE",
                    severity="LOW",
                    status="REVIEW_REQUIRED",
                    message=(
                        f"Calculated daily dose of {med.generic_name} ({daily_dose_mg:.1f} mg/day) is below "
                        f"demonstration therapeutic range ({rule.min_daily_dose_mg} mg/day)."
                    ),
                    evidence=(
                        f"SUB-THERAPEUTIC DOSAGE ADVISORY: Prescribed {dose_mg} mg {item.frequency} yields "
                        f"{daily_dose_mg:.1f} mg/day, below standard minimum therapeutic threshold of {rule.min_daily_dose_mg} mg/day. "
                        f"Verify if intentional titration or dose reduction for renal/hepatic impairment. {rule.evidence}"
                    ),
                    rule_source=rule.rule_source,
                    human_review_required=True,
                )
            )
        else:
            findings.append(
                GeneratedFinding(
                    rule_identifier=rule.id,
                    category="DOSAGE",
                    severity="INFO",
                    status="CLEAN",
                    message=f"Dose for {med.generic_name} is within demonstration therapeutic limits.",
                    evidence=(
                        f"Prescribed single dose ({dose_mg} mg) and calculated daily total ({daily_dose_mg:.1f} mg/day) "
                        f"fall safely within demonstration reference bounds ({rule.min_daily_dose_mg}–{rule.max_daily_dose_mg} mg/day, "
                        f"max single {rule.max_single_dose_mg} mg). {rule.evidence}"
                    ),
                    rule_source=rule.rule_source,
                    human_review_required=False,
                )
            )

    return findings
