from pydantic_settings import BaseSettings, SettingsConfigDict


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

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()
