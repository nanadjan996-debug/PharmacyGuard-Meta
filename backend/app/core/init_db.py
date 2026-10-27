"""Database initialization and migration runner for PharmacyGuard."""
import sys
from app.core.database import engine, Base, SessionLocal
# Import all models to ensure metadata registration
import app.models  # noqa: F401
from app.core.seed_data import seed_database


def init_database() -> dict[str, int]:
    """Create all tables and seed initial synthetic benchmark data idempotently."""
    print("Creating database tables if not present...")
    Base.metadata.create_all(bind=engine)
    
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
