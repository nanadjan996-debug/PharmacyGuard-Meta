from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, event
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class EducationalCase(Base):
    __tablename__ = "educational_cases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    # Tiers: "BEGINNER", "INTERMEDIATE", "ADVANCED"
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    patient_summary: Mapped[str] = mapped_column(Text, nullable=False)
    prescription_summary: Mapped[str] = mapped_column(Text, nullable=False)
    clinical_scenario: Mapped[str] = mapped_column(Text, nullable=False)
    predefined_answer: Mapped[str] = mapped_column(String(50), nullable=False)
    # Answers: "REJECT", "APPROVE_WITH_MONITORING", "OVERRIDE_WITH_RATIONALE", "ESCALATE"
    predefined_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    key_learning_points: Mapped[str] = mapped_column(Text, nullable=False)  # JSON or bulleted points
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    submissions: Mapped[list["StudentSubmission"]] = relationship(
        "StudentSubmission", back_populates="case", cascade="all, delete-orphan"
    )


class StudentSubmission(Base):
    __tablename__ = "student_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("educational_cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submitted_determination: Mapped[str] = mapped_column(String(50), nullable=False)
    submitted_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["EducationalCase"] = relationship("EducationalCase", back_populates="submissions")
    student: Mapped["User"] = relationship("User", back_populates="student_submissions")


@event.listens_for(StudentSubmission, "before_update")
def prevent_student_submission_update(mapper, connection, target):
    """Enforce append-only immutability for student educational submission history."""
    raise PermissionError("StudentSubmission records are permanent academic history and strictly immutable.")


@event.listens_for(StudentSubmission, "before_delete")
def prevent_student_submission_delete(mapper, connection, target):
    """Prevent deletion of student submissions through standard ORM sessions."""
    raise PermissionError("StudentSubmission records are permanent academic history and cannot be deleted.")
