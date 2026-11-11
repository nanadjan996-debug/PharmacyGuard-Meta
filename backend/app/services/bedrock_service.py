"""Amazon Bedrock Hosted Inference Service for Claude on AWS Bedrock.

Integrates Claude (e.g. us.anthropic.claude-sonnet-4-6 or claude-3-5-haiku) through AWS Bedrock
to explain and synthesize deterministic safety findings for the reviewing human pharmacist.

Primary Architectural Principle:
- Deterministic verification engine executes first and is authoritative.
- AI provides non-authoritative explanatory clinical context.
- Model has no authority to approve, reject, or authorize medication dispensing.
- Hard timeout with graceful fallback to deterministic findings.
"""
import asyncio
import json
import logging
import re
from typing import Any, Sequence
from datetime import date, datetime

import boto3
from botocore.exceptions import ClientError, BotoCoreError

from app.config import settings
from app.schemas.ai import AIExplanationResponse, FindingExplanation

logger = logging.getLogger("pharmacyguard.bedrock")


_UNSET: Any = object()


class BedrockService:
    """Client for clinical AI inference hosted on Amazon Bedrock."""

    def __init__(
        self,
        aws_access_key_id: Any = _UNSET,
        aws_secret_access_key: Any = _UNSET,
        region_name: str | None = None,
        model_id: str | None = None,
        timeout_seconds: float | None = None,
    ):
        self.aws_access_key_id = (
            settings.AWS_ACCESS_KEY_ID if aws_access_key_id is _UNSET else aws_access_key_id
        )
        self.aws_secret_access_key = (
            settings.AWS_SECRET_ACCESS_KEY if aws_secret_access_key is _UNSET else aws_secret_access_key
        )
        self.region_name = region_name or settings.AWS_DEFAULT_REGION
        self.model_id = model_id or settings.BEDROCK_MODEL_ID
        self.timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else settings.BEDROCK_TIMEOUT_SECONDS
        )
        self._client = None

    @property
    def is_configured(self) -> bool:
        """Check whether valid credentials and configuration are provided."""
        return bool(self.aws_access_key_id and self.aws_secret_access_key and self.region_name)

    def _get_client(self):
        """Get or initialize the boto3 bedrock-runtime client."""
        if self._client is None and self.is_configured:
            session = boto3.Session(
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.region_name,
            )
            self._client = session.client("bedrock-runtime")
        return self._client

    async def generate_explanation(
        self,
        prescription: Any,
        findings: Sequence[Any],
    ) -> AIExplanationResponse:
        """
        Generate structured clinical explanation for deterministic findings using Amazon Bedrock.

        Args:
            prescription: Prescription database model or schema object.
            findings: List of GeneratedFinding or ReviewFinding items.

        Returns:
            Validated AIExplanationResponse with deterministic fallback on any failure.
        """
        # 1. Fallback if API credentials are not configured
        if not self.is_configured:
            return AIExplanationResponse(
                summary="AI clinical explanation is unavailable because AWS Bedrock credentials are not configured.",
                finding_explanations=[],
                clinical_context="Prescription evaluated under deterministic rule verification.",
                uncertainties=["AI model inference not active."],
                review_considerations=["Review flagged deterministic findings directly."],
                ai_status="unavailable",
                status_detail="AWS Bedrock credentials are not configured.",
                model_name=self.model_id,
            )

        # 2. Extract minimal required clinical payload (zero extraneous identifiers/secrets)
        payload_context = self._extract_minimal_context(prescription, findings)

        # 3. Build system and user prompts with strict anti-hallucination and anti-approval constraints
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(payload_context)

        # 4. Execute request with strict timeout via thread pool
        def _invoke():
            client = self._get_client()
            return client.converse(
                modelId=self.model_id,
                system=[{"text": system_prompt}],
                messages=[
                    {"role": "user", "content": [{"text": user_prompt}]}
                ],
                inferenceConfig={
                    "temperature": 0.1,
                    "maxTokens": 4096,
                },
            )

        try:
            response_data = await asyncio.wait_for(
                asyncio.to_thread(_invoke),
                timeout=self.timeout_seconds,
            )

            output_message = response_data.get("output", {}).get("message", {})
            content_blocks = output_message.get("content", [])
            raw_content = ""
            for block in content_blocks:
                if "text" in block:
                    raw_content += block["text"]

            return self._validate_and_parse_response(raw_content, findings)

        except asyncio.TimeoutError:
            logger.warning("Bedrock inference timed out after %s seconds", self.timeout_seconds)
            return AIExplanationResponse(
                summary="AI clinical explanation timed out. Deterministic safety verification remains fully available.",
                finding_explanations=[],
                clinical_context="Evaluation timed out after threshold.",
                uncertainties=["Inference provider did not respond within the safety threshold."],
                review_considerations=["Proceed with standard clinical review based on deterministic findings below."],
                ai_status="timeout",
                status_detail=f"Inference request exceeded {self.timeout_seconds}-second timeout limit.",
                model_name=self.model_id,
            )

        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code", "Unknown")
            error_msg = exc.response.get("Error", {}).get("Message", str(exc))
            logger.warning("Bedrock ClientError %s: %s", error_code, error_msg)
            return AIExplanationResponse(
                summary="AI clinical explanation service is temporarily unavailable.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Bedrock provider returned a client error."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="unavailable",
                status_detail=f"AWS Bedrock error ({error_code}): {error_msg[:120]}",
                model_name=self.model_id,
            )

        except BotoCoreError as exc:
            logger.warning("Bedrock BotoCoreError: %s", str(exc))
            return AIExplanationResponse(
                summary="AI clinical explanation service is currently unreachable.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Network failure communicating with AWS Bedrock."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="unavailable",
                status_detail=f"Bedrock connection error: {str(exc)}",
                model_name=self.model_id,
            )

        except Exception as exc:
            logger.error("Unexpected error in Bedrock AI explanation service: %s", str(exc), exc_info=True)
            return AIExplanationResponse(
                summary="AI clinical explanation could not be generated.",
                finding_explanations=[],
                clinical_context="Deterministic safety verification preserved.",
                uncertainties=["Model output processing error."],
                review_considerations=["Evaluate deterministic findings directly."],
                ai_status="rejected",
                status_detail=f"Service error: {str(exc)}",
                model_name=self.model_id,
            )

    def _extract_minimal_context(self, prescription: Any, findings: Sequence[Any]) -> dict[str, Any]:
        """Extract only clinically necessary synthetic information."""
        patient = getattr(prescription, "patient", None)

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
                    "allergen": getattr(a, "allergen", getattr(a, "allergen_name", "Unknown")),
                    "type": getattr(a, "allergy_type", "Unknown"),
                    "severity": getattr(a, "severity", "Unknown"),
                    "reaction": getattr(a, "reaction", ""),
                })

        conditions_list = []
        if patient and getattr(patient, "diagnoses", None):
            for d in patient.diagnoses:
                conditions_list.append({
                    "condition": getattr(d, "description", getattr(d, "condition_name", "Unknown")),
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

        # Patient Confidentiality Guardrail:
        # Sanitize clinical notes to redact any incidental mention of patient names
        raw_notes = getattr(prescription, "clinical_notes", None) or "None provided."
        sanitized_notes = raw_notes
        if patient:
            first_name = str(getattr(patient, "first_name", "") or "").strip()
            last_name = str(getattr(patient, "last_name", "") or "").strip()
            if len(first_name) > 1:
                sanitized_notes = re.sub(rf"\b{re.escape(first_name)}\b", "[PATIENT]", sanitized_notes, flags=re.IGNORECASE)
            if len(last_name) > 1:
                sanitized_notes = re.sub(rf"\b{re.escape(last_name)}\b", "[PATIENT]", sanitized_notes, flags=re.IGNORECASE)

        # Zero-PHI Payload
        return {
            "patient": {
                "age": age_str,
                "gender": getattr(patient, "gender", "Unknown") if patient else "Unknown",
                "weight_kg": getattr(patient, "weight_kg", 70.0) if patient else 70.0,
                "allergies": allergies_list,
                "conditions": conditions_list,
            },
            "clinical_notes": sanitized_notes,
            "prescribed_medications": medications_list,
            "deterministic_findings": findings_list,
        }

    def _build_system_prompt(self) -> str:
        """Construct prompt enforcing strict explanatory bounds and JSON output."""
        return (
            "You are PharmacyGuard AI Clinical Explainer, an expert clinical pharmacy decision-support "
            "assistant powered by Amazon Bedrock.\n\n"
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
            "6. PATIENT PRIVACY & DE-IDENTIFICATION: The payload you receive is strictly de-identified (containing "
            "only clinical parameters: age, gender, weight, allergies, conditions, medications). Patient names and "
            "direct identifiers are strictly excluded. You must NEVER request, infer, or output patient names or "
            "personal identifiers in any field of your response.\n"
            "7. JSON OUTPUT FORMAT: Output ONLY a single, valid, complete JSON object matching this schema exactly:\n"
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
                model_name=self.model_id,
            )

        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
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
                    model_name=self.model_id,
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
                model_name=self.model_id,
            )

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
                model_name=self.model_id,
            )

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
                model_name=self.model_id,
            )

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
                        model_name=self.model_id,
                    )

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
                        model_name=self.model_id,
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
            model_name=self.model_id,
        )


bedrock_service = BedrockService()
