"""Pharmacy Student education workspace endpoints: case study exploration and determination practice."""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, require_pharmacy_student, get_current_user
from app.models.user import User
from app.models.education import EducationalCase, StudentSubmission
from app.models.audit import AuditEvent
from app.schemas.education import (
    EducationalCaseResponse,
    StudentSubmissionRequest,
    StudentSubmissionResultResponse,
)

router = APIRouter(prefix="/education", tags=["Pharmacy Student Workspace"])


@router.get("/cases", response_model=list[EducationalCaseResponse])
def get_educational_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EducationalCaseResponse]:
    """
    List separate educational case library across beginner, intermediate, and advanced tiers.
    Predefined answers and explanations are omitted from the case listing to preserve pedagogical integrity.
    """
    cases = db.query(EducationalCase).order_by(EducationalCase.difficulty.asc()).all()
    return [
        EducationalCaseResponse(
            id=c.id,
            case_code=c.case_code,
            title=c.title,
            difficulty=c.difficulty,
            category=c.category,
            patient_summary=c.patient_summary,
            prescription_summary=c.prescription_summary,
            clinical_scenario=c.clinical_scenario,
        )
        for c in cases
    ]


@router.post("/cases/{case_id}/submit", response_model=StudentSubmissionResultResponse)
def submit_student_determination(
    case_id: str,
    submission: StudentSubmissionRequest,
    current_user: User = Depends(require_pharmacy_student),
    db: Session = Depends(get_db),
) -> StudentSubmissionResultResponse:
    """
    Submit a student clinical determination and reasoning on an educational case.
    Strictly protected: Pharmacy Student role.
    Students have NO access to hospital verification approval, override, or dispensing actions.
    """
    case = db.query(EducationalCase).filter_by(id=case_id).first()
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Educational case {case_id} not found",
        )

    is_correct = submission.determination == case.predefined_answer
    score = 100 if is_correct else 35

    feedback = (
        f"Correct determination! {case.title}."
        if is_correct
        else f"Determination differed from benchmark answer ({case.predefined_answer}). Review clinical guideline rationale."
    )

    student_sub = StudentSubmission(
        case_id=case.id,
        student_id=current_user.id,
        submitted_determination=submission.determination,
        submitted_reasoning=submission.reasoning.strip(),
        is_correct=is_correct,
        score_awarded=score,
        feedback=feedback,
    )
    db.add(student_sub)

    # Record append-only audit event
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role="pharmacy_student",
        action="STUDENT_CASE_SUBMITTED",
        entity_type="EducationalCase",
        entity_id=case.id,
        details=json.dumps({
            "case_code": case.case_code,
            "submitted_determination": submission.determination,
            "is_correct": is_correct,
            "score": score,
        }),
    )
    db.add(audit_event)
    db.commit()

    return StudentSubmissionResultResponse(
        submission_id=student_sub.id,
        case_code=case.case_code,
        submitted_determination=student_sub.submitted_determination,
        predefined_answer=case.predefined_answer,
        is_correct=is_correct,
        score_awarded=score,
        submitted_reasoning=student_sub.submitted_reasoning,
        predefined_explanation=case.predefined_explanation,
        key_learning_points=case.key_learning_points,
        feedback=feedback,
        submitted_at=student_sub.submitted_at,
    )


@router.get("/my-submissions")
def get_my_student_submissions(
    current_user: User = Depends(require_pharmacy_student),
    db: Session = Depends(get_db),
):
    """Retrieve history of student practice submissions and scores."""
    subs = (
        db.query(StudentSubmission)
        .filter_by(student_id=current_user.id)
        .order_by(StudentSubmission.submitted_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "case_id": s.case_id,
            "case_code": s.case.case_code,
            "case_title": s.case.title,
            "submitted_determination": s.submitted_determination,
            "predefined_answer": s.case.predefined_answer,
            "is_correct": s.is_correct,
            "score_awarded": s.score_awarded,
            "submitted_at": s.submitted_at,
        }
        for s in subs
    ]
