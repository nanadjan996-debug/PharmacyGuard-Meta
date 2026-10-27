# PharmacyGuard — Engineering Development Log

**Hackathon**: Meta Global AI Developer Hackathon  
**Project**: PharmacyGuard Greenfield Rebuild  
**Repository**: Standalone Public Rebuild  
**Status**: Advisory Hospital Pharmacy Decision Support & Educational Case Prototype  

---

## Provenance & Safety Notice
- This codebase is an independent, clean greenfield rebuild implemented for the Meta Global AI Developer Hackathon.
- It does not copy, modify, or depend on any prior proprietary codebase.
- The verification engine is explicitly deterministic and rule-based. No external AI APIs, LLM calls, or ungrounded generative models are active.
- All patient profiles, diagnoses, prescriptions, and inventory records are synthetic.
- **Non-Clinical Disclaimer**: This application is an educational prototype and advisory decision-support tool. It has not been clinically validated and must never be used for real-world clinical medication dispensing or patient care.

---

## Milestone 1: Project Scaffolding & Initial Verification

**Date**: 2026-10-27  
**Objective**: Establish project architecture, directory structure, dependency definitions, test runners, and initial working full-stack scaffold for both frontend and backend.

### Features Implemented
1. **Frontend Scaffolding (`/frontend`)**:
   - Initialized React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons environment.
   - Configured dark-mode capable Tailwind design tokens with clinical slate/emerald theme.
   - Built initial root component (`App.tsx`) with non-clinical advisory banners, deterministic rule engine labels, and role workspace switcher preview (Staff Pharmacist, Chief Pharmacist, Student Mode).
   - Configured Vitest + Testing Library test runner.
2. **Backend Scaffolding (`/backend`)**:
   - Initialized Python FastAPI application with modular architecture:
     - `core/`: database configuration (SQLAlchemy 2.x SQLite engine) and security (bcrypt password hashing, PyJWT tokens).
     - `models/`: ORM entity definitions placeholder.
     - `schemas/`: Pydantic v2 schemas (`HealthCheckResponse`).
     - `api/v1/`: Versioned routing and health check endpoint.
     - `services/verification/`: Deterministic clinical rule engine package structure.
     - `reference_data/`: Demo clinical reference knowledge sets package structure.
   - Implemented system health check endpoint (`GET /api/v1/health`) returning operational status and advisory disclaimer.
   - Configured Pytest test suite with FastAPI TestClient.
3. **Repository Setup**:
   - Configured root `.gitignore` covering Python cache/virtualenvs, Node packages/build artifacts, and local SQLite databases.
   - Initialized git repository on branch `main`.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*

### Tests Run & Verification
- **Frontend Test Suite**:
  - Command: `npm test` (Vitest v3.2.7, jsdom environment)
  - Result: **3 passed (3 total)**
  - Tests verified: Application branding, non-clinical advisory banner visibility, role switcher navigation rendering.
  - Production build: `npm run build` executed and succeeded (`tsc -b && vite build` emitted cleanly to `dist/`).
- **Backend Test Suite**:
  - Command: `python -m pytest` (Pytest 9.1.1 on Python 3.14.5)
  - Result: **4 passed (4 total)** in 3.79s
  - Tests verified:
    - Root `/` info and disclaimer endpoint (`test_root_endpoint`)
    - API v1 health check endpoint (`test_health_check_endpoint`)
    - Bcrypt password hashing and salt verification (`test_password_hashing_and_verification`)
    - PyJWT access token issuance, signature, and decoding (`test_jwt_token_creation_and_decoding`)
  - Server boot: `uvicorn app.main:app` booted and verified via live HTTP GET request (`200 OK`).

### Known Limitations at Milestone 1
- Database models and persistent tables not yet initialized (scheduled for Milestone 2).
- Authentication endpoints and RBAC route guards not yet wired to database (scheduled for Milestone 3).
- Clinical rules and verification algorithms are modularized but pending implementation in Milestone 4.

---

## Milestone 2: Database Layer, ORM Models & Synthetic Benchmark Seed Data

**Date**: 2026-10-27  
**Objective**: Implement the relational database architecture, SQLAlchemy 2.x ORM models, foreign-key enforcement with SQLite, repeatable seed data generator, and verify with comprehensive automated tests.

### Dependency Verification
- **Python**: 3.14.5
- **FastAPI**: 0.141.1
- **Pydantic**: 2.13.4
- **SQLAlchemy**: 2.1.6
- **Bcrypt**: 5.0.0
- **PyJWT**: 2.13.0
- **Pytest**: 9.1.1
All dependency versions verified compatible with `requirements.txt`.

### Architecture & Database Design
- **Single Database Strategy**: Adopted unified SQLite database (`pharmacyguard.db`) with `PRAGMA foreign_keys=ON` event listener on engine connection. This guarantees relational foreign-key integrity (rejecting invalid references and enabling cascading deletions) while avoiding the limitations of cross-database transactions in SQLite.
- **Domain Models Created**:
  1. `app/models/user.py`: `User`, `Role`, `UserRole` (many-to-many role assignments).
  2. `app/models/patient.py`: `SyntheticPatient`, `PatientDiagnosis`, `PatientAllergy`.
  3. `app/models/reference.py`: `MedicationReference`, `IndicationRule`, `AllergyCrossReactivityRule`, `DrugInteractionRule`, `DosageRule`. All annotated with `is_demo_rule=True`.
  4. `app/models/prescription.py`: `Prescription`, `PrescriptionItem`.
  5. `app/models/inventory.py`: `InventoryItem`, `InventoryTransaction`. Includes computed `is_low_stock` property.
  6. `app/models/review.py`: `PharmacistReview`, `ReviewFinding`, `EscalationResolution`.
  7. `app/models/audit.py`: `AuditEvent` (append-only application event tracking).
  8. `app/models/education.py`: `EducationalCase`, `StudentSubmission` (beginner, intermediate, advanced tiers).

### Synthetic Benchmark Seed Data
Implemented idempotent seeder in `app/core/seed_data.py` providing:
- **3 Demo Users**:
  - Staff Pharmacist: `pharmacist_demo` (`StaffDemoPassword2026!`)
  - Chief Pharmacist: `chief_demo` (`ChiefDemoPassword2026!`)
  - Pharmacy Student: `student_demo` (`StudentDemoPassword2026!`)
- **8 Reference Medications & 18 Clinical Rules** (all explicitly labeled demo reference data).
- **8 Simulated Inventory Items** (including Cefdinir with low-stock state: 12 on hand vs 25 reorder threshold).
- **5 Fictional Benchmark Scenarios**:
  1. `SCENARIO_1_CLEAN`: Arthur Pendelton (Hypertension, Lisinopril 10mg). Clean finding.
  2. `SCENARIO_2_INDICATION`: Beatrice Montgomery (Metformin without documented diabetes diagnosis). Moderate indication review finding.
  3. `SCENARIO_3_ALLERGY`: Charles Vance (Severe Penicillin anaphylaxis, Amoxicillin 500mg order). High-severity allergy conflict finding.
  4. `SCENARIO_4_DUPLICATE_NSAID`: Diana Rosslyn (Concurrent Ketorolac 10mg + Ibuprofen 600mg). High-severity duplicate systemic NSAID finding.
  5. `SCENARIO_5_STOCK_SHORTAGE`: Edward Sterling (Cefdinir 300mg Qty 20, on-hand 12). High-severity stock shortage alert.
- **3 Pharmacy Student Educational Cases** across beginner, intermediate, and advanced tiers.
- **Initial Baseline Audit Record**: `SYSTEM_DATABASE_INITIALIZED`.

### Seed Idempotency & Repeatability
Running `init_database()` multiple times performs existence checks on unique keys, resulting in `0` duplicated or corrupted records on subsequent runs.

### Tests Run & Verification
- **Full Backend Test Suite**:
  - Command: `python -m pytest`
  - Result: **12 passed (12 total)** in 7.45s
  - Tests verified:
    - `test_seed_idempotency`
    - `test_roles_and_demo_users`
    - `test_five_synthetic_benchmark_scenarios`
    - `test_inventory_tracking_and_low_stock`
    - `test_educational_cases`
    - `test_foreign_key_enforcement`
    - `test_cascade_delete_integrity`
    - `test_append_only_audit_log`
    - `test_root_endpoint`
    - `test_health_check_endpoint`
    - `test_password_hashing_and_verification`
    - `test_jwt_token_creation_and_decoding`
- **Frontend Test Suite**:
  - Command: `npm test`
  - Result: **3 passed (3 total)** with zero regressions.

### Known Limitations at Milestone 2
- Authentication and token-issuance API routes not yet exposed (scheduled for Milestone 3).
- Role-based authorization middleware not yet wired to endpoint guards (scheduled for Milestone 3).
- Deterministic verification engine services operate on static findings rather than dynamic re-evaluation (scheduled for Milestone 4).
