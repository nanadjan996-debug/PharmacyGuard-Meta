"""Pydantic schemas for authentication and authorization."""
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50, description="Demo username (e.g., pharmacist_demo)")
    password: str = Field(..., min_length=1, max_length=100, description="User password")


class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    roles: list[str]
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserProfileResponse


class LogoutResponse(BaseModel):
    status: str = "logged_out"
    message: str = (
        "Client session terminated. Notice: Stateless JWT tokens cannot be revoked server-side without a distributed "
        "blocklist; they expire automatically at their scheduled expiration time."
    )
