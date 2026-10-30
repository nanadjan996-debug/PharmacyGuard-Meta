"""Main API v1 router consolidating all modular endpoints."""
from fastapi import APIRouter
from app.config import settings
from app.schemas.common import HealthCheckResponse
from app.api.v1.auth import router as auth_router
from app.api.v1.prescriptions import router as prescriptions_router
from app.api.v1.oversight import router as oversight_router
from app.api.v1.education import router as education_router
from app.api.v1.inventory import router as inventory_router

api_router = APIRouter()

# Health check
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

# Mount feature routers
api_router.include_router(auth_router)
api_router.include_router(prescriptions_router)
api_router.include_router(oversight_router)
api_router.include_router(education_router)
api_router.include_router(inventory_router)
