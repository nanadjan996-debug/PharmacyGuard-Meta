"""Educational simulation and pharmacy student case evaluation API endpoints."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_pharmacy_student
from app.models.user import User
from app.models.education import EducationalCase, StudentSubmission
from app.models.audit import AuditEvent
from app.schemas.education import (
    EducationalCaseListItem,
    EducationalCaseDetailResponse,
    StudentSubmissionRequest,
    StudentSubmissionResponse,
    StudentSubmissionListItem,
    DetailedFeedback,
    EDUCATIONAL_DISCLAIMER,
)
from app.services.education_evaluator import (
    EducationalEvaluator,
    get_case_learning_objectives,
)

router = APIRouter(prefix="/education", tags=["Educational Simulation & Student Cases"])


def get_client_ip(request: Request) -> str | None:
    """Safely extract client IP from forward headers or request client."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.get("/cases", response_model=list[EducationalCaseListItem])
def list_educational_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[EducationalCaseListItem]:
    """
    List synthetic educational cases available for student review.
    Hidden answer keys, expected findings, and evaluation criteria are strictly stripped.
    """
    cases = db.query(EducationalCase).order_by(EducationalCase.case_code.asc()).all()
    user_roles = {ur.role_id for ur in current_user.roles}

    results = []
    for c in cases:
        # Check attempts by current user
        user_submissions = (
            db.query(StudentSubmission)
            .filter_by(case_id=c.id, student_id=current_user.id)
            .order_by(StudentSubmission.submitted_at.desc())
            .all()
        )
        attempts_count = len(user_submissions)
        is_completed = attempts_count > 0
        completion_status = "COMPLETED" if is_completed else "NOT_ATTEMPTED"
        best_score = max((s.score_awarded for s in user_submissions), default=None)

        results.append(
            EducationalCaseListItem(
                id=c.id,
                case_code=c.case_code,
                title=c.title,
                difficulty=c.difficulty,
                category=c.category,
                learning_objectives=get_case_learning_objectives(c),
                completion_status=completion_status,
                is_completed=is_completed,
                attempts_count=attempts_count,
                best_score=best_score,
                disclaimer=EDUCATIONAL_DISCLAIMER,
            )
        )

    return results


@router.get("/cases/{case_id}", response_model=EducationalCaseDetailResponse)
def get_educational_case_detail(
    case_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EducationalCaseDetailResponse:
    """
    Retrieve clinical scenario and details for an educational case.
    Strictly excludes predefined answers, expected determinations, and hidden grading rubrics.
    """
    case = (
        db.query(EducationalCase)
        .filter((EducationalCase.id == case_id) | (EducationalCase.case_code == case_id))
        .first()
    )
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Educational case '{case_id}' not found in simulation catalog.",
        )

    user_submissions_count = (
        db.query(StudentSubmission)
        .filter_by(case_id=case.id, student_id=current_user.id)
        .count()
    )

    return EducationalCaseDetailResponse(
        id=case.id,
        case_code=case.case_code,
        title=case.title,
        difficulty=case.difficulty,
        category=case.category,
        patient_summary=case.patient_summary,
        prescription_summary=case.prescription_summary,
        clinical_scenario=case.clinical_scenario,
        learning_objectives=get_case_learning_objectives(case),
        available_determinations=[
            "APPROVE",
            "REJECT",
            "APPROVE_WITH_MONITORING",
            "OVERRIDE_WITH_RATIONALE",
            "ESCALATE",
        ],
        is_completed=user_submissions_count > 0,
        attempts_count=user_submissions_count,
        disclaimer=EDUCATIONAL_DISCLAIMER,
    )


@router.post("/cases/{case_id}/submit", response_model=StudentSubmissionResponse)
def submit_case_assessment(
    case_id: str,
    submission_req: StudentSubmissionRequest,
    request: Request,
    current_user: User = Depends(require_pharmacy_student),
    db: Session = Depends(get_db),
) -> StudentSubmissionResponse:
    """
    Submit a structured clinical assessment for an educational case.
    Evaluates determination, issue identification, and reasoning using deterministic simulation criteria.
    Preserves all submission attempts; never overwrites historical academic records.
    """
    case = (
        db.query(EducationalCase)
        .filter((EducationalCase.id == case_id) | (EducationalCase.case_code == case_id))
        .first()
    )
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Educational case '{case_id}' not found in simulation catalog.",
        )

    # 1. Deterministic evaluation against benchmark criteria
    feedback_obj: DetailedFeedback = EducationalEvaluator.evaluate(case, submission_req)

    # 2. Track attempt number
    prior_attempts = (
        db.query(StudentSubmission)
        .filter_by(case_id=case.id, student_id=current_user.id)
        .count()
    )
    attempt_number = prior_attempts + 1

    client_ip = get_client_ip(request)
    roles = [ur.role_id for ur in current_user.roles]

    # 3. Create persistent, immutable student submission record
    submission_record = StudentSubmission(
        case_id=case.id,
        student_id=current_user.id,
        submitted_determination=submission_req.determination,
        submitted_reasoning=submission_req.reasoning,
        is_correct=feedback_obj.is_correct,
        score_awarded=feedback_obj.total_score,
        feedback=feedback_obj.model_dump_json(),
    )

    # 4. Append-only audit logging for educational submission
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role=",".join(roles),
        action="STUDENT_CASE_SUBMITTED",
        entity_type="EducationalCase",
        entity_id=case.id,
        details=json.dumps(
            {
                "case_code": case.case_code,
                "attempt_number": attempt_number,
                "score_awarded": feedback_obj.total_score,
                "is_correct": feedback_obj.is_correct,
                "determination": submission_req.determination,
            }
        ),
        ip_address=client_ip,
    )

    try:
        db.add(submission_record)
        db.add(audit_event)
        db.commit()
        db.refresh(submission_record)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record student submission: {str(e)}",
        )

    return StudentSubmissionResponse(
        id=submission_record.id,
        case_id=case.id,
        case_code=case.case_code,
        case_title=case.title,
        student_id=current_user.id,
        student_name=current_user.full_name,
        submitted_determination=submission_record.submitted_determination,
        submitted_reasoning=submission_record.submitted_reasoning,
        is_correct=submission_record.is_correct,
        score_awarded=submission_record.score_awarded,
        predefined_explanation=case.predefined_explanation,
        feedback=feedback_obj,
        submitted_at=submission_record.submitted_at,
        attempt_number=attempt_number,
        disclaimer=EDUCATIONAL_DISCLAIMER,
    )


@router.get("/submissions", response_model=list[StudentSubmissionListItem])
def list_student_submissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StudentSubmissionListItem]:
    """
    Retrieve authenticated student's own submission history.
    Students can only view their own submissions; ownership is strictly enforced.
    """
    submissions = (
        db.query(StudentSubmission)
        .filter_by(student_id=current_user.id)
        .order_by(StudentSubmission.submitted_at.desc())
        .all()
    )

    # Calculate attempt numbers per case in chronological order
    all_student_subs = (
        db.query(StudentSubmission)
        .filter_by(student_id=current_user.id)
        .order_by(StudentSubmission.submitted_at.asc())
        .all()
    )
    attempt_map: dict[str, int] = {}
    attempt_by_sub_id: dict[str, int] = {}
    for s in all_student_subs:
        attempt_map[s.case_id] = attempt_map.get(s.case_id, 0) + 1
        attempt_by_sub_id[s.id] = attempt_map[s.case_id]

    items = []
    for s in submissions:
        items.append(
            StudentSubmissionListItem(
                id=s.id,
                case_id=s.case_id,
                case_code=s.case.case_code,
                case_title=s.case.title,
                difficulty=s.case.difficulty,
                category=s.case.category,
                submitted_determination=s.submitted_determination,
                is_correct=s.is_correct,
                score_awarded=s.score_awarded,
                submitted_at=s.submitted_at,
                attempt_number=attempt_by_sub_id.get(s.id, 1),
            )
        )

    return items


@router.get("/submissions/{submission_id}", response_model=StudentSubmissionResponse)
def get_submission_detail(
    submission_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudentSubmissionResponse:
    """
    Retrieve single submission record and its detailed feedback.
    Enforces ownership: a student cannot access another student's submission.
    Chief Pharmacists may access for supervisory academic review.
    """
    submission = db.query(StudentSubmission).filter_by(id=submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission '{submission_id}' not found.",
        )

    user_roles = {ur.role_id for ur in current_user.roles}
    is_owner = submission.student_id == current_user.id
    is_chief_supervisor = "chief_pharmacist" in user_roles

    if not is_owner and not is_chief_supervisor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: students can only access their own submissions.",
        )

    # Calculate attempt number
    prior_subs = (
        db.query(StudentSubmission)
        .filter(
            StudentSubmission.case_id == submission.case_id,
            StudentSubmission.student_id == submission.student_id,
            StudentSubmission.submitted_at <= submission.submitted_at,
        )
        .count()
    )

    try:
        feedback_dict = json.loads(submission.feedback)
        feedback_obj = DetailedFeedback(**feedback_dict)
    except Exception:
        # Fallback if feedback is plain text
        feedback_obj = DetailedFeedback(
            determination_status="PREFERRED" if submission.is_correct else "UNSUPPORTED",
            preferred_determination=submission.case.predefined_answer,
            acceptable_alternatives=[],
            determination_correct=submission.is_correct,
            determination_feedback=submission.feedback,
            expected_determination=submission.case.predefined_answer,
            determination_score=50 if submission.is_correct else 0,
            issue_identification_score=0,
            correctly_identified_reasoning_elements=[],
            missed_reasoning_elements=[],
            reasoning_feedback="",
            reasoning_score=0,
            total_score=submission.score_awarded,
            is_correct=submission.is_correct,
            clinical_rationale=submission.case.predefined_explanation,
            key_learning_points=[],
            educational_limitations="",
            disclaimer=EDUCATIONAL_DISCLAIMER,
        )

    return StudentSubmissionResponse(
        id=submission.id,
        case_id=submission.case.id,
        case_code=submission.case.case_code,
        case_title=submission.case.title,
        student_id=submission.student.id,
        student_name=submission.student.full_name,
        submitted_determination=submission.submitted_determination,
        submitted_reasoning=submission.submitted_reasoning,
        is_correct=submission.is_correct,
        score_awarded=submission.score_awarded,
        predefined_explanation=submission.case.predefined_explanation,
        feedback=feedback_obj,
        submitted_at=submission.submitted_at,
        attempt_number=max(1, prior_subs),
        disclaimer=EDUCATIONAL_DISCLAIMER,
    )
