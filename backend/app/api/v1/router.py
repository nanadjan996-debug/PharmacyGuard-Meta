from fastapi import APIRouter
from app.config import settings
from app.schemas.common import HealthCheckResponse

api_router = APIRouter()


@api_router.get("/health", response_model=HealthCheckResponse, tags=["Health"])
def health_check() -> HealthCheckResponse:
    """Return system health status and non-clinical advisory disclaimer."""
    return HealthCheckResponse(
        status="ok",
        project=settings.PROJECT_NAME,
        version=settings.VERSION,
        engine_type="deterministic_rule_based",
        disclaimer=settings.SYSTEM_DISCLAIMER,
    )
