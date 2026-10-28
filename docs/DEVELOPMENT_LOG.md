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

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*

---

## Milestone 3: Authentication and Server-Side Role-Based Authorization

**Date**: 2026-10-27  
**Objective**: Implement server-side JWT authentication, secure bcrypt verification, server-side RBAC dependencies, generic anti-enumeration login error responses, append-only audit enforcement, and high-priority override rationale protection.

### Step 1 Preflight Verification Findings
1. **Installed Versions**:
   - Python: 3.14.5 (tags/v3.14.5:5607950, May 10 2026)
   - FastAPI: 0.141.1
   - Pydantic: 2.13.4
   - SQLAlchemy: 2.1.6
   - Bcrypt: 5.0.0
   - PyJWT: 2.13.0
   - Pytest: 9.1.1
2. **Clean Virtual Environment Verification**:
   - Executed clean `python -m venv test_venv` and `pip install -r requirements.txt`. All transitive dependencies installed cleanly with exit code 0 and `pip check` confirmed zero broken requirements.
3. **Benchmark Scenarios Inspection**:
   - All 5 benchmark scenarios inspected in `app/core/seed_data.py`. Confirmed correct representation of Clean, Indication Review, Severe Penicillin Allergy, Duplicate NSAID, and Simulated Cefdinir Stock Shortage. All findings explicitly annotated as synthetic demo reference data.
4. **Audit Immutability Inspection & Remediation**:
   - Identified that `AuditEvent` previously lacked ORM update/delete rejection listeners.
   - Remediation: Attached SQLAlchemy `before_update` and `before_delete` event listeners to `AuditEvent`, raising `PermissionError` on any modification or deletion attempt. Verified by automated test `test_audit_event_immutability`.

### Features Implemented
1. **Authentication API (`/api/v1/auth`)**:
   - `POST /login`: Validates username & bcrypt password hash. Rejects non-existent users and wrong passwords with identical generic 401 error (`"Invalid username or password"`). Rejects inactive users with 403 Forbidden.
   - `GET /me`: Returns profile with server-verified roles loaded from database.
   - `POST /logout`: Records audit event. Includes transparent disclaimer that stateless JWTs expire automatically at scheduled TTL.
   - Audited logins: Records `LOGIN_SUCCESS` and `LOGIN_FAILED` without recording passwords or raw tokens.
2. **Server-Side RBAC & Route Protection**:
   - Reusable dependency factory `require_roles(*allowed_roles)` in `app/api/deps.py`.
   - Never trusts client-supplied roles; loads roles strictly from `User.roles` relation in database.
   - Configured route guards:
     - Staff Pharmacist: `/api/v1/prescriptions/queue`, `/api/v1/prescriptions/{id}/review`.
     - Chief Pharmacist: `/api/v1/oversight/escalations`, `/resolve`, `/override-ledger`, `/inventory/adjust`, `/audit-log`.
     - Pharmacy Student: `/api/v1/education/cases`, `/submit`, `/my-submissions`. Students are denied access to live clinical queues, reviews, overrides, escalations, or inventory (403 Forbidden).
3. **Mandatory High-Priority Override Rationale**:
   - Enforced at API layer in `POST /api/v1/prescriptions/{id}/review`: Overriding a prescription with any `HIGH` severity finding without a non-empty rationale is rejected with HTTP 422 Unprocessable Entity.
4. **Environment Configuration**:
   - Added `backend/.env.example` with safe development configuration defaults.

### Permission Matrix

| Workspace / Endpoint | Allowed Role(s) | Forbidden Roles (403 Forbidden) |
| :--- | :--- | :--- |
| `GET /api/v1/prescriptions/queue` | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student`, unauthenticated |
| `POST /api/v1/prescriptions/{id}/review` | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` |
| `GET /api/v1/oversight/escalations` | `chief_pharmacist` | `staff_pharmacist`, `pharmacy_student` |
| `POST /api/v1/oversight/escalations/{id}/resolve`| `chief_pharmacist` | `staff_pharmacist`, `pharmacy_student` |
| `GET /api/v1/oversight/override-ledger` | `chief_pharmacist` | `staff_pharmacist`, `pharmacy_student` |
| `POST /api/v1/oversight/inventory/adjust` | `chief_pharmacist` | `staff_pharmacist`, `pharmacy_student` |
| `GET /api/v1/oversight/audit-log` | `chief_pharmacist` | `staff_pharmacist`, `pharmacy_student` |
| `GET /api/v1/education/cases` | Authenticated users | Unauthenticated |
| `POST /api/v1/education/cases/{id}/submit` | `pharmacy_student` | Unauthenticated |

### Tests Run & Verification
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **25 passed (25 total)** in 35.86s
  - 13 new auth/RBAC tests in `tests/test_auth.py`:
    - `test_valid_login_staff_pharmacist`
    - `test_valid_login_chief_and_student`
    - `test_login_invalid_password_returns_generic_error`
    - `test_login_unknown_user_returns_identical_generic_error`
    - `test_login_inactive_user_rejected`
    - `test_missing_and_malformed_tokens`
    - `test_expired_token_rejected`
    - `test_auth_me_and_logout`
    - `test_rbac_permission_matrix`
    - `test_student_forbidden_from_prescriptions_review`
    - `test_high_priority_override_requires_written_rationale`
    - `test_student_educational_case_submission`
    - `test_audit_event_immutability`
  - 8 database model and FK tests in `tests/test_database.py` (all passed).
  - 4 health/security unit tests in `tests/test_health.py` (all passed).
- **Frontend Test Suite (`npm test`)**:
  - Result: **3 passed (3 total)** with zero regressions.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*
- Milestone 3 Commit: `a8d7a7f` — *"Milestone 3: Authentication, server-side RBAC, override rationale protection, and audit tests"*

### Known Limitations at Milestone 3
- Deterministic clinical verification engine operates on static seeded findings; dynamic multi-rule calculation pipeline to be implemented in Milestone 4.
- UI views in frontend currently show workspace preview shell; full workspace views and API client connection scheduled for Milestone 8.

---

## Milestone 4: Deterministic Clinical Verification Engine

**Date**: 2026-10-28  
**Objective**: Replace static pre-seeded findings with an autonomous, local, deterministic rule-based verification service that evaluates a prescription's actual stored data across six clinical safety categories and emits structured, traceable findings without any LLM or external API dependencies.

### Features Implemented

1. **Diagnosis–Medication Indication Service (`app/services/verification/indication.py`)**:
   - Compares prescribed medications against configured demonstration indication rules (`IndicationRule`) and patient active diagnoses (`PatientDiagnosis`).
   - Supports exact and prefix ICD-10 code matching (e.g., `I10` matches `I10.0`, `E11` matches `E11.9`).
   - Missing supporting diagnostic information is reported as `REVIEW_REQUIRED` (severity: `MODERATE`, status: `REVIEW_REQUIRED`) or `INSUFFICIENT_DATA`—never as definitive proof that the medication is inappropriate.
   - Emits explicit `CLEAN` finding (`INFO` severity) when an indication rule and active diagnosis match.

2. **Allergy & Cross-Reactivity Service (`app/services/verification/allergy.py`)**:
   - Compares patient synthetic allergies (`PatientAllergy`) against prescribed medications and configured cross-reactivity rules (`AllergyCrossReactivityRule`).
   - Detects direct ingredient/brand/class matches (e.g., Penicillin allergy vs. Amoxicillin prescription).
   - Preserves documented reaction severity (e.g., Anaphylaxis -> `HIGH` severity conflict requiring human review).
   - Emits explicit `CLEAN` finding (`RULE-ALG-CLEAN-NKDA`) when patient has no documented drug allergies.

3. **Duplicate Medication & Therapeutic Duplication Service (`app/services/verification/duplication.py`)**:
   - Detects duplicate active ingredients (identical generic name across multiple order items).
   - Detects configured therapeutic-class duplications (e.g., concurrent dual systemic NSAID therapy: Ketorolac + Ibuprofen).
   - Emits `HIGH` severity `CONFLICT_DETECTED` findings with clinical rationale on additive organ toxicity.
   - Single-item orders emit an explicit `CLEAN` finding.

4. **Drug-Drug Interaction Service (`app/services/verification/interaction.py`)**:
   - Evaluates all distinct pairs of prescribed medications against `DrugInteractionRule` reference table in both directions.
   - Accurately identifies class-to-class and medication-to-class interactions (e.g., NSAID + Anticoagulant, NSAID + NSAID).
   - Emits structured clinical effect citations and reference sources. Single items emit an explicit `CLEAN` finding.

5. **Dosage, Frequency & Daily Amount Service (`app/services/verification/dosage.py`)**:
   - Dosing frequency parser with 24-hour multiplier calculation (`parse_frequency_multiplier`) supporting Latin abbreviations (`QD`, `BID`, `TID`, `QID`), interval syntax (`Q6H`, `Q8H`, `Q12H`, `every 4 hours`), and descriptive phrases (`Once daily`, `Twice daily`).
   - Explicit unit normalization (`convert_to_mg`) supporting `mg`, `g`, `mcg`. Unconvertible/unsupported units (e.g. `puffs`, `mL`) and negative/zero doses safely produce `INSUFFICIENT_DATA` or `CONFLICT_DETECTED`.
   - Compares single dose against `max_single_dose_mg` and calculated daily dose against `min_daily_dose_mg` and `max_daily_dose_mg`. Detects sub-therapeutic dosing (`LOW` severity advisory) and overdose threshold breaches (`HIGH` severity conflict).
   - Missing reference dosage rules are flagged as `INSUFFICIENT_DATA` (severity: `MODERATE`) requiring pharmacist review.

6. **Inventory Availability Service (`app/services/verification/inventory.py`)**:
   - Evaluates requested quantity against synthetic stock (`InventoryItem`).
   - Distinguishes 4 discrete inventory states:
     - Sufficient stock (`CLEAN`, `INFO`).
     - Low stock warning (`REVIEW_REQUIRED`, `LOW`): remaining units after dispensing will be at or below reorder threshold.
     - Insufficient stock shortage (`CONFLICT_DETECTED`, `HIGH`): available on-hand units < requested quantity (demonstrated by Cefdinir in Scenario 5).
     - Unavailable matching inventory (`CONFLICT_DETECTED`, `HIGH`): no inventory record exists for the medication.

7. **Orchestrator & Determinism (`app/services/verification/engine.py`)**:
   - Unified `VerificationEngine` class executing all six checks in a fixed pipeline sequence.
   - Deterministic sort order: severity (`HIGH` -> `MODERATE` -> `LOW` -> `INFO`), status (`CONFLICT_DETECTED` -> `REVIEW_REQUIRED` -> `INSUFFICIENT_DATA` -> `CLEAN`), category, rule identifier.
   - Generates `VerificationSummary` with metrics (`total_findings`, `conflicts_count`, `review_required_count`, `clean_count`, `max_severity`, `requires_human_review`).
   - **Finding Persistence Contract**: When `persist=True`, the engine deletes only unreviewed draft findings (`review_id is None`) and inserts fresh findings. Findings attached to a `PharmacistReview` (`review_id is not None`) are permanently immutable to protect review history. Does NOT alter prescription workflow status or create review decisions.

8. **API Integration (`app/api/v1/prescriptions.py`)**:
   - `POST /api/v1/prescriptions/{prescription_id}/verify`: Protected endpoint accessible only to Staff Pharmacists and Chief Pharmacists (`require_any_pharmacist`). Students receive 403 Forbidden; unauthenticated callers receive 401 Unauthorized.
   - `GET /api/v1/prescriptions/{prescription_id}`: Detail endpoint returning patient demographics, items, and current findings.
   - Auditing: Records `PRESCRIPTION_VERIFIED` append-only audit event without logging tokens or credentials.

### Benchmark Scenario Verification Results

| Scenario | Prescribed Regimen | Patient Context | Expected Finding | Verification Engine Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scenario 1** (`RX-2026-0001`) | Lisinopril 10mg PO QD | Essential Hypertension (I10), NKDA | Routine case, all checks pass | 0 Conflicts, 0 Review Req, 6 Clean (`INFO`) | PASS |
| **Scenario 2** (`RX-2026-0002`) | Metformin 500mg PO BID | GERD (K21.9), Osteoarthritis (M19.9), no T2D diagnosis | Missing indication diagnosis | 0 Conflicts, 1 Review Req (`RULE-IND-MET-01`, `MODERATE`), 5 Clean | PASS |
| **Scenario 3** (`RX-2026-0003`) | Amoxicillin 500mg PO TID | Maxillary Sinusitis (J01.0), Penicillin Anaphylaxis | Severe allergy cross-reactivity | 1 Conflict (`RULE-ALG-PEN-01`, `HIGH`), 0 Review Req, 5 Clean | PASS |
| **Scenario 4** (`RX-2026-0004`) | Ketorolac 10mg PO Q6H + Ibuprofen 600mg PO Q8H | Acute Post-Surgical Pain (M79.7), NKDA | Dual systemic NSAID duplication | 2 Conflicts (`RULE-DUP-CLASS-NSAID` & `RULE-INT-NSAID-NSAID-01`, `HIGH`), 7 Clean | PASS |
| **Scenario 5** (`RX-2026-0005`) | Cefdinir 300mg PO BID (qty 20) + Amlodipine 5mg PO QD (qty 30) | Pneumonia (J18.9), Hypertension (I10) | Inventory stock shortage (12 on hand vs. 20 requested) | 1 Conflict (`RULE-INV-STOCK-01`, `HIGH`), 8 Clean | PASS |

### Tests Run & Verification

- **Backend Test Suite (`python -m pytest`)**:
  - Result: **47 passed (47 total)** in 28.74s
  - 22 new tests in `tests/test_verification.py`:
    - Independent unit tests for all 6 rule checkers (`test_indication_service_direct_match`, `test_indication_service_unmatched`, `test_allergy_service_anaphylaxis_conflict`, `test_duplication_service_single_med`, `test_duplication_service_dual_systemic_nsaid`, `test_interaction_service_detected`, `test_dosage_arithmetic_and_unit_conversion`, `test_dosage_service_limits`, `test_inventory_service_shortage_detected`).
    - 5 full-pipeline benchmark scenario validation tests (`test_engine_scenario_1_routine`, `test_engine_scenario_2_indication_review`, `test_engine_scenario_3_allergy_conflict`, `test_engine_scenario_4_duplicate_nsaid`, `test_engine_scenario_5_stock_shortage`).
    - Determinism, sort ordering, and idempotent findings persistence tests (`test_deterministic_output_and_ordering`, `test_idempotent_findings_persistence`, `test_preserves_historical_reviewed_findings`).
    - API endpoint RBAC, audit logging, and error handling tests (`test_verify_endpoint_staff_pharmacist`, `test_verify_endpoint_chief_pharmacist`, `test_verify_endpoint_student_forbidden`, `test_verify_endpoint_unauthenticated`, `test_verify_endpoint_nonexistent_prescription`).
  - All existing 13 auth tests, 8 database tests, and 4 health tests continue to pass with zero regressions.
- **Frontend Test Suite (`npm test`)**:
  - Result: **3 passed (3 total)** with zero regressions.

### Known Limitations at Milestone 4
- The engine uses demonstration reference rules and synthetic data; rules are illustrative and not clinically validated.
- Advanced clinical calculation parameters (e.g., patient renal function Cockcroft-Gault CrCl dosage adjustment, hepatic impairment child-pugh score, pediatric weight-based mg/kg calculations) are not implemented.
- Multi-ingredient combination products (e.g., Amoxicillin-Clavulanate) are modeled under their primary active ingredient.

