"""FastAPI dependencies for database sessions, authentication, and role-based access control."""
from typing import Callable, Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

security_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate the incoming JWT access token, ensure the user exists and is active,
    and load user roles strictly from trusted server-side database records.
    """
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or malformed access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token subject missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Trust ONLY the server-side database record for user existence, active status, and assigned roles
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """
    Role-based authorization dependency factory.
    Denies access by default (403 Forbidden) if the authenticated user does not have
    at least one of the specified server-assigned roles.
    """
    def role_verifier(current_user: User = Depends(get_current_user)) -> User:
        user_roles = {ur.role_id for ur in current_user.roles}
        if not any(role in user_roles for role in allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: action requires one of the following roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_verifier


# Reusable permission dependencies for route guards
require_staff_pharmacist = require_roles("staff_pharmacist")
require_chief_pharmacist = require_roles("chief_pharmacist")
require_pharmacy_student = require_roles("pharmacy_student")
require_any_pharmacist = require_roles("staff_pharmacist", "chief_pharmacist")
