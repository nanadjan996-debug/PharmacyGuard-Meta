"""Database initialization and migration runner for PharmacyGuard."""
import sys
from app.core.database import engine, Base, SessionLocal
# Import all models to ensure metadata registration
import app.models  # noqa: F401
from app.core.seed_data import seed_database


def _ensure_schema_columns():
    """Ensure newly introduced columns exist in SQLite database idempotently."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if insp.has_table("community_findings"):
        existing_cols = [c["name"] for c in insp.get_columns("community_findings")]
        if "epistemic_status" not in existing_cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE community_findings ADD COLUMN epistemic_status VARCHAR(30) DEFAULT 'CONFIRMED_OBJECTIVE' NOT NULL")
                )


def init_database() -> dict[str, int]:
    """Create all tables and seed initial synthetic benchmark data idempotently."""
    print("Creating database tables if not present...")
    Base.metadata.create_all(bind=engine)
    _ensure_schema_columns()
    
    print("Seeding synthetic benchmark clinical and user records...")
    db = SessionLocal()
    try:
        stats = seed_database(db)
        print(f"Database initialization complete: {stats}")
        return stats
    finally:
        db.close()


if __name__ == "__main__":
    init_database()
