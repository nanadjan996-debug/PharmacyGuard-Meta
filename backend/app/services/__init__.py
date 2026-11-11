"""Domain and clinical rule services."""
from app.config import settings
from app.services.baseten_service import BasetenService, baseten_service
from app.services.bedrock_service import BedrockService, bedrock_service


def get_ai_service():
    """Return the active AI explanation provider service based on settings."""
    if settings.AI_PROVIDER.lower() == "bedrock":
        return bedrock_service
    return baseten_service


# Default AI service router
ai_service = get_ai_service()

__all__ = [
    "BasetenService",
    "baseten_service",
    "BedrockService",
    "bedrock_service",
    "get_ai_service",
    "ai_service",
]
