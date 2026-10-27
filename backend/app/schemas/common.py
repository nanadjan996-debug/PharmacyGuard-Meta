from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(default="ok", description="Service health status")
    project: str = Field(default="PharmacyGuard", description="Project name")
    version: str = Field(default="0.1.0", description="API version")
    engine_type: str = Field(default="deterministic_rule_based", description="Type of verification engine")
    disclaimer: str = Field(description="Non-clinical advisory disclaimer")
