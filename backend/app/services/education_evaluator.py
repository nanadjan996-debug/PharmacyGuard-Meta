"""Deterministic evaluation and pedagogical feedback service for educational simulation cases."""
import re
from typing import Any
from app.models.education import EducationalCase
from app.schemas.education import (
    DetailedFeedback,
    ReferenceRuleFeedback,
    StudentSubmissionRequest,
    EDUCATIONAL_DISCLAIMER,
)


# Configured benchmark criteria catalog linking educational cases to demo reference rules
CASE_CRITERIA_CATALOG: dict[str, dict[str, Any]] = {
    "CASE-BEG-01": {
        "learning_objectives": [
            "Identify beta-lactam class cross-reactivity in patients with severe penicillin allergy",
            "Recognize absolute contraindications requiring immediate prescription rejection",
            "Formulate safe non-cross-reactive alternative antimicrobial recommendations",
        ],
        "expected_issues": ["ALLERGY_CROSS_REACTIVITY"],
        "issue_synonyms": {
            "ALLERGY_CROSS_REACTIVITY": ["ALLERGY", "ALLERGY_CROSS_REACTIVITY", "PENICILLIN_ALLERGY", "BETA_LACTAM_ALLERGY"],
        },
        "reasoning_keywords": {
            "ALLERGY_CROSS_REACTIVITY": ["penicillin", "amoxicillin", "allergy", "anaphylaxis", "beta-lactam", "contraindicated", "cross-reactivity", "severe", "icu"],
        },
        "expected_rules": [
            ReferenceRuleFeedback(
                rule_identifier="RULE-ALG-PEN-01",
                rule_name="Severe Penicillin IgE Direct & Cross-Reactivity Rule",
                category="ALLERGY",
                severity="HIGH",
                description="Prescribed Amoxicillin 500mg in patient with documented anaphylaxis (ICU admission) to Penicillin.",
                clinical_evidence="Amoxicillin is an amino-penicillin sharing the beta-lactam core. In patients with verified IgE-mediated anaphylaxis to penicillin, direct penicillins are strictly contraindicated.",
            )
        ],
    },
    "CASE-INT-01": {
        "learning_objectives": [
            "Detect therapeutic duplication across non-identical chemical entities in the same drug class",
            "Understand the ceiling effect and compounded toxicity of systemic NSAIDs",
            "Recommend appropriate multimodal non-NSAID post-operative analgesia alternatives",
        ],
        "expected_issues": ["DUPLICATE_THERAPY"],
        "issue_synonyms": {
            "DUPLICATE_THERAPY": ["DUPLICATE_THERAPY", "THERAPEUTIC_DUPLICATION", "NSAID_DUPLICATION", "DRUG_INTERACTION"],
        },
        "reasoning_keywords": {
            "DUPLICATE_THERAPY": ["nsaid", "ketorolac", "ibuprofen", "duplication", "concurrent", "bleeding", "gi", "gastrointestinal", "renal", "nephrotoxicity", "ceiling"],
        },
        "expected_rules": [
            ReferenceRuleFeedback(
                rule_identifier="RULE-INT-NSAID-NSAID-01",
                rule_name="Dual Systemic NSAID Toxicity Rule",
                category="THERAPEUTIC_DUPLICATION",
                severity="HIGH",
                description="Concurrent administration of two systemic NSAIDs (Ketorolac 10mg + Ibuprofen 600mg).",
                clinical_evidence="Concurrent administration of two systemic NSAIDs does not provide additive analgesia due to COX receptor saturation, but significantly multiplies the incidence of gastrointestinal ulceration, acute renal impairment, and bleeding complications. Ketorolac carries a black-box warning.",
            )
        ],
    },
    "CASE-ADV-01": {
        "learning_objectives": [
            "Reconcile prescribed medications against documented active diagnostic problem lists",
            "Evaluate renal clearance parameters (eGFR) against drug monograph dosage limits",
            "Prevent medication toxicity by intercepting contraindicated regimens in chronic kidney disease",
        ],
        "expected_issues": ["INDICATION", "DOSAGE"],
        "issue_synonyms": {
            "INDICATION": ["INDICATION", "MISSING_INDICATION", "DIABETES_INDICATION", "RENAL_DOSING_INDICATION"],
            "DOSAGE": ["DOSAGE", "RENAL_DOSING", "RENAL_IMPAIRMENT", "EGFR_CONTRAINDICATION", "MAX_DOSE"],
        },
        "reasoning_keywords": {
            "INDICATION": ["indication", "diabetes", "diagnos", "e11", "problem list", "history"],
            "DOSAGE": ["renal", "kidney", "egfr", "dose", "dosage", "lactic acidosis", "ckd", "stage 3", "contraindicated", "1000", "2000"],
        },
        "expected_rules": [
            ReferenceRuleFeedback(
                rule_identifier="RULE-IND-MET-01",
                rule_name="Metformin Indication Verification Rule",
                category="INDICATION",
                severity="HIGH",
                description="Prescribed Metformin without documented indication of Type 2 Diabetes Mellitus (ICD-10 E11).",
                clinical_evidence="Metformin is indicated for Type 2 Diabetes Mellitus; prescribing without an established diagnostic indication requires clarification with prescriber.",
            ),
            ReferenceRuleFeedback(
                rule_identifier="RULE-DOSE-MET-01",
                rule_name="Metformin Renal Dosing Threshold Rule",
                category="DOSAGE",
                severity="HIGH",
                description="Metformin daily dose 2000 mg/day exceeds recommended threshold for moderate-to-severe renal impairment.",
                clinical_evidence="In patients with eGFR 30-45 mL/min/1.73m2 (Stage 3b CKD), the maximum recommended daily dose of Metformin is 1000 mg/day (500 mg BID). Prescribing 2000 mg/day is contraindicated due to increased risk of fatal lactic acidosis.",
            ),
        ],
    },
}

DEFAULT_OBJECTIVES = [
    "Critically evaluate prescription orders against patient medical and allergy history",
    "Identify contraindications, therapeutic duplications, or dosage anomalies",
    "Determine appropriate clinical pharmacist verification actions",
]


def get_case_learning_objectives(case: EducationalCase) -> list[str]:
    """Retrieve educational learning objectives without revealing answer keys."""
    config = CASE_CRITERIA_CATALOG.get(case.case_code)
    if config and "learning_objectives" in config:
        return config["learning_objectives"]
    return DEFAULT_OBJECTIVES


def parse_key_learning_points(raw_points: str) -> list[str]:
    """Parse raw key learning points string into a structured list."""
    if not raw_points:
        return []
    lines = [line.strip() for line in raw_points.splitlines() if line.strip()]
    cleaned = []
    for line in lines:
        cleaned_line = re.sub(r"^(\d+[\.\)]|\-|\*)\s*", "", line)
        if cleaned_line:
            cleaned.append(cleaned_line)
    return cleaned or lines


class EducationalEvaluator:
    """Deterministic, rule-grounded evaluation engine for pharmacy student submissions."""

    @classmethod
    def evaluate(
        cls,
        case: EducationalCase,
        submission_req: StudentSubmissionRequest,
    ) -> DetailedFeedback:
        """
        Evaluate student submission transparently against configured benchmark criteria:
        1. Determination accuracy (0-50 pts)
        2. Issue identification (0-30 pts)
        3. Clinical reasoning documentation (0-20 pts)
        Total Score: 0-100 pts.
        """
        submitted_det = submission_req.determination.strip().upper()
        expected_det = case.predefined_answer.strip().upper()
        reasoning_text = submission_req.reasoning.strip().lower()

        config = CASE_CRITERIA_CATALOG.get(case.case_code, {})
        expected_issues = config.get("expected_issues", [case.category])
        issue_synonyms = config.get("issue_synonyms", {})
        reasoning_keywords = config.get("reasoning_keywords", {})
        expected_rules = config.get("expected_rules", [])

        # -------------------------------------------------------------
        # 1. Determination Evaluation (50 points maximum)
        # -------------------------------------------------------------
        det_score = 0
        det_correct = False
        det_feedback = ""

        if submitted_det == expected_det:
            det_score = 50
            det_correct = True
            det_feedback = f"Correct determination: Appropriately identified '{expected_det}' as the required clinical action."
        elif submitted_det == "ESCALATE" and expected_det == "REJECT":
            # Partial credit: escalation safely stops dispensing, but misses direct rejection rule
            det_score = 25
            det_correct = False
            det_feedback = (
                "Partially correct determination: Escalating to a Chief Pharmacist safely holds dispensing, "
                f"but this case contains an absolute contraindication requiring immediate '{expected_det}'."
            )
        elif submitted_det == "ESCALATE" and expected_det == "OVERRIDE_WITH_RATIONALE":
            det_score = 25
            det_correct = False
            det_feedback = (
                "Partially correct determination: Escalation is safe, but this finding can be resolved "
                f"via '{expected_det}' with documented clinical rationale."
            )
        else:
            det_score = 0
            det_correct = False
            det_feedback = (
                f"Incorrect determination: Selected '{submitted_det}', but the safe action under "
                f"demonstration practice criteria is '{expected_det}'."
            )

        # -------------------------------------------------------------
        # 2. Issue Identification Evaluation (30 points maximum)
        # -------------------------------------------------------------
        normalized_student_issues = [
            i.strip().upper().replace(" ", "_").replace("-", "_")
            for i in submission_req.identified_issues
        ]

        correctly_identified = []
        missed = []

        for exp_issue in expected_issues:
            # Check 1: direct in identified_issues or synonym match
            synonyms = set(issue_synonyms.get(exp_issue, [exp_issue]))
            matched_in_list = any(s_issue in synonyms for s_issue in normalized_student_issues)

            # Check 2: keywords mentioned in reasoning
            kw_list = reasoning_keywords.get(exp_issue, [exp_issue.lower()])
            matched_in_reasoning = any(kw in reasoning_text for kw in kw_list)

            if matched_in_list or matched_in_reasoning:
                correctly_identified.append(exp_issue)
            else:
                missed.append(exp_issue)

        # Check for unconfirmed / extra false positives
        all_valid_synonyms = set()
        for exp_issue in expected_issues:
            all_valid_synonyms.update(issue_synonyms.get(exp_issue, [exp_issue]))
        unconfirmed = [s_issue for s_issue in normalized_student_issues if s_issue not in all_valid_synonyms]

        if expected_issues:
            issue_score = round(30 * (len(correctly_identified) / len(expected_issues)))
        else:
            issue_score = 30

        # -------------------------------------------------------------
        # 3. Clinical Reasoning Documentation Evaluation (20 points maximum)
        # -------------------------------------------------------------
        reasoning_len = len(submission_req.reasoning.strip())
        reasoning_score = 0
        reasoning_feedback = ""

        if reasoning_len < 20:
            reasoning_score = 5
            reasoning_feedback = "Minimal documentation: Rationale is overly brief and lacks pharmacological detail."
        elif reasoning_len < 60:
            reasoning_score = 12
            reasoning_feedback = "Adequate documentation: Rationale states basic reasoning but could provide deeper context."
        else:
            reasoning_score = 20
            reasoning_feedback = "Thorough documentation: Substantive clinical justification with clear patient safety rationale."

        # -------------------------------------------------------------
        # 4. Total Score & Evaluation Summary
        # -------------------------------------------------------------
        total_score = min(100, max(0, det_score + issue_score + reasoning_score))
        overall_correct = det_correct and (total_score >= 70)

        learning_points_list = parse_key_learning_points(case.key_learning_points)

        limitations_statement = (
            "Educational Simulation Boundary Notice: This assessment is an academic simulation "
            "evaluated against synthetic benchmark cases and preconfigured demonstration rules. "
            "A passing score indicates understanding of simulated scenario concepts and must NEVER "
            "be construed as clinical validation, qualification for autonomous medication dispensing, "
            "or proof of real-world clinical competence."
        )

        return DetailedFeedback(
            determination_correct=det_correct,
            determination_feedback=det_feedback,
            expected_determination=expected_det,
            determination_score=det_score,
            expected_rules=expected_rules,
            correctly_identified_issues=correctly_identified,
            missed_issues=missed,
            unconfirmed_issues=unconfirmed,
            issue_identification_score=issue_score,
            reasoning_feedback=reasoning_feedback,
            reasoning_score=reasoning_score,
            total_score=total_score,
            is_correct=overall_correct,
            clinical_rationale=case.predefined_explanation,
            key_learning_points=learning_points_list,
            educational_limitations=limitations_statement,
            disclaimer=EDUCATIONAL_DISCLAIMER,
        )

