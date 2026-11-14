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
    if insp.has_table("community_consultations"):
        cons_cols = [c["name"] for c in insp.get_columns("community_consultations")]
        with engine.begin() as conn:
            if "medical_history_json" not in cons_cols:
                conn.execute(text("ALTER TABLE community_consultations ADD COLUMN medical_history_json TEXT DEFAULT '[]'"))
            if "diagnostic_tests_json" not in cons_cols:
                conn.execute(text("ALTER TABLE community_consultations ADD COLUMN diagnostic_tests_json TEXT DEFAULT '[]'"))

    if insp.has_table("community_findings"):
        existing_cols = [c["name"] for c in insp.get_columns("community_findings")]
        if "epistemic_status" not in existing_cols:
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE community_findings ADD COLUMN epistemic_status VARCHAR(30) DEFAULT 'CONFIRMED_OBJECTIVE' NOT NULL")
                )

    if insp.has_table("community_prescription_scans"):
        scan_cols = [c["name"] for c in insp.get_columns("community_prescription_scans")]
        with engine.begin() as conn:
            if "patient_name" not in scan_cols:
                conn.execute(text("ALTER TABLE community_prescription_scans ADD COLUMN patient_name VARCHAR(100)"))
            if "patient_age" not in scan_cols:
                conn.execute(text("ALTER TABLE community_prescription_scans ADD COLUMN patient_age VARCHAR(50)"))
            if "prescription_date" not in scan_cols:
                conn.execute(text("ALTER TABLE community_prescription_scans ADD COLUMN prescription_date VARCHAR(50)"))

    if insp.has_table("community_prescription_scan_items"):
        item_cols = [c["name"] for c in insp.get_columns("community_prescription_scan_items")]
        with engine.begin() as conn:
            for bool_col in [
                "is_drug_name_confirmed",
                "is_strength_confirmed",
                "is_dosage_form_confirmed",
                "is_dose_confirmed",
                "is_route_confirmed",
                "is_frequency_confirmed",
                "is_duration_confirmed",
            ]:
                if bool_col not in item_cols:
                    conn.execute(text(f"ALTER TABLE community_prescription_scan_items ADD COLUMN {bool_col} BOOLEAN DEFAULT 0 NOT NULL"))
            if "confirmed_by" not in item_cols:
                conn.execute(text("ALTER TABLE community_prescription_scan_items ADD COLUMN confirmed_by VARCHAR(100)"))
            if "confirmed_at" not in item_cols:
                conn.execute(text("ALTER TABLE community_prescription_scan_items ADD COLUMN confirmed_at TIMESTAMP"))


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
