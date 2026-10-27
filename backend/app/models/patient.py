from datetime import datetime, date, timezone
import uuid
from sqlalchemy import String, Boolean, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class SyntheticPatient(Base):
    __tablename__ = "synthetic_patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    mrn: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    height_cm: Mapped[float] = mapped_column(Float, nullable=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    diagnoses: Mapped[list["PatientDiagnosis"]] = relationship(
        "PatientDiagnosis", back_populates="patient", cascade="all, delete-orphan"
    )
    allergies: Mapped[list["PatientAllergy"]] = relationship(
        "PatientAllergy", back_populates="patient", cascade="all, delete-orphan"
    )
    prescriptions: Mapped[list["Prescription"]] = relationship(
        "Prescription", back_populates="patient", cascade="all, delete-orphan"
    )


class PatientDiagnosis(Base):
    __tablename__ = "patient_diagnoses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("synthetic_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    icd10_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    diagnosed_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    patient: Mapped["SyntheticPatient"] = relationship("SyntheticPatient", back_populates="diagnoses")


class PatientAllergy(Base):
    __tablename__ = "patient_allergies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("synthetic_patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    allergen: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    allergy_type: Mapped[str] = mapped_column(String(50), default="Drug", nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)  # Mild, Moderate, Severe, Anaphylaxis
    reaction: Mapped[str] = mapped_column(String(255), nullable=False)

    patient: Mapped["SyntheticPatient"] = relationship("SyntheticPatient", back_populates="allergies")
