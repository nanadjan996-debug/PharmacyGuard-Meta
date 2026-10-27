from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PharmacistReview(Base):
    __tablename__ = "pharmacist_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(30), nullable=False)  # ACCEPT, OVERRIDE, ESCALATE
    override_rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="reviews")
    reviewer: Mapped["User"] = relationship("User", back_populates="reviews")
    findings: Mapped[list["ReviewFinding"]] = relationship(
        "ReviewFinding", back_populates="review", cascade="all, delete-orphan"
    )


class ReviewFinding(Base):
    __tablename__ = "review_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("pharmacist_reviews.id", ondelete="CASCADE"), nullable=True, index=True
    )
    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule_identifier: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # Categories: "ALLERGY", "DRUG_INTERACTION", "THERAPEUTIC_DUPLICATION", "INDICATION", "DOSAGE", "INVENTORY"
    severity: Mapped[str] = mapped_column(String(30), nullable=False)
    # Severity: "HIGH", "MODERATE", "LOW", "INFO"
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    # Status: "CONFLICT_DETECTED", "REVIEW_REQUIRED", "UNKNOWN", "CLEAN"
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    rule_source: Mapped[str] = mapped_column(String(150), nullable=False)
    human_review_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    review: Mapped["PharmacistReview | None"] = relationship("PharmacistReview", back_populates="findings")
    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="findings")


class EscalationResolution(Base):
    __tablename__ = "escalation_resolutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    escalated_by_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    resolved_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    escalation_reason: Mapped[str] = mapped_column(Text, nullable=False)
    resolution_action: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Actions: "APPROVED_BY_CHIEF", "REJECTED_RETURNED_TO_PRESCRIBER", "MODIFIED_AND_APPROVED"
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="escalations")
    escalated_by: Mapped["User"] = relationship("User", foreign_keys=[escalated_by_id])
    resolved_by: Mapped["User | None"] = relationship("User", foreign_keys=[resolved_by_id])
