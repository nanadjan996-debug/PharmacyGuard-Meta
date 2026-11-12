"""Deterministic Red-Flag Detection and Referral Triage Engine for Community Pharmacy.

Implements Ghana clinical triage rules:
- RF-MAL-SEV-01: Severe / Complicated Malaria (GHS NMCP 2020 Guidelines)
- RF-CVD-HYP-01: Hypertensive Crisis / Emergency (Ghana STG 2017 Ch. 11)
- RF-ABD-ACU-01: Acute Abdomen / Suspected Surgical Emergency (Ghana STG 2017 Ch. 18)
- RF-PED-RES-01: Pediatric Severe Pneumonia / Respiratory Distress (IMCI / GHS STG Ch. 24)
- RF-NEU-MEN-01: Acute Neurological / Suspected Meningitis (Ghana STG 2017 Ch. 20)

Binding Safety Invariants:
1. When severe disease is detected, emergency referral is triggered immediately.
2. In RF-MAL-SEV-01, routine oral ACT is STRICTLY CONTRAINDICATED and flagged.
3. Medication administration (pre-referral rectal artesunate) is marked
   BLOCKED_PENDING_CLINICAL_APPROVAL until faculty approval of weight-specific protocol.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Sequence


@dataclass
class RedFlagFinding:
    rule_identifier: str
    category: str
    severity: str  # HIGH, MODERATE, LOW, INFO
    title: str
    description: str
    action_required: str
    is_red_flag: bool = True
    requires_referral: bool = True
    referral_urgency: str | None = "EMERGENCY"  # EMERGENCY, URGENT, ROUTINE
    epistemic_status: str = "CONFIRMED_OBJECTIVE"  # CONFIRMED_OBJECTIVE, REPORTED_UNVERIFIED, PATIENT_UNKNOWN, NOT_COLLECTED, CLINICALLY_IRRELEVANT


@dataclass
class TriageEvaluationResult:
    findings: list[RedFlagFinding] = field(default_factory=list)
    referral_triggered: bool = False
    referral_urgency: str | None = None
    referral_reason: str | None = None
    referral_note: str | None = None


class RedFlagEngine:
    """Evaluates walk-in clinical presentations for critical red-flag conditions."""

    # Common oral ACT brand and generic strings used in Ghana
    ORAL_ACT_KEYWORDS = [
        "artemether",
        "lumefantrine",
        "coartem",
        "artesunate",
        "amodiaquine",
        "dihydroartemisinin",
        "piperaquine",
        "lonart",
        "artequick",
        "malacur",
    ]

    @classmethod
    def evaluate(
        cls,
        age_years: int | None = None,
        age_months: int | None = None,
        gender: str | None = None,
        weight_kg: float | None = None,
        temperature_c: float | None = None,
        sbp_mmhg: int | None = None,
        dbp_mmhg: int | None = None,
        heart_rate_bpm: int | None = None,
        respiratory_rate_bpm: int | None = None,
        mrdt_status: str = "NOT_DONE",
        symptoms: Sequence[str] = (),
        proposed_medications: Sequence[str] = (),
    ) -> TriageEvaluationResult:
        findings: list[RedFlagFinding] = []
        norm_symptoms = [s.strip().lower().replace(" ", "_") for s in symptoms]
        norm_meds = [m.strip().lower() for m in proposed_medications]

        # -------------------------------------------------------------
        # 1. RF-MAL-SEV-01: Severe / Complicated Malaria
        # -------------------------------------------------------------
        is_febrile = (temperature_c is not None and temperature_c >= 38.0) or ("fever" in norm_symptoms)
        malaria_suspected_or_confirmed = (
            mrdt_status in ("CONFIRMED_POSITIVE", "TESTING_UNAVAILABLE") or is_febrile
        )

        severe_malaria_symptoms = [
            "prostration",
            "lethargy",
            "unconscious",
            "impaired_consciousness",
            "coma",
            "repeated_vomiting",
            "unable_to_drink",
            "unable_to_retain_fluids",
            "convulsions",
            "dark_urine",
            "blackwater",
            "respiratory_distress",
            "jaundice",
        ]
        active_sev_mal_symptoms = [s for s in severe_malaria_symptoms if s in norm_symptoms]

        if malaria_suspected_or_confirmed and active_sev_mal_symptoms:
            # Check for oral ACT contraindication
            has_oral_act = any(
                any(act_key in med for act_key in cls.ORAL_ACT_KEYWORDS)
                for med in norm_meds
            )

            desc = (
                f"Patient presents with fever/suspected malaria and clinical signs of severe/complicated malaria: "
                f"{', '.join(active_sev_mal_symptoms).replace('_', ' ')}. "
                "Per GHS NMCP 2020 guidelines, complicated malaria requires immediate transfer to a referral hospital."
            )
            act_req = (
                "EMERGENCY REFERRAL: Withhold routine counter treatment. Dispatch patient immediately to hospital. "
                "Note: Pre-referral rectal artesunate dosing (10 mg/kg) remains BLOCKED_PENDING_CLINICAL_APPROVAL "
                "pending formal faculty review of authorized clinical administration protocols."
            )
            if has_oral_act:
                act_req += " CRITICAL: Routine oral ACT is strictly contraindicated in severe/complicated malaria."

            findings.append(
                RedFlagFinding(
                    rule_identifier="RF-MAL-SEV-01",
                    category="RED_FLAG",
                    severity="HIGH",
                    title="Severe / Complicated Malaria Red Flag",
                    description=desc,
                    action_required=act_req,
                    is_red_flag=True,
                    requires_referral=True,
                    referral_urgency="EMERGENCY",
                )
            )

        # -------------------------------------------------------------
        # 2. RF-CVD-HYP-01: Hypertensive Crisis / Emergency
        # -------------------------------------------------------------
        is_severe_bp = (sbp_mmhg is not None and sbp_mmhg >= 180) or (
            dbp_mmhg is not None and dbp_mmhg >= 120
        )
        acute_cvd_symptoms = [
            "severe_headache",
            "blurred_vision",
            "chest_pain",
            "dyspnea",
            "shortness_of_breath",
            "neurological_deficit",
            "confusion",
        ]
        active_cvd_symptoms = [s for s in acute_cvd_symptoms if s in norm_symptoms]

        if is_severe_bp and active_cvd_symptoms:
            findings.append(
                RedFlagFinding(
                    rule_identifier="RF-CVD-HYP-01",
                    category="RED_FLAG",
                    severity="HIGH",
                    title="Hypertensive Crisis / Emergency Red Flag",
                    description=(
                        f"Blood pressure ({sbp_mmhg or '?'}/{dbp_mmhg or '?'} mmHg) is markedly elevated with acute end-organ "
                        f"symptoms: {', '.join(active_cvd_symptoms).replace('_', ' ')}. Risk of acute stroke, encephalopathy, or myocardial ischemia."
                    ),
                    action_required=(
                        "EMERGENCY REFERRAL: Do not administer oral counter antihypertensives (risk of precipitous BP drop and cerebral ischemia). "
                        "Rest patient in quiet seating, arrange emergency transport to nearest emergency department."
                    ),
                    is_red_flag=True,
                    requires_referral=True,
                    referral_urgency="EMERGENCY",
                )
            )

        # -------------------------------------------------------------
        # 3. RF-ABD-ACU-01: Acute Abdomen / Suspected Surgical Emergency
        # -------------------------------------------------------------
        has_abdo_pain = any(
            p in norm_symptoms
            for p in ["acute_abdominal_pain", "severe_abdominal_pain", "abdominal_pain"]
        )
        surgical_signs = [
            "abdominal_rigidity",
            "rigidity",
            "guarding",
            "rebound_tenderness",
            "bilious_vomiting",
            "feculent_vomiting",
            "distension",
        ]
        active_surgical_signs = [s for s in surgical_signs if s in norm_symptoms]

        if has_abdo_pain and active_surgical_signs:
            findings.append(
                RedFlagFinding(
                    rule_identifier="RF-ABD-ACU-01",
                    category="RED_FLAG",
                    severity="HIGH",
                    title="Acute Abdomen / Suspected Surgical Emergency",
                    description=(
                        f"Patient presents with acute severe abdominal pain and peritoneal signs: "
                        f"{', '.join(active_surgical_signs).replace('_', ' ')}. Suspected peritonitis, appendicitis, or bowel obstruction."
                    ),
                    action_required=(
                        "EMERGENCY REFERRAL: Withhold all oral analgesics, NSAIDs, opioids, and antispasmodics (masks surgical signs). "
                        "Maintain nil-per-os (NPO); immediate referral to surgical emergency team."
                    ),
                    is_red_flag=True,
                    requires_referral=True,
                    referral_urgency="EMERGENCY",
                )
            )

        # -------------------------------------------------------------
        # 4. RF-PED-RES-01: Pediatric Severe Pneumonia / Respiratory Distress
        # -------------------------------------------------------------
        is_pediatric = (age_years is not None and age_years < 5) or (
            age_months is not None and age_months < 60
        )
        has_respiratory_complaint = any(
            r in norm_symptoms
            for r in ["cough", "difficulty_breathing", "fast_breathing", "dyspnea"]
        )
        ped_res_signs = [
            "subcostal_chest_indrawing",
            "chest_indrawing",
            "stridor",
            "grunting",
            "cyanosis",
        ]
        active_ped_res_signs = [s for s in ped_res_signs if s in norm_symptoms]

        # Fast breathing criteria by IMCI
        has_fast_breathing = False
        if respiratory_rate_bpm is not None:
            if age_months is not None and age_months < 12 and respiratory_rate_bpm >= 50:
                has_fast_breathing = True
            elif (age_years is not None and 1 <= age_years < 5) and respiratory_rate_bpm >= 40:
                has_fast_breathing = True
            elif age_months is not None and 12 <= age_months < 60 and respiratory_rate_bpm >= 40:
                has_fast_breathing = True
            elif is_pediatric and respiratory_rate_bpm >= 50:
                has_fast_breathing = True

        if is_pediatric and (has_respiratory_complaint or active_ped_res_signs or has_fast_breathing):
            if active_ped_res_signs or has_fast_breathing:
                findings.append(
                    RedFlagFinding(
                        rule_identifier="RF-PED-RES-01",
                        category="RED_FLAG",
                        severity="HIGH",
                        title="Pediatric Severe Pneumonia / Respiratory Distress",
                        description=(
                            f"Child under 5 years exhibits severe respiratory distress "
                            f"(RR: {respiratory_rate_bpm or 'unrecorded'} bpm; Signs: {', '.join(active_ped_res_signs or ['fast breathing']).replace('_', ' ')}). "
                            "Per Ghana IMCI and STG 2017 Chapter 24, this constitutes severe pneumonia."
                        ),
                        action_required=(
                            "EMERGENCY REFERRAL: Do not dispense counter oral cough syrups, antihistamines, or sedatives. "
                            "Provide oxygen if available; dispatch immediately to pediatric hospital unit."
                        ),
                        is_red_flag=True,
                        requires_referral=True,
                        referral_urgency="EMERGENCY",
                    )
                )

        # -------------------------------------------------------------
        # 5. RF-NEU-MEN-01: Acute Neurological / Suspected Meningitis
        # -------------------------------------------------------------
        meningism_signs = [
            "neck_stiffness",
            "nuchal_rigidity",
            "photophobia",
            "kernig_sign",
            "brudzinski_sign",
            "bulging_fontanelle",
            "petechial_rash",
            "purpuric_rash",
        ]
        active_meningism = [s for s in meningism_signs if s in norm_symptoms]

        if is_febrile and active_meningism:
            findings.append(
                RedFlagFinding(
                    rule_identifier="RF-NEU-MEN-01",
                    category="RED_FLAG",
                    severity="HIGH",
                    title="Acute Neurological / Suspected Meningitis Red Flag",
                    description=(
                        f"Fever associated with meningeal signs: {', '.join(active_meningism).replace('_', ' ')}. "
                        "High suspicion of acute bacterial meningitis, an epidemic-prone medical emergency."
                    ),
                    action_required=(
                        "EMERGENCY REFERRAL: Zero counter treatment. Do not delay transport with oral medications. "
                        "Immediate transfer to hospital emergency unit for urgent lumbar puncture and IV antimicrobial therapy."
                    ),
                    is_red_flag=True,
                    requires_referral=True,
                    referral_urgency="EMERGENCY",
                )
            )

        # Check aggregate referral status
        referral_triggered = any(f.requires_referral for f in findings)
        referral_urgency = "EMERGENCY" if any(f.referral_urgency == "EMERGENCY" for f in findings) else None
        referral_reasons = [f.title for f in findings if f.requires_referral]
        referral_reason = "; ".join(referral_reasons) if referral_reasons else None

        referral_note = None
        if referral_triggered:
            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            age_str = f"{age_years} yrs" if age_years is not None else (f"{age_months} months" if age_months is not None else "Unknown age")
            referral_note = (
                f"===========================================================\n"
                f"GHANA HEALTH SERVICE / COMMUNITY PHARMACY EMERGENCY REFERRAL\n"
                f"===========================================================\n"
                f"Date/Time: {now_str}\n"
                f"Patient Age/Gender: {age_str} / {gender or 'Not specified'}\n"
                f"Weight: {weight_kg or 'Unmeasured'} kg\n"
                f"Vitals: Temp: {temperature_c or 'N/A'}°C | BP: {sbp_mmhg or 'N/A'}/{dbp_mmhg or 'N/A'} mmHg | HR: {heart_rate_bpm or 'N/A'} bpm | RR: {respiratory_rate_bpm or 'N/A'} bpm\n"
                f"mRDT Malaria Status: {mrdt_status}\n"
                f"Urgency Level: {referral_urgency}\n"
                f"Primary Clinical Reason: {referral_reason}\n\n"
                f"Mandated Clinical Summary:\n"
            )
            for f in findings:
                referral_note += f"• [{f.rule_identifier}] {f.title}: {f.description}\n  Action: {f.action_required}\n"
            referral_note += (
                f"\nDISPOSITION: Patient referred to nearest hospital / emergency center.\n"
                f"Community Pharmacist Decision Support: PharmacyGuard Community Edition v3.1\n"
                f"==========================================================="
            )

        return TriageEvaluationResult(
            findings=findings,
            referral_triggered=referral_triggered,
            referral_urgency=referral_urgency,
            referral_reason=referral_reason,
            referral_note=referral_note,
        )

