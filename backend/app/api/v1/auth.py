"""Authentication API router with secure login, audit tracking, and role loading."""
import json
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.config import settings
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.models.audit import AuditEvent
from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse, LogoutResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_client_ip(request: Request) -> str | None:
    """Safely extract client IP from forward headers or request client."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.post("/login", response_model=TokenResponse)
def login(
    login_data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a user with username and password.
    Returns signed JWT access token and user profile with server-verified roles.
    Records all successful and failed login attempts in the audit log without sensitive credentials.
    """
    client_ip = get_client_ip(request)
    user = db.query(User).filter_by(username=login_data.username).first()

    # Generic rejection for unknown user or incorrect password (prevents username enumeration)
    if not user or not verify_password(login_data.password, user.hashed_password):
        audit_event = AuditEvent(
            actor_id=None,
            actor_username=login_data.username,
            actor_role="unauthenticated",
            action="LOGIN_FAILED",
            entity_type="User",
            entity_id=login_data.username,
            details=json.dumps({"reason": "invalid_credentials", "attempted_username": login_data.username}),
            ip_address=client_ip,
        )
        db.add(audit_event)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check active status
    if not user.is_active:
        audit_event = AuditEvent(
            actor_id=user.id,
            actor_username=user.username,
            actor_role="inactive",
            action="LOGIN_FAILED",
            entity_type="User",
            entity_id=user.id,
            details=json.dumps({"reason": "account_inactive"}),
            ip_address=client_ip,
        )
        db.add(audit_event)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Load roles strictly from database
    roles = [ur.role_id for ur in user.roles]

    # Create signed token
    access_token = create_access_token(
        subject=user.id,
        username=user.username,
        roles=roles,
    )

    # Record successful login in audit log (never store password or token!)
    audit_event = AuditEvent(
        actor_id=user.id,
        actor_username=user.username,
        actor_role=",".join(roles),
        action="LOGIN_SUCCESS",
        entity_type="User",
        entity_id=user.id,
        details=json.dumps({"roles": roles}),
        ip_address=client_ip,
    )
    db.add(audit_event)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            roles=roles,
            is_active=user.is_active,
        ),
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Retrieve the current authenticated user's profile and server-verified roles."""
    roles = [ur.role_id for ur in current_user.roles]
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        roles=roles,
        is_active=current_user.is_active,
    )


@router.post("/logout", response_model=LogoutResponse)
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LogoutResponse:
    """
    Log out the current user session and record audit event.
    Stateless JWT tokens expire automatically at their scheduled expiration time.
    """
    client_ip = get_client_ip(request)
    roles = [ur.role_id for ur in current_user.roles]
    audit_event = AuditEvent(
        actor_id=current_user.id,
        actor_username=current_user.username,
        actor_role=",".join(roles),
        action="LOGOUT",
        entity_type="User",
        entity_id=current_user.id,
        details=json.dumps({"message": "User initiated logout"}),
        ip_address=client_ip,
    )
    db.add(audit_event)
    db.commit()

    return LogoutResponse()
