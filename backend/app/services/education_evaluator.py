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
        "preferred_determination": "REJECT",
        "acceptable_alternatives": {
            "ESCALATE": {
                "score": 25,
                "feedback": (
                    "Acceptable alternative determination: Escalating to a Chief Pharmacist safely "
                    "halts dispensing and prevents patient harm, but according to clinical guideline criteria, "
                    "this case contains an absolute contraindication requiring immediate REJECT and prescriber notification."
                ),
            }
        },
        "learning_objectives": [
            "Identify beta-lactam class cross-reactivity in patients with severe penicillin allergy",
            "Recognize absolute contraindications requiring immediate prescription rejection",
            "Formulate safe non-cross-reactive alternative antimicrobial recommendations",
        ],
        "expected_issues": ["ALLERGY_CROSS_REACTIVITY"],
        "issue_synonyms": {
            "ALLERGY_CROSS_REACTIVITY": [
                "ALLERGY",
                "ALLERGY_CROSS_REACTIVITY",
                "PENICILLIN_ALLERGY",
                "BETA_LACTAM_ALLERGY",
                "BETA_LACTAM_CROSS_REACTIVITY",
            ],
        },
        "issue_keywords": {
            "ALLERGY_CROSS_REACTIVITY": [
                "penicillin",
                "amoxicillin",
                "allergy",
                "anaphylaxis",
                "beta-lactam",
                "cross-allergenicity",
                "cross-reactivity",
            ],
        },
        "required_reasoning_elements": [
            {
                "id": "BETA_LACTAM_STRUCTURE",
                "title": "Structural Beta-Lactam Cross-Reactivity",
                "points": 7,
                "keywords": [
                    "beta-lactam",
                    "beta lactam",
                    "cross-react",
                    "cross react",
                    "aminopenicillin",
                    "amino-penicillin",
                    "penicillin class",
                    "same class",
                    "chemical structure",
                    "ring",
                ],
            },
            {
                "id": "SEVERE_ANAPHYLAXIS_HISTORY",
                "title": "Severe Anaphylaxis / ICU History",
                "points": 7,
                "keywords": [
                    "anaphylaxis",
                    "anaphylactic",
                    "icu",
                    "severe",
                    "life-threatening",
                    "bronchospasm",
                    "intubat",
                    "shock",
                ],
            },
            {
                "id": "CONTRAINDICATION_AND_ACTION",
                "title": "Absolute Contraindication & Order Rejection",
                "points": 6,
                "keywords": [
                    "contraindicated",
                    "contraindication",
                    "reject",
                    "alternative",
                    "non-penicillin",
                    "non-beta-lactam",
                    "substitute",
                    "not safe",
                    "halt",
                ],
            },
        ],
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
        "preferred_determination": "REJECT",
        "acceptable_alternatives": {
            "ESCALATE": {
                "score": 25,
                "feedback": (
                    "Acceptable alternative determination: Escalating to a Chief Pharmacist safely "
                    "halts dispensing, but direct REJECT to recommend multimodal non-NSAID alternatives is the preferred guideline action."
                ),
            }
        },
        "learning_objectives": [
            "Detect therapeutic duplication across non-identical chemical entities in the same drug class",
            "Understand the ceiling effect and compounded toxicity of systemic NSAIDs",
            "Recommend appropriate multimodal non-NSAID post-operative analgesia alternatives",
        ],
        "expected_issues": ["DUPLICATE_THERAPY"],
        "issue_synonyms": {
            "DUPLICATE_THERAPY": [
                "DUPLICATE_THERAPY",
                "THERAPEUTIC_DUPLICATION",
                "NSAID_DUPLICATION",
                "DRUG_INTERACTION",
                "DUPLICATE_NSAID",
            ],
        },
        "issue_keywords": {
            "DUPLICATE_THERAPY": [
                "nsaid",
                "ketorolac",
                "ibuprofen",
                "duplication",
                "duplicate",
                "concurrent",
            ],
        },
        "required_reasoning_elements": [
            {
                "id": "DUAL_NSAID_CLASS",
                "title": "Dual Systemic NSAID Class Duplication",
                "points": 7,
                "keywords": [
                    "nsaid",
                    "dual nsaid",
                    "two nsaid",
                    "duplicate",
                    "duplication",
                    "concurrent",
                    "same class",
                    "both are nsaid",
                    "ketorolac and ibuprofen",
                    "ketorolac with ibuprofen",
                ],
            },
            {
                "id": "ANALGESIC_CEILING_EFFECT",
                "title": "Analgesic Ceiling Effect & Lack of Additive Benefit",
                "points": 7,
                "keywords": [
                    "ceiling",
                    "no additive",
                    "no additional analgesia",
                    "no extra pain relief",
                    "saturation",
                    "not superior",
                    "no added benefit",
                    "cox saturation",
                ],
            },
            {
                "id": "COMPOUNDED_TOXICITY",
                "title": "Compounded GI Bleeding or Nephrotoxicity Risks",
                "points": 6,
                "keywords": [
                    "bleeding",
                    "hemorrhage",
                    "gastrointestinal",
                    "gi ulcer",
                    "ulcer",
                    "nephrotox",
                    "renal failure",
                    "acute kidney injury",
                    "aki",
                    "black-box",
                    "black box",
                    "renal toxicity",
                ],
            },
        ],
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
        "preferred_determination": "REJECT",
        "acceptable_alternatives": {
            "ESCALATE": {
                "score": 25,
                "feedback": (
                    "Acceptable alternative determination: Escalating to a Chief Pharmacist for prescriber communication "
                    "is an acceptable clinical decision given the dual indication and renal dosing complexity, though direct REJECT for dose reduction is preferred."
                ),
            }
        },
        "learning_objectives": [
            "Reconcile prescribed medications against documented active diagnostic problem lists",
            "Evaluate renal clearance parameters (eGFR) against drug monograph dosage limits",
            "Prevent medication toxicity by intercepting contraindicated regimens in chronic kidney disease",
        ],
        "expected_issues": ["INDICATION", "DOSAGE"],
        "issue_synonyms": {
            "INDICATION": [
                "INDICATION",
                "MISSING_INDICATION",
                "DIABETES_INDICATION",
                "UNCONFIRMED_INDICATION",
            ],
            "DOSAGE": [
                "DOSAGE",
                "RENAL_DOSING",
                "RENAL_IMPAIRMENT",
                "MAX_DOSE",
                "DOSE_EXCEEDED",
            ],
        },
        "issue_keywords": {
            "INDICATION": [
                "indication",
                "diabetes",
                "type 2",
                "t2d",
                "e11",
                "problem list",
            ],
            "DOSAGE": [
                "dose",
                "dosage",
                "renal",
                "kidney",
                "egfr",
                "ckd",
                "stage 3",
                "lactic acidosis",
                "1000",
                "2000",
            ],
        },
        "required_reasoning_elements": [
            {
                "id": "MISSING_INDICATION_DIABETES",
                "title": "Unconfirmed Indication / Missing Diabetes Diagnosis",
                "points": 7,
                "keywords": [
                    "indication",
                    "diabetes",
                    "type 2",
                    "t2d",
                    "e11",
                    "problem list",
                    "no diagnosis",
                    "unconfirmed",
                    "not documented",
                ],
            },
            {
                "id": "REDUCED_RENAL_CLEARANCE",
                "title": "Impaired Renal Function / Stage 3b CKD (eGFR 38)",
                "points": 7,
                "keywords": [
                    "egfr",
                    "38",
                    "renal impairment",
                    "chronic kidney disease",
                    "ckd",
                    "stage 3",
                    "reduced clearance",
                    "kidney function",
                    "renal insufficiency",
                ],
            },
            {
                "id": "DOSAGE_LIMIT_LACTIC_ACIDOSIS",
                "title": "Max 1000 mg/day Limit & Fatal Lactic Acidosis Risk",
                "points": 6,
                "keywords": [
                    "1000",
                    "2000",
                    "exceeds",
                    "max dose",
                    "maximum daily",
                    "dosage threshold",
                    "lactic acidosis",
                    "contraindicated",
                    "dose reduction",
                ],
            },
        ],
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
        1. Determination accuracy: preferred vs acceptable alternative vs unsupported (0-50 pts)
        2. Issue identification: expected categories vs missed (0-30 pts)
        3. Clinical reasoning element evaluation: content-based rubric without length bias (0-20 pts)
        Total Score: 0-100 pts.
        """
        submitted_det = submission_req.determination.strip().upper()
        reasoning_text = submission_req.reasoning.strip().lower()

        config = CASE_CRITERIA_CATALOG.get(case.case_code, {})
        pref_det = config.get("preferred_determination", case.predefined_answer).strip().upper()
        acceptable_alts = config.get("acceptable_alternatives", {})
        expected_issues = config.get("expected_issues", [case.category])
        issue_synonyms = config.get("issue_synonyms", {})
        expected_rules = config.get("expected_rules", [])

        # -------------------------------------------------------------
        # 1. Determination Evaluation (50 points maximum)
        # -------------------------------------------------------------
        det_score = 0
        det_correct = False
        det_status = "UNSUPPORTED"
        det_feedback = ""

        if submitted_det == pref_det:
            det_score = 50
            det_correct = True
            det_status = "PREFERRED"
            det_feedback = f"Preferred determination: Appropriately selected '{pref_det}' as the primary clinical action."
        elif submitted_det in acceptable_alts:
            alt_info = acceptable_alts[submitted_det]
            det_score = alt_info["score"]
            det_correct = False
            det_status = "ACCEPTABLE_ALTERNATIVE"
            det_feedback = alt_info["feedback"]
        else:
            det_score = 0
            det_correct = False
            det_status = "UNSUPPORTED"
            det_feedback = (
                f"Unsafe or unsupported determination: Selected '{submitted_det}'. The preferred clinical action "
                f"under demonstration practice criteria is '{pref_det}'. This selection is neither preferred nor an acceptable alternative."
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

        issue_keywords = config.get("issue_keywords", {})
        for exp_issue in expected_issues:
            # Check 1: direct in identified_issues or synonym match
            synonyms = set(issue_synonyms.get(exp_issue, [exp_issue]))
            matched_in_list = any(s_issue in synonyms for s_issue in normalized_student_issues)

            # Check 2: identified within student reasoning text
            kw_list = issue_keywords.get(exp_issue, [exp_issue.lower()])
            matched_in_reasoning = any(
                re.search(r"\b" + re.escape(kw) + r"\b", reasoning_text)
                for kw in kw_list
            )

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
        # 3. Clinical Reasoning Element Evaluation (20 points maximum)
        # Content-based rubric: awards points for identifying specific clinical reasoning
        # elements rather than measuring word count or character length.
        # -------------------------------------------------------------
        required_elements = config.get("required_reasoning_elements", [])
        identified_elements = []
        missed_elements = []
        reasoning_score = 0

        for elem in required_elements:
            elem_id = elem["id"]
            elem_title = elem["title"]
            keywords = elem["keywords"]
            elem_points = elem["points"]

            matched = any(
                re.search(r"\b" + re.escape(kw) + r"\b", reasoning_text)
                for kw in keywords
            )
            if matched:
                identified_elements.append(elem_title)
                reasoning_score += elem_points
            else:
                missed_elements.append(elem_title)

        reasoning_score = min(20, reasoning_score)

        if len(identified_elements) == len(required_elements) and len(required_elements) > 0:
            reasoning_feedback = (
                f"Full credit ({reasoning_score}/20 pts): Explanation identified all {len(required_elements)} "
                f"required clinical reasoning elements: {'; '.join(identified_elements)}."
            )
        elif len(identified_elements) > 0:
            reasoning_feedback = (
                f"Partial credit ({reasoning_score}/20 pts): Identified {len(identified_elements)} "
                f"reasoning element(s) ({'; '.join(identified_elements)}), but missed: {'; '.join(missed_elements)}."
            )
        else:
            reasoning_feedback = (
                f"No credit (0/20 pts): Explanation did not identify any required clinical reasoning elements: "
                f"{'; '.join(missed_elements)}."
            )

        # -------------------------------------------------------------
        # 4. Total Score & Evaluation Summary
        # -------------------------------------------------------------
        total_score = min(100, max(0, det_score + issue_score + reasoning_score))
        overall_correct = (det_status == "PREFERRED") and (total_score >= 70)

        learning_points_list = parse_key_learning_points(case.key_learning_points)

        limitations_statement = (
            "Educational Simulation Boundary Notice: This assessment is an academic simulation "
            "evaluated against synthetic benchmark cases and preconfigured demonstration rules. "
            "A passing score indicates understanding of simulated scenario concepts and must NEVER "
            "be construed as clinical validation, qualification for autonomous medication dispensing, "
            "or proof of real-world clinical competence."
        )

        return DetailedFeedback(
            determination_status=det_status,
            preferred_determination=pref_det,
            acceptable_alternatives=list(acceptable_alts.keys()),
            determination_correct=det_correct,
            determination_feedback=det_feedback,
            expected_determination=pref_det,
            determination_score=det_score,
            expected_rules=expected_rules,
            correctly_identified_issues=correctly_identified,
            missed_issues=missed,
            unconfirmed_issues=unconfirmed,
            issue_identification_score=issue_score,
            correctly_identified_reasoning_elements=identified_elements,
            missed_reasoning_elements=missed_elements,
            reasoning_feedback=reasoning_feedback,
            reasoning_score=reasoning_score,
            total_score=total_score,
            is_correct=overall_correct,
            clinical_rationale=case.predefined_explanation,
            key_learning_points=learning_points_list,
            educational_limitations=limitations_statement,
            disclaimer=EDUCATIONAL_DISCLAIMER,
        )
