from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("synthetic_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    prescriber_name: Mapped[str] = mapped_column(String(100), nullable=False)
    prescriber_department: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False, index=True)
    # Status options: "pending", "reviewed", "overridden", "escalated", "resolved"
    scenario_key: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    clinical_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    patient: Mapped["SyntheticPatient"] = relationship("SyntheticPatient", back_populates="prescriptions")
    items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["PharmacistReview"]] = relationship(
        "PharmacistReview", back_populates="prescription", cascade="all, delete-orphan"
    )
    findings: Mapped[list["ReviewFinding"]] = relationship(
        "ReviewFinding", back_populates="prescription", cascade="all, delete-orphan"
    )
    escalations: Mapped[list["EscalationResolution"]] = relationship(
        "EscalationResolution", back_populates="prescription", cascade="all, delete-orphan"
    )


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    medication_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("medication_references.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    dose_amount: Mapped[float] = mapped_column(Float, nullable=False)
    dose_unit: Mapped[str] = mapped_column(String(20), default="mg", nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "Once daily", "BID", "Q6H"
    route: Mapped[str] = mapped_column(String(50), default="Oral", nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    quantity_prescribed: Mapped[int] = mapped_column(Integer, nullable=False)
    instructions: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="items")
    medication: Mapped["MedicationReference"] = relationship("MedicationReference", back_populates="prescription_items")
