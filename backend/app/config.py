from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "PharmacyGuard"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # SQLite Database URL
    DATABASE_URL: str = "sqlite:///./pharmacyguard.db"
    
    # Security & JWT (Safe default for development / demo)
    SECRET_KEY: str = "pharmacyguard-hackathon-insecure-dev-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    
    # Disclaimer and advisory notice
    SYSTEM_DISCLAIMER: str = (
        "PharmacyGuard is a synthetic non-clinical demonstration prototype with an advisory rule-based engine. "
        "Not clinically validated. Not for medication dispensing."
    )

    # AI Provider Selection ("bedrock" or "baseten")
    AI_PROVIDER: str = "bedrock"

    # Amazon Bedrock Configuration
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_DEFAULT_REGION: str = "us-east-1"
    BEDROCK_MODEL_ID: str = "us.anthropic.claude-sonnet-4-6"
    BEDROCK_TIMEOUT_SECONDS: float = 20.0

    # Baseten Inference Configuration (Meta Muse Spark Open)
    BASETEN_API_KEY: str | None = None
    BASETEN_MODEL: str = "meta-models/muse-spark-open-1026"
    BASETEN_BASE_URL: str = "https://inference.baseten.co/v1"
    BASETEN_TIMEOUT_SECONDS: float = 14.0

    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), ".env"),
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
