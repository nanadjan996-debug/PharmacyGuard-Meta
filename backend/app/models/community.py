from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CommunityConsultation(Base):
    """Walk-in community pharmacy counter consultation record.
    
    Adheres strictly to Act 843 data minimality and synthetic testing guardrails.
    No direct personal identifiers (real patient names, ID cards, phone numbers)
    are collected or stored during development.
    """
    __tablename__ = "community_consultations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    patient_identifier: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    
    # Demographics
    age_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Vitals
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    sbp_mmhg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dbp_mmhg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    heart_rate_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    respiratory_rate_bpm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spo2_percent: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Clinical diagnostics & screening (5-state epistemic model / GHS protocols)
    mrdt_status: Mapped[str] = mapped_column(
        String(30), default="NOT_DONE", nullable=False
    )  # CONFIRMED_POSITIVE, CONFIRMED_NEGATIVE, TESTING_UNAVAILABLE, NOT_DONE
    g6pd_status: Mapped[str] = mapped_column(
        String(30), default="NOT_COLLECTED", nullable=False
    )  # CONFIRMED_DEFICIENT, CONFIRMED_NORMAL, REPORTED_UNKNOWN, NOT_TESTED, NOT_COLLECTED

    # Presenting complaint & symptoms
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    symptoms_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    allergies_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    current_medications_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)

    # 8-state Consultation Lifecycle:
    # DRAFT, VERIFICATION_COMPLETED, FINDINGS_REVIEWED, PRESCRIBER_CLARIFICATION_PENDING,
    # REFERRED, APPROVED_FOR_DISPENSING, COMPLETED, AMENDED
    status: Mapped[str] = mapped_column(String(40), default="DRAFT", index=True, nullable=False)

    # Triage and Referral outputs
    referral_triggered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    referral_urgency: Mapped[str | None] = mapped_column(String(30), nullable=True)  # EMERGENCY, URGENT, ROUTINE
    referral_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    referral_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pharmacist governance notes & rationale
    pharmacist_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispense_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Audit & Security
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list["CommunityConsultationItem"]] = relationship(
        "CommunityConsultationItem", back_populates="consultation", cascade="all, delete-orphan"
    )
    findings: Mapped[list["CommunityFinding"]] = relationship(
        "CommunityFinding", back_populates="consultation", cascade="all, delete-orphan"
    )


class CommunityConsultationItem(Base):
    """Medication planned or dispensed during counter consultation."""
    __tablename__ = "community_consultation_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("community_consultations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    drug_name: Mapped[str] = mapped_column(String(100), nullable=False)
    strength: Mapped[str] = mapped_column(String(50), nullable=False)
    dosage_form: Mapped[str] = mapped_column(String(50), nullable=False)
    dose_amount: Mapped[float] = mapped_column(Float, nullable=False)
    dose_unit: Mapped[str] = mapped_column(String(20), default="mg", nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    route: Mapped[str] = mapped_column(String(30), default="Oral", nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Statutory medicine classification under Act 857
    legal_category: Mapped[str] = mapped_column(String(20), default="OTC", nullable=False)  # OTC, P, POM

    consultation: Mapped["CommunityConsultation"] = relationship(
        "CommunityConsultation", back_populates="items"
    )


class CommunityFinding(Base):
    """Clinical finding or red flag surfaced during counter consultation."""
    __tablename__ = "community_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("community_consultations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_identifier: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)  # RED_FLAG, DOSAGE, ALLERGY, INTERACTION, TRIAGE_WARNING
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # HIGH, MODERATE, LOW, INFO
    epistemic_status: Mapped[str] = mapped_column(
        String(30), default="CONFIRMED_OBJECTIVE", nullable=False
    )  # CONFIRMED_OBJECTIVE, REPORTED_UNVERIFIED, PATIENT_UNKNOWN, NOT_COLLECTED, CLINICALLY_IRRELEVANT
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_required: Mapped[str] = mapped_column(Text, nullable=False)
    is_red_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_referral: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    consultation: Mapped["CommunityConsultation"] = relationship(
        "CommunityConsultation", back_populates="findings"
    )


class ClinicalRuleMeta(Base):
    """Metadata registry for clinical decision rules and faculty approval tracking."""
    __tablename__ = "clinical_rules_meta"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "RF-MAL-SEV-01"
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    source_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    clinical_trigger: Mapped[str] = mapped_column(Text, nullable=False)
    approval_status: Mapped[str] = mapped_column(
        String(50), default="BLOCKED_PENDING_FACULTY_APPROVAL", nullable=False
    )  # APPROVED, BLOCKED_PENDING_FACULTY_APPROVAL
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class CommunityPrescriptionScan(Base):
    """Workflow B: Community Prescription OCR scan & human confirmation record."""
    __tablename__ = "community_prescription_scans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    patient_identifier: Mapped[str] = mapped_column(String(50), default="PT-RX-SCAN", nullable=False)
    patient_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    patient_age: Mapped[str | None] = mapped_column(String(50), nullable=True)
    prescription_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    
    # Image metadata (Act 843 data minimality)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(50), default="image/jpeg", nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_data_base64: Mapped[str | None] = mapped_column(Text, nullable=True)  # Transient preview representation
    
    # OCR Extraction outcomes
    extracted_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    overall_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    low_confidence_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Mandatory 7-Field Human Confirmation Gate:
    # PENDING_REVIEW, HUMAN_CONFIRMED, VERIFICATION_COMPLETED, DISPENSED, REJECTED
    status: Mapped[str] = mapped_column(String(40), default="PENDING_REVIEW", index=True, nullable=False)
    pharmacist_confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pharmacist_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pharmacist_review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    items: Mapped[list["CommunityPrescriptionScanItem"]] = relationship(
        "CommunityPrescriptionScanItem", back_populates="scan", cascade="all, delete-orphan"
    )


class CommunityPrescriptionScanItem(Base):
    """Prescription item extracted by OCR and confirmed through the 7-Field Human Gate."""
    __tablename__ = "community_prescription_scan_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("community_prescription_scans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # 1. OCR Extracted candidate values
    ocr_drug_name: Mapped[str] = mapped_column(String(150), nullable=False)
    ocr_strength: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ocr_dosage_form: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ocr_dose_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    ocr_dose_unit: Mapped[str | None] = mapped_column(String(20), default="mg", nullable=True)
    ocr_route: Mapped[str | None] = mapped_column(String(30), default="Oral", nullable=True)
    ocr_frequency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ocr_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # OCR Confidence scores per field (0.0 to 1.0)
    confidence_drug_name: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_strength: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_dosage_form: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_dose: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_route: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_frequency: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence_duration: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # 2. Mandatory 7-Field Human Gate Confirmed values (Entered / Confirmed by Pharmacist)
    confirmed_drug_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    confirmed_strength: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_dosage_form: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_dose_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    confirmed_dose_unit: Mapped[str | None] = mapped_column(String(20), default="mg", nullable=True)
    confirmed_route: Mapped[str | None] = mapped_column(String(30), default="Oral", nullable=True)
    confirmed_frequency: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confirmed_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Statutory categorization under Act 857
    legal_category: Mapped[str] = mapped_column(String(20), default="POM", nullable=False)
    
    # Human gate lock status & explicit per-field affirmative confirmation flags
    is_drug_name_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_strength_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dosage_form_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_dose_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_route_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_frequency_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_duration_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pharmacist_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confirmed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    scan: Mapped["CommunityPrescriptionScan"] = relationship(
        "CommunityPrescriptionScan", back_populates="items"
    )

