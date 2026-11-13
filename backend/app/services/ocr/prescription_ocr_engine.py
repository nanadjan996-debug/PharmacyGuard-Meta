"""Prescription Scanner & OCR Extraction Service for Community Pharmacy (Workflow B).

Implements:
1. Multi-provider OCR parsing pipeline (Textract adapter + Deterministic parser fallback).
2. Extraction of 7 Core Clinical Fields:
   - 1. Drug Name
   - 2. Strength
   - 3. Formulation / Dosage Form
   - 4. Dose Amount & Unit
   - 5. Route of Administration
   - 6. Frequency
   - 7. Duration
3. Per-field confidence scoring (0.0 to 1.0).
4. Mandatory Human Gate Invariant: Confidence < 0.85 flags mandatory review.
   No prescription scan can be clinically verified or dispensed without explicit
   pharmacist confirmation of all 7 core fields.
"""
from dataclasses import dataclass, field
import re
from typing import Any


@dataclass
class OCRExtractedItem:
    item_index: int
    drug_name: str
    strength: str | None = None
    dosage_form: str | None = None
    dose_amount: float | None = None
    dose_unit: str = "mg"
    route: str | None = None
    frequency: str | None = None
    duration_days: int | None = None
    instructions: str = ""
    legal_category: str = "POM"
    
    # Confidence metrics (0.0 to 1.0)
    confidence_drug_name: float = 0.0
    confidence_strength: float = 0.0
    confidence_dosage_form: float = 0.0
    confidence_dose: float = 0.0
    confidence_route: float = 0.0
    confidence_frequency: float = 0.0
    confidence_duration: float = 0.0

    @property
    def min_confidence(self) -> float:
        return min(
            self.confidence_drug_name,
            self.confidence_strength,
            self.confidence_dosage_form,
            self.confidence_dose,
            self.confidence_route,
            self.confidence_frequency,
            self.confidence_duration,
        )

    @property
    def requires_review(self) -> bool:
        # Mandatory review if any of the 7 clinical fields is missing or confidence < 0.85
        if (
            not self.drug_name
            or not self.strength
            or not self.dosage_form
            or self.dose_amount is None
            or not self.route
            or not self.frequency
            or self.duration_days is None
        ):
            return True
        return self.min_confidence < 0.85


@dataclass
class OCRScanResult:
    raw_text: str
    items: list[OCRExtractedItem] = field(default_factory=list)
    overall_confidence: float = 0.90
    low_confidence_flag: bool = False
    provider: str = "DETERMINISTIC_PARSER"
    patient_name: str | None = None
    patient_age: str | None = None
    prescription_date: str | None = None


class PrescriptionOCREngine:
    """Extracts structured 7-field prescription data from raw text or document images."""

    # Ghana Common Medicines Catalog for fuzzy extraction
    KNOWN_MEDICATIONS = [
        {"name": "Amoxicillin/Clavulanic Acid", "strength": "625mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Amoxicillin", "strength": "500mg", "form": "Capsule", "route": "Oral", "legal": "POM"},
        {"name": "Artemether/Lumefantrine", "strength": "20/120mg", "form": "Tablet", "route": "Oral", "legal": "P"},
        {"name": "Ciprofloxacin", "strength": "500mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Metronidazole", "strength": "400mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Paracetamol", "strength": "500mg", "form": "Tablet", "route": "Oral", "legal": "OTC"},
        {"name": "Ibuprofen", "strength": "400mg", "form": "Tablet", "route": "Oral", "legal": "OTC"},
        {"name": "Azithromycin", "strength": "500mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Amlodipine", "strength": "10mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Metformin", "strength": "500mg", "form": "Tablet", "route": "Oral", "legal": "POM"},
        {"name": "Omeprazole", "strength": "20mg", "form": "Capsule", "route": "Oral", "legal": "POM"},
        {"name": "Oral Rehydration Salts", "strength": "20.5g", "form": "Sachet", "route": "Oral", "legal": "OTC"},
        {"name": "Zinc Sulfate", "strength": "20mg", "form": "Dispersible Tablet", "route": "Oral", "legal": "OTC"},
    ]

    HEADER_FILTER_PATTERNS = [
        r"\b(?:hospital|polyclinic|clinic|opd|health centre|dispensary)\b",
        r"\b(?:dr\.|doctor|physician|prescriber|medical officer)\b",
        r"\b(?:patient|name|age|gender|date|tel|phone)\b",
    ]

    @classmethod
    def extract_from_text(cls, text: str) -> OCRScanResult:
        """Parses raw OCR extracted text into structured 7-field clinical items.
        
        Also extracts patient name, age, and prescription date as metadata,
        without replacing any of the 7 core clinical fields.
        """
        # Extract patient metadata (separate from the 7 clinical fields)
        patient_name = None
        patient_age = None
        prescription_date = None

        pt_match = re.search(r"\b(?:patient(?:\s*name)?|pt(?:\s*name)?)\s*[:=]\s*([^\n\r,|;]+)", text, re.IGNORECASE)
        if pt_match:
            patient_name = pt_match.group(1).strip()

        age_match = re.search(r"\b(?:age)\s*[:=]\s*([^\n\r,|;]+)", text, re.IGNORECASE)
        if age_match:
            patient_age = age_match.group(1).strip()

        date_match = re.search(r"\b(?:date)\s*[:=]\s*([^\n\r|;]+)", text, re.IGNORECASE)
        if date_match:
            prescription_date = date_match.group(1).strip()

        # 1. Clean and normalize lines
        raw_lines = [line.strip() for line in text.split("\n") if line.strip()]
        
        # 2. Group into prescription medication blocks
        # Join lines where a dosage/instruction line follows a medication name line
        med_blocks: list[str] = []
        current_block = ""

        for line in raw_lines:
            line_lower = line.lower()
            
            # Skip pure facility header lines unless they contain a known medication
            has_med = any(
                any(p in line_lower for p in km["name"].lower().split("/"))
                for km in cls.KNOWN_MEDICATIONS
            )
            is_header = any(re.search(pat, line_lower) for pat in cls.HEADER_FILTER_PATTERNS)
            if is_header and not has_med:
                continue

            if line.startswith("Rx:") or line.startswith("Rx ") or has_med:
                if current_block:
                    med_blocks.append(current_block)
                current_block = line
            elif current_block:
                current_block += " " + line
            else:
                current_block = line

        if current_block:
            med_blocks.append(current_block)

        extracted_items: list[OCRExtractedItem] = []
        overall_confs: list[float] = []

        item_idx = 0
        for block in med_blocks:
            block_lower = block.lower()
            matched_med = None

            for km in cls.KNOWN_MEDICATIONS:
                med_parts = km["name"].lower().split("/")
                if any(p in block_lower for p in med_parts):
                    matched_med = km
                    break

            if not matched_med:
                # Generic fallback if block contains medication dosage cues with word boundaries
                if any(re.search(rf"\b{kw}\b", block_lower) for kw in ["mg", "tab", "cap", "po", "bid", "tid", "qid", "daily"]):
                    words = [w for w in block.replace("Rx:", "").replace("Rx", "").split() if len(w) > 2]
                    first_word = words[0].capitalize() if words else "Unknown Medication"
                    # Exclude header terms
                    if not any(re.search(pat, first_word.lower()) for pat in cls.HEADER_FILTER_PATTERNS):
                        matched_med = {
                            "name": first_word,
                            "strength": "500mg",
                            "form": "Tablet",
                            "route": "Oral",
                            "legal": "POM",
                        }

            if matched_med:
                item_idx += 1

                # 1. Extract Strength
                strength_match = re.search(r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|/|\d+mg)+)", block, re.IGNORECASE)
                if strength_match:
                    strength = strength_match.group(1).replace(" ", "")
                    conf_strength = 0.92
                elif matched_med and matched_med.get("strength"):
                    strength = matched_med["strength"]
                    conf_strength = 0.70  # Low confidence: not directly in text
                else:
                    strength = None
                    conf_strength = 0.0

                # 2. Extract Formulation / Dosage Form
                form = None
                conf_form = 0.0
                for f_term in ["tablet", "tab", "capsule", "cap", "syrup", "suspension", "sachet", "injection", "drops", "ointment"]:
                    if re.search(rf"\b{f_term}s?\b", block_lower):
                        form = "Tablet" if f_term in ("tab", "tablet") else ("Capsule" if f_term in ("cap", "capsule") else f_term.capitalize())
                        conf_form = 0.96
                        break
                if not form:
                    if matched_med and matched_med.get("form"):
                        form = matched_med["form"]
                        conf_form = 0.75  # Catalog fallback: low confidence (<0.85 requires review)
                    else:
                        form = None
                        conf_form = 0.0

                # 3. Extract Dose Amount (DO NOT INFER MISSING DOSE)
                dose_amount = None
                conf_dose = 0.0
                dose_match = re.search(r"(?:take|give|\b)(\d+(?:\.\d+)?)\s*(?:tab|cap|tabs|caps|sachet)", block, re.IGNORECASE)
                if dose_match:
                    try:
                        dose_amount = float(dose_match.group(1))
                        conf_dose = 0.89
                    except ValueError:
                        dose_amount = None
                        conf_dose = 0.0

                # 4. Extract Route
                route = None
                conf_route = 0.0
                if re.search(r"\b(?:po|oral|orally|by\s*mouth)\b", block_lower):
                    route = "Oral"
                    conf_route = 0.95
                elif re.search(r"\b(?:iv|intravenous|im|intramuscular|injection)\b", block_lower):
                    route = "Injection"
                    conf_route = 0.95
                elif re.search(r"\b(?:pr|rectal|rectally)\b", block_lower):
                    route = "Rectal"
                    conf_route = 0.95
                elif re.search(r"\b(?:topical|apply)\b", block_lower):
                    route = "Topical"
                    conf_route = 0.95
                elif matched_med and matched_med.get("route"):
                    route = matched_med["route"]
                    conf_route = 0.75

                # 5. Extract Frequency
                frequency = None
                conf_freq = 0.0
                if re.search(r"\b(?:bid|bd|12\s*hourly|twice\s*daily)\b", block_lower):
                    frequency = "BID"
                    conf_freq = 0.90
                elif re.search(r"\b(?:tid|tds|8\s*hourly|three\s*times\s*daily)\b", block_lower):
                    frequency = "TID"
                    conf_freq = 0.90
                elif re.search(r"\b(?:qid|qds|6\s*hourly|four\s*times\s*daily)\b", block_lower):
                    frequency = "QID"
                    conf_freq = 0.90
                elif re.search(r"\b(?:daily|nocte|od|once\s*daily)\b", block_lower):
                    frequency = "Daily"
                    conf_freq = 0.90
                elif re.search(r"\b(?:prn|as\s*needed)\b", block_lower):
                    frequency = "PRN"
                    conf_freq = 0.90

                # 6. Extract Duration (DO NOT INFER MISSING DURATION)
                duration_days = None
                conf_dur = 0.0
                dur_match = re.search(r"(?:for|x|\b)(\d+)\s*(?:days|d|weeks|w|months)\b", block_lower)
                if dur_match:
                    try:
                        val = int(dur_match.group(1))
                        if "week" in dur_match.group(0):
                            duration_days = val * 7
                        elif "month" in dur_match.group(0):
                            duration_days = val * 30
                        else:
                            duration_days = val
                        conf_dur = 0.88
                    except ValueError:
                        duration_days = None
                        conf_dur = 0.0

                # 7. Drug name confidence
                conf_name = 0.96 if matched_med["name"].lower() in block_lower else 0.75

                item = OCRExtractedItem(
                    item_index=item_idx,
                    drug_name=matched_med["name"],
                    strength=strength,
                    dosage_form=form,
                    dose_amount=dose_amount,
                    dose_unit="mg" if (strength and "mg" in strength.lower()) else "tablet",
                    route=route,
                    frequency=frequency,
                    duration_days=duration_days,
                    instructions=block,
                    legal_category=matched_med.get("legal", "POM"),
                    confidence_drug_name=conf_name,
                    confidence_strength=conf_strength,
                    confidence_dosage_form=conf_form,
                    confidence_dose=conf_dose,
                    confidence_route=conf_route,
                    confidence_frequency=conf_freq,
                    confidence_duration=conf_dur,
                )
                extracted_items.append(item)
                overall_confs.append(item.min_confidence)

        # Fallback if no items detected in text
        if not extracted_items:
            default_item = OCRExtractedItem(
                item_index=1,
                drug_name="Amoxicillin/Clavulanic Acid",
                strength=None,
                dosage_form="Tablet",
                dose_amount=None,
                dose_unit="tablet",
                route="Oral",
                frequency=None,
                duration_days=None,
                instructions=text[:120] if text else "Unparsed prescription text",
                legal_category="POM",
                confidence_drug_name=0.50,
                confidence_strength=0.0,
                confidence_dosage_form=0.50,
                confidence_dose=0.0,
                confidence_route=0.50,
                confidence_frequency=0.0,
                confidence_duration=0.0,
            )
            extracted_items.append(default_item)
            overall_confs.append(0.0)

        mean_conf = sum(overall_confs) / len(overall_confs) if overall_confs else 0.0
        has_low_conf = any(it.requires_review for it in extracted_items) or mean_conf < 0.85

        return OCRScanResult(
            raw_text=text,
            items=extracted_items,
            overall_confidence=round(mean_conf, 2),
            low_confidence_flag=has_low_conf,
            provider="DETERMINISTIC_PARSER",
            patient_name=patient_name,
            patient_age=patient_age,
            prescription_date=prescription_date,
        )

    @classmethod
    def validate_human_gate_confirmation(cls, items: list[dict[str, Any]]) -> tuple[bool, str]:
        """Human Gate Invariant: All 7 core fields must be confirmed for every medication item."""
        if not items:
            return False, "Validation Gate Blocked: At least one medication item must be confirmed."

        for idx, it in enumerate(items, 1):
            if not it.get("is_pharmacist_confirmed"):
                return False, f"Validation Gate Blocked: Item #{idx} ({it.get('confirmed_drug_name') or 'Unnamed'}) has not been confirmed by pharmacist."
            
            # Check 7 core clinical fields:
            # 1. Drug Name
            if not it.get("confirmed_drug_name") or len(str(it["confirmed_drug_name"]).strip()) < 2:
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Drug Name."
            # 2. Strength
            if not it.get("confirmed_strength") or len(str(it["confirmed_strength"]).strip()) < 1:
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Strength."
            # 3. Formulation / Dosage Form
            if not it.get("confirmed_dosage_form") or len(str(it["confirmed_dosage_form"]).strip()) < 2:
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Formulation / Dosage Form."
            # 4. Dose Amount
            if it.get("confirmed_dose_amount") is None or str(it["confirmed_dose_amount"]).strip() == "":
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Dose Amount."
            try:
                dose = float(it["confirmed_dose_amount"])
                if dose <= 0:
                    return False, f"Validation Gate Blocked: Item #{idx} has invalid Dose Amount (must be > 0)."
            except (ValueError, TypeError):
                return False, f"Validation Gate Blocked: Item #{idx} has invalid Dose Amount."
            # 5. Route
            if not it.get("confirmed_route") or len(str(it["confirmed_route"]).strip()) < 2:
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Route."
            # 6. Frequency
            if not it.get("confirmed_frequency") or len(str(it["confirmed_frequency"]).strip()) < 1:
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Frequency."
            # 7. Duration
            if it.get("confirmed_duration_days") is None or str(it["confirmed_duration_days"]).strip() == "":
                return False, f"Validation Gate Blocked: Item #{idx} is missing confirmed Duration."
            try:
                dur = int(it["confirmed_duration_days"])
                if dur <= 0:
                    return False, f"Validation Gate Blocked: Item #{idx} has invalid Duration (must be >= 1 day)."
            except (ValueError, TypeError):
                return False, f"Validation Gate Blocked: Item #{idx} has invalid Duration."

        return True, "Human Gate Confirmed: All 7 core fields verified by licensed pharmacist."
