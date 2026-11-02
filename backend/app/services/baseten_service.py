"""Baseten Hosted Inference Service for Meta Muse Spark Open.

Integrates Meta's Muse Spark Open model to explain and synthesize deterministic
safety findings for the reviewing human pharmacist.

Primary Architectural Principle:
- Deterministic verification engine executes first and is authoritative.
- AI provides non-authoritative explanatory clinical context.
- Model has no authority to approve, reject, or authorize medication dispensing.
- Hard 14-second timeout with graceful fallback to deterministic findings.
"""
import json
import logging
import re
from typing import Any, Sequence
from datetime import date, datetime

import httpx

from app.config import settings
from app.schemas.ai import AIExplanationResponse, FindingExplanation

logger = logging.getLogger("pharmacyguard.baseten")


_UNSET: Any = object()


class BasetenService:
    """Client for Meta Muse Spark Open inference hosted on Baseten."""

    def __init__(
        self,
        api_key: Any = _UNSET,
        base_url: str | None = None,
        model_name: str | None = None,
        timeout_seconds: float | None = None,
    ):
        self.api_key = settings.BASETEN_API_KEY if api_key is _UNSET else api_key
        self.base_url = (base_url or settings.BASETEN_BASE_URL).rstrip("/")
        self.model_name = model_name or settings.BASETEN_MODEL
        self.timeout_seconds = timeout_seconds if timeout_seconds is not None else settings.BASETEN_TIMEOUT_SECONDS

    @property
    def is_configured(self) -> bool:
        """Check whether valid credentials and configuration are provided."""
        return bool(self.api_key and self.api_key.strip())

    async def generate_explanation(
        self,
        prescription: Any,
        findings: Sequence[Any],
    ) -> AIExplanationResponse:
        """
        Generate structured clinical explanation for deterministic findings using Meta Muse Spark Open.

        Args:
            prescription: Prescription database model or schema object.
            findings: List of GeneratedFinding or ReviewFinding items.

        Returns:
            Validated AIExplanationResponse with deterministic fallback on any failure.
        """
        # 1. Fallback if API credentials are not configured
        if not self.is_configured:
            return AIExplanationResponse(
                summary="AI clinical explanation is unavailable because Baseten API credentials are not configured.",
                finding_explanations=[],
                clinical_context="Prescription evaluated under deterministic rule verification.",
                uncertainties=["AI model inference not active."],
                review_considerations=["Review flagged deterministic findings directly."],
                ai_status="unavailable",
                status_detail="Baseten API key is not configured.",
                model_name=self.model_name,
            )

        # 2. Extract minimal required clinical payload (zero extraneous identifiers/secrets)
        payload_context = self._extract_minimal_context(prescription, findings)

        # 3. Build system and user prompts with strict anti-hallucination and anti-approval constraints
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(payload_context)

        # 4. Execute request with strict 14.0s timeout
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 4096,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                res = await client.post(url, headers=headers, json=body)
                res.raise_for_status()
                response_data = res.json()

            message = response_data["choices"][0].get("message", {})
            raw_content = message.get("content")
            if not raw_content and message.get("reasoning_content"):
                raw_content = message.get("reasoning_content")

            return self._validate_and_parse_response(raw_content, findings)

        except httpx.TimeoutException:
            logger.warning("Baseten inference timed out after %s seconds", self.timeout_seconds)
            return AIExplanationResponse(
                summary="AI clinical explanation timed out. Deterministic safety verification remains fully available.",
                finding_explanations=[],
                clinical_context="Evaluation timed out after 14 seconds.",
                uncertainties=["Inference provider did not respond within the 14-second safety threshold."],
                review_considerations=["Proceed with standard clinical review based on deterministic findings below."],
                ai_status="timeout",
                status_detail=f"Inference request exceeded {self.timeout_seconds}-second timeout limit.",
                model_name=self.model_name,
            )

        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            logger.warning("Baseten HTTP error %s: %s", status_code, exc.response.text[:200])
            detail = (
                "Baseten authentication failed: Invalid, revoked, or expired API key."
                if status_code in (401, 403)
                else f"Baseten inference provider error (HTTP {status_code})."
            )
            return AIExplanationResponse(
                summary="AI clinical explanation service is temporarily unavailable.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Provider connection unavailable."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="unavailable",
                status_detail=detail,
                model_name=self.model_name,
            )

        except httpx.RequestError as exc:
            logger.warning("Baseten network connection failure: %s", str(exc))
            return AIExplanationResponse(
                summary="AI clinical explanation service is currently unreachable.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Network failure communicating with inference provider."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="unavailable",
                status_detail=f"Network error: {str(exc)}",
                model_name=self.model_name,
            )

        except Exception as exc:
            logger.error("Unexpected error in Baseten AI explanation service: %s", str(exc), exc_info=True)
            return AIExplanationResponse(
                summary="AI clinical explanation could not be generated.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Model output processing error."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="rejected",
                status_detail=f"Service error: {str(exc)}",
                model_name=self.model_name,
            )

    def _extract_minimal_context(self, prescription: Any, findings: Sequence[Any]) -> dict[str, Any]:
        """Extract only clinically necessary synthetic information."""
        patient = getattr(prescription, "patient", None)

        # Calculate approximate age safely
        age_str = "Unknown"
        if patient and getattr(patient, "date_of_birth", None):
            dob = patient.date_of_birth
            if isinstance(dob, (date, datetime)):
                today = date.today()
                age_str = f"{today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))} years"

        allergies_list = []
        if patient and getattr(patient, "allergies", None):
            for a in patient.allergies:
                allergies_list.append({
                    "allergen": getattr(a, "allergen_name", str(a)),
                    "type": getattr(a, "allergy_type", "Unknown"),
                    "severity": getattr(a, "severity", "Unknown"),
                })

        conditions_list = []
        if patient and getattr(patient, "diagnoses", None):
            for d in patient.diagnoses:
                conditions_list.append({
                    "condition": getattr(d, "condition_name", str(d)),
                    "icd10": getattr(d, "icd10_code", ""),
                })

        medications_list = []
        items = getattr(prescription, "items", []) or []
        for it in items:
            med_ref = getattr(it, "medication", None)
            medications_list.append({
                "generic_name": getattr(med_ref, "generic_name", getattr(it, "generic_name", "Unknown")),
                "brand_name": getattr(med_ref, "brand_name", getattr(it, "brand_name", "Unknown")),
                "drug_class": getattr(med_ref, "drug_class", getattr(it, "drug_class", "Unknown")),
                "dose": f"{getattr(it, 'dose_amount', 0)} {getattr(it, 'dose_unit', 'mg')}",
                "frequency": getattr(it, "frequency", "Unknown"),
                "route": getattr(it, "route", "Oral"),
                "duration_days": getattr(it, "duration_days", 0),
                "instructions": getattr(it, "instructions", ""),
            })

        findings_list = []
        for f in findings:
            findings_list.append({
                "rule_identifier": getattr(f, "rule_identifier", ""),
                "category": getattr(f, "category", ""),
                "severity": getattr(f, "severity", "INFO"),
                "status": getattr(f, "status", "REVIEW_REQUIRED"),
                "evidence": getattr(f, "evidence", getattr(f, "message", "")),
            })

        return {
            "patient": {
                "age": age_str,
                "gender": getattr(patient, "gender", "Unknown") if patient else "Unknown",
                "weight_kg": getattr(patient, "weight_kg", 70.0) if patient else 70.0,
                "allergies": allergies_list,
                "conditions": conditions_list,
            },
            "clinical_notes": getattr(prescription, "clinical_notes", None) or "None provided.",
            "prescribed_medications": medications_list,
            "deterministic_findings": findings_list,
        }

    def _build_system_prompt(self) -> str:
        """Construct the prompt enforcing strict explanatory bounds and JSON output."""
        return (
            "You are PharmacyGuard AI Clinical Explainer, a specialized clinical pharmacy decision-support "
            "assistant powered by Meta Muse Spark Open.\n\n"
            "YOUR MANDATE:\n"
            "Interpret, synthesize, and explain the deterministic safety findings produced by PharmacyGuard's "
            "authoritative rule-based verification engine for the reviewing human pharmacist.\n\n"
            "STRICT CONSTRAINTS & OPERATIONAL BOUNDARIES:\n"
            "1. THE DETERMINISTIC ENGINE IS AUTHORITATIVE: Never contradict, alter, downgrade, or upgrade "
            "the severity (HIGH, MODERATE, LOW, INFO) of any deterministic finding.\n"
            "2. ZERO INVENTED FINDINGS: Never hallucinate or invent new safety findings or rule identifiers. "
            "Every item in 'finding_explanations' MUST match a 'rule_identifier' from the provided deterministic findings.\n"
            "3. NO AUTONOMOUS APPROVAL: You have NO operational authority. You must NEVER approve, reject, "
            "or authorize dispensing of any medication. Pharmacist review is always required.\n"
            "4. CLINICAL REASONING: Explain clearly why flagged findings matter, their mechanism (e.g. CYP inhibition, "
            "IgE-mediated cross-reactivity, duplicate cyclooxygenase inhibition), and patient context.\n"
            "5. UNCERTAINTIES & MISSING DATA: Identify missing clinical parameters, such as unmonitored lab values "
            "(e.g., eGFR, INR, electrolytes) or unclear clinical indications.\n"
            "6. JSON OUTPUT FORMAT: Output ONLY a single, valid, complete JSON object matching this schema exactly:\n"
            "{\n"
            '  "summary": "Concise 2-sentence clinical synthesis for the human pharmacist.",\n'
            '  "finding_explanations": [\n'
            '    {\n'
            '      "rule_identifier": "RULE-IDENTIFIER-EXACT",\n'
            '      "category": "CATEGORY-EXACT",\n'
            '      "severity": "SEVERITY-EXACT",\n'
            '      "clinical_explanation": "1-2 concise sentences explaining the clinical mechanism and risk."\n'
            '    }\n'
            '  ],\n'
            '  "clinical_context": "1-2 sentence synthesis of patient condition and encounter context.",\n'
            '  "uncertainties": ["1-2 concise bullet points on missing parameters"],\n'
            '  "review_considerations": ["1-2 concise actionable points for the reviewing pharmacist."]\n'
            "}\n"
            "CRITICAL: Keep explanations concise and factual (under 250 words total). Ensure the JSON is completely closed.\n"
            "Do not include markdown backticks (```json) or conversational text outside the JSON object."
        )

    def _build_user_prompt(self, context: dict[str, Any]) -> str:
        """Format the clinical payload for evaluation."""
        return (
            "Please analyze the following synthetic prescription and deterministic safety findings, "
            "and produce your structured clinical explanation JSON:\n\n"
            f"{json.dumps(context, indent=2)}"
        )

    def _validate_and_parse_response(
        self,
        raw_text: str,
        deterministic_findings: Sequence[Any],
    ) -> AIExplanationResponse:
        """
        Validate that the model response is structurally sound, adheres to schema,
        does not hallucinate rule identifiers, preserves deterministic severities,
        and makes no autonomous approval claims.
        """
        if not raw_text:
            return AIExplanationResponse(
                summary="AI clinical explanation could not be generated.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Model returned empty content."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="rejected",
                status_detail="Model output was empty or missing.",
                model_name=self.model_name,
            )

        # Strip potential markdown fences if returned
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            # Fallback: attempt to extract JSON object { ... }
            json_match = re.search(r"(\{.*\})", cleaned, re.DOTALL)
            data = None
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    data = None

            if data is None:
                logger.warning("Model returned invalid JSON: %s. Raw preview: %s", exc, raw_text[:200])
                return AIExplanationResponse(
                    summary="AI clinical explanation rejected due to invalid response formatting.",
                    finding_explanations=[],
                    clinical_context="Deterministic safety verification preserved.",
                    uncertainties=["Model output was not valid JSON."],
                    review_considerations=["Evaluate deterministic findings directly."],
                    ai_status="rejected",
                    status_detail=f"Model output parsing error: {str(exc)}",
                    model_name=self.model_name,
                )

        if not isinstance(data, dict):
            return AIExplanationResponse(
                summary="AI clinical explanation rejected: Response is not a structured JSON object.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Model output structure invalid."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="rejected",
                status_detail="Response root is not a dictionary.",
                model_name=self.model_name,
            )

        # Check required fields
        summary = str(data.get("summary", "")).strip()
        clinical_context = str(data.get("clinical_context", "")).strip()
        if not summary or not clinical_context:
            return AIExplanationResponse(
                summary="AI clinical explanation rejected: Required summary or clinical context missing.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Incomplete response payload from model."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="rejected",
                status_detail="Missing required summary or clinical_context fields.",
                model_name=self.model_name,
            )

        # Guard against rogue autonomous approval claims
        approval_pattern = re.compile(
            r"\b(i\s+(hereby\s+)?(approve|authorize)|prescription\s+(is|has\s+been)\s+(approved|cleared|authorized)|dispense\s+(immediately|safely\s+without\s+pharmacist))\b",
            re.IGNORECASE,
        )
        combined_text = f"{summary} {clinical_context} {' '.join(data.get('review_considerations', []))}"
        if approval_pattern.search(combined_text):
            logger.warning("Model output attempted autonomous prescription approval. Rejecting output.")
            return AIExplanationResponse(
                summary="AI clinical explanation rejected: Unauthorized prescription approval claim detected.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Model violated clinical boundary constraints."],
                review_considerations=["Evaluate deterministic findings directly. Pharmacist review is mandatory."],
                ai_status="rejected",
                status_detail="Model attempted autonomous approval or dispensing authorization.",
                model_name=self.model_name,
            )

        # Validate finding explanations against authoritative deterministic findings
        valid_rules: dict[str, str] = {
            getattr(f, "rule_identifier", ""): getattr(f, "severity", "INFO")
            for f in deterministic_findings
            if getattr(f, "rule_identifier", "")
        }

        parsed_explanations: list[FindingExplanation] = []
        raw_exps = data.get("finding_explanations", [])
        if isinstance(raw_exps, list):
            for item in raw_exps:
                if not isinstance(item, dict):
                    continue
                rule_id = str(item.get("rule_identifier", "")).strip()
                if not rule_id:
                    continue

                # Rule check 1: Must reference an existing deterministic rule identifier
                if rule_id not in valid_rules:
                    logger.warning("Model output hallucinated unknown rule_identifier: %s. Rejecting response.", rule_id)
                    return AIExplanationResponse(
                        summary="AI clinical explanation rejected: Hallucinated rule identifier detected.",
                        finding_explanations=[],
                        clinical_context="Deterministic safety verification preserved.",
                        uncertainties=["Model attempted to reference nonexistent rule identifier."],
                        review_considerations=["Evaluate deterministic findings directly."],
                        ai_status="rejected",
                        status_detail=f"Unknown rule identifier '{rule_id}' not in deterministic findings.",
                        model_name=self.model_name,
                    )

                # Rule check 2: Severity invariant must not be modified
                model_severity = str(item.get("severity", "")).upper().strip()
                authoritative_severity = valid_rules[rule_id].upper().strip()
                if model_severity and model_severity != authoritative_severity:
                    logger.warning(
                        "Model altered severity for %s from %s to %s. Rejecting response.",
                        rule_id, authoritative_severity, model_severity
                    )
                    return AIExplanationResponse(
                        summary="AI clinical explanation rejected: Attempted alteration of deterministic severity.",
                        finding_explanations=[],
                        clinical_context="Deterministic safety verification preserved.",
                        uncertainties=["Model attempted to change deterministic severity rank."],
                        review_considerations=["Evaluate deterministic findings directly."],
                        ai_status="rejected",
                        status_detail=f"Severity mismatch on {rule_id}: expected {authoritative_severity}, got {model_severity}.",
                        model_name=self.model_name,
                    )

                category = str(item.get("category", "")).strip()
                clinical_exp = str(item.get("clinical_explanation", "")).strip()
                if not clinical_exp:
                    clinical_exp = "No specific clinical explanation text provided."

                parsed_explanations.append(
                    FindingExplanation(
                        rule_identifier=rule_id,
                        category=category,
                        severity=authoritative_severity,
                        clinical_explanation=clinical_exp,
                    )
                )

        uncertainties = [str(u).strip() for u in data.get("uncertainties", []) if str(u).strip()]
        review_considerations = [str(rc).strip() for rc in data.get("review_considerations", []) if str(rc).strip()]

        return AIExplanationResponse(
            summary=summary,
            finding_explanations=parsed_explanations,
            clinical_context=clinical_context,
            uncertainties=uncertainties,
            review_considerations=review_considerations,
            ai_status="available",
            status_detail=None,
            model_name=self.model_name,
        )


baseten_service = BasetenService()
