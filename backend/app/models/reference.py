import uuid
from sqlalchemy import String, Boolean, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class MedicationReference(Base):
    __tablename__ = "medication_references"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "MED-LIS-10", "MED-AMOX-500"
    generic_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    brand_name: Mapped[str] = mapped_column(String(100), nullable=False)
    drug_class: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    dosage_form: Mapped[str] = mapped_column(String(50), nullable=False)  # Oral Tablet, Capsule, IV Solution
    standard_strength: Mapped[str] = mapped_column(String(50), nullable=False)
    route: Mapped[str] = mapped_column(String(50), nullable=False)  # Oral, IV, Topical
    is_demo_reference: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    prescription_items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="medication"
    )
    inventory_item: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="medication", uselist=False
    )
    indication_rules: Mapped[list["IndicationRule"]] = relationship(
        "IndicationRule", back_populates="medication"
    )
    dosage_rules: Mapped[list["DosageRule"]] = relationship(
        "DosageRule", back_populates="medication"
    )


class IndicationRule(Base):
    __tablename__ = "indication_rules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    medication_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("medication_references.id", ondelete="CASCADE"), nullable=False, index=True
    )
    approved_icd10_codes: Mapped[str] = mapped_column(String(255), nullable=False)  # JSON or comma-separated list
    indication_name: Mapped[str] = mapped_column(String(150), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_source: Mapped[str] = mapped_column(String(150), nullable=False)
    is_demo_rule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    medication: Mapped["MedicationReference"] = relationship("MedicationReference", back_populates="indication_rules")


class AllergyCrossReactivityRule(Base):
    __tablename__ = "allergy_cross_reactivity_rules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    allergen_class: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    cross_reactive_class: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    risk_level: Mapped[str] = mapped_column(String(50), nullable=False)  # High, Moderate, Low
    cross_reactivity_rate_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_source: Mapped[str] = mapped_column(String(150), nullable=False)
    is_demo_rule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class DrugInteractionRule(Base):
    __tablename__ = "drug_interaction_rules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    drug_a_class_or_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    drug_b_class_or_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)  # High, Moderate, Low
    clinical_effect: Mapped[str] = mapped_column(String(255), nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_source: Mapped[str] = mapped_column(String(150), nullable=False)
    is_demo_rule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class DosageRule(Base):
    __tablename__ = "dosage_rules"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    medication_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("medication_references.id", ondelete="CASCADE"), nullable=False, index=True
    )
    min_daily_dose_mg: Mapped[float] = mapped_column(Float, nullable=False)
    max_daily_dose_mg: Mapped[float] = mapped_column(Float, nullable=False)
    max_single_dose_mg: Mapped[float] = mapped_column(Float, nullable=False)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_source: Mapped[str] = mapped_column(String(150), nullable=False)
    is_demo_rule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    medication: Mapped["MedicationReference"] = relationship("MedicationReference", back_populates="dosage_rules")
