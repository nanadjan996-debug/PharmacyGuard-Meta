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
  - Result: **51 passed (51 total)** in 23.17s
  - 26 tests in `tests/test_verification.py`:
    - Independent unit tests for all 6 rule checkers (`test_indication_service_direct_match`, `test_indication_service_unmatched`, `test_allergy_service_anaphylaxis_conflict`, `test_duplication_service_single_med`, `test_duplication_service_dual_systemic_nsaid`, `test_interaction_service_detected`, `test_dosage_arithmetic_and_unit_conversion`, `test_dosage_service_limits`, `test_inventory_service_shortage_detected`).
    - 5 full-pipeline benchmark scenario validation tests (`test_engine_scenario_1_routine`, `test_engine_scenario_2_indication_review`, `test_engine_scenario_3_allergy_conflict`, `test_engine_scenario_4_duplicate_nsaid`, `test_engine_scenario_5_stock_shortage`).
    - Determinism, sort ordering, and idempotent findings persistence tests (`test_deterministic_output_and_ordering`, `test_idempotent_findings_persistence`, `test_preserves_historical_reviewed_findings`).
    - API endpoint RBAC, audit logging, and error handling tests (`test_verify_endpoint_staff_pharmacist`, `test_verify_endpoint_chief_pharmacist`, `test_verify_endpoint_student_forbidden`, `test_verify_endpoint_unauthenticated`, `test_verify_endpoint_nonexistent_prescription`).
    - Focused audit verification tests (`test_audit_immutability_boundaries`, `test_sync_findings_rollback_on_failure`, `test_severity_semantics_high_conflict_never_clean`, `test_scenario_5_polypharmacy_and_inventory_integrity`).
  - All existing 13 auth tests, 8 database tests, and 4 health tests continue to pass with zero regressions.
- **Frontend Test Suite (`npm test`)**:
  - Result: **3 passed (3 total)** with zero regressions.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*
- Milestone 3 Commit: `a8d7a7f` — *"Milestone 3: Authentication, server-side RBAC, override rationale protection, and audit tests"*
- Milestone 4 Commit: `5722f72` — *"Milestone 4: Deterministic clinical verification engine, rule services, and verification API"*
- Milestone 4 Audit Verification: `4dde454` — *"Milestone 4 audit: verify immutability boundaries, transactional rollback, and benchmark integrity"*


### Known Limitations at Milestone 4
- The engine uses demonstration reference rules and synthetic data; rules are illustrative and not clinically validated.
- Advanced clinical calculation parameters (e.g., patient renal function Cockcroft-Gault CrCl dosage adjustment, hepatic impairment child-pugh score, pediatric weight-based mg/kg calculations) are not implemented.
- Multi-ingredient combination products (e.g., Amoxicillin-Clavulanate) are modeled under their primary active ingredient.

---

## Milestone 5: Review Workflow and Escalation Services

**Date**: 2026-10-29  
**Objective**: Implement and verify the backend review and escalation workflow allowing authorized staff pharmacists and chief pharmacists to act on deterministic verification findings, enforce mandatory override rationales for high-severity findings, snapshot historical findings to decisions, provide chief pharmacist escalation queues and resolutions, reject invalid state transitions and double-resolutions with HTTP 409 Conflict, and emit append-only audit events.

### Step 1: Existing Behavior Inspected & Reused
1. **Existing Models Reused**:
   - `Prescription`: status tracking (`pending`, `reviewed`, `overridden`, `escalated`, `resolved`).
   - `PharmacistReview`: review record (`reviewer_id`, `action`, `override_rationale`, `notes`, `findings` relationship).
   - `ReviewFinding`: individual findings with `review_id` foreign key linking to `PharmacistReview`.
   - `EscalationResolution`: escalation records (`escalated_by_id`, `resolved_by_id`, `escalation_reason`, `resolution_action`, `resolution_notes`, `resolved_at`).
   - `AuditEvent`: append-only audit logs with immutability enforcement.
2. **Existing Endpoints Reused & Hardened**:
   - `POST /api/v1/prescriptions/{id}/review`: Upgraded from basic draft status updates to full workflow state machine with snapshotting, fallback deterministic verification if no unreviewed findings exist, strict whitespace trimming validation, atomic rollback, and audit logging.
   - `GET /api/v1/oversight/escalations`: Upgraded to return typed `EscalationQueueItemResponse` with high-severity indicators and patient context.
   - `POST /api/v1/oversight/escalations/{prescription_id}/resolve`: Upgraded with double-resolution guards (409 Conflict), explicit state transitions, chief pharmacist attribution, atomic rollback, and audit logging.
   - `GET /api/v1/prescriptions/{id}`: Upgraded to populate review decision history and escalation records.
   - `GET /api/v1/prescriptions/{id}/reviews`: Added endpoint returning chronological decision audit history.

### Workflow State Transition Table

| Current Status | Trigger Action | Role Permitted | New Status | Side Effects & Invariants |
| :--- | :--- | :--- | :--- | :--- |
| `pending` | `ACCEPT` | Staff Pharmacist, Chief Pharmacist | `reviewed` | Unreviewed findings snapshotted to new `PharmacistReview` record. Audits `REVIEW_ACCEPT`. |
| `pending` | `OVERRIDE` | Staff Pharmacist, Chief Pharmacist | `overridden` | Requires non-empty trimmed rationale if any `HIGH` severity finding exists (HTTP 422 if omitted/blank). Findings snapshotted. Audits `REVIEW_OVERRIDE`. |
| `pending` | `ESCALATE` | Staff Pharmacist, Chief Pharmacist | `escalated` | Creates `EscalationResolution` record; appears in Chief Pharmacist queue. Findings snapshotted. Audits `REVIEW_ESCALATE`. |
| `escalated` | `APPROVED_BY_CHIEF` | Chief Pharmacist only | `reviewed` | Escalation record resolved (`resolved_at`, `resolved_by_id`, notes). Audits `ESCALATION_RESOLVED`. |
| `escalated` | `REJECTED_RETURNED_TO_PRESCRIBER` | Chief Pharmacist only | `resolved` | Escalation record resolved. Audits `ESCALATION_RESOLVED`. |
| `escalated` | `MODIFIED_AND_APPROVED` | Chief Pharmacist only | `resolved` | Escalation record resolved. Audits `ESCALATION_RESOLVED`. |
| `escalated` | Any Review Action (`ACCEPT`/`OVERRIDE`/`ESCALATE`) | Any | Rejected (409) | HTTP 409 Conflict: Cannot review an already escalated prescription. Must be resolved by Chief Pharmacist. |
| `reviewed` / `overridden` / `resolved` | Any Review Action (`ACCEPT`/`OVERRIDE`/`ESCALATE`) | Any | Rejected (409) | HTTP 409 Conflict: Prescription is already in a finalized/completed workflow state. |
| Non-`escalated` | Escalation Resolve | Chief Pharmacist | Rejected (409) | HTTP 409 Conflict: Prescription is not in 'escalated' status. |
| `escalated` (already resolved) | Escalation Resolve | Chief Pharmacist | Rejected (409) | HTTP 409 Conflict: Escalation has already been resolved. Double-resolution prevented. |

### API Endpoints & Role Permission Matrix

| Endpoint | Method | Allowed Role(s) | Forbidden Roles | Key Validations & Responses |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/prescriptions/{id}/review` | POST | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` (403), Unauthenticated (401) | Validates status is `pending` (409 on invalid status). Derives findings from trusted DB (or triggers deterministic verification if needed). Rejects blank/missing override rationale on `HIGH` findings (422). Snapshots findings. Returns `ReviewActionResponse` with non-clinical disclaimer. |
| `/api/v1/prescriptions/{id}/reviews` | GET | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` (403), Unauthenticated (401) | Returns chronological list of review decisions with reviewer name, role, action, rationale, and snapshotted finding counts (`PharmacistReviewDetail`). |
| `/api/v1/oversight/escalations` | GET | `chief_pharmacist` only | `staff_pharmacist` (403), `pharmacy_student` (403), Unauth (401) | Returns pending escalated prescriptions (`EscalationQueueItemResponse`) with patient demographics, escalation reasons, and severity badges. |
| `/api/v1/oversight/escalations/{id}/resolve` | POST | `chief_pharmacist` only | `staff_pharmacist` (403), `pharmacy_student` (403), Unauth (401) | 404 if not found; 409 if already resolved; 409 if prescription status is not `escalated`. Atomically updates escalation record, prescription status, and logs audit event. Returns `EscalationResolutionResponse`. |

### Tests Run & Verification
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **62 passed (62 total)** in 40.27s
  - 11 comprehensive tests in `tests/test_review_workflow.py`:
    - `test_review_accept_action`: Verifies `pending` -> `reviewed`, findings snapshotted, audit logged.
    - `test_review_override_with_valid_rationale`: Verifies `pending` -> `overridden` on `HIGH` severity finding with valid rationale.
    - `test_review_override_missing_or_blank_rationale_rejected`: Verifies `None`, empty string `""`, and whitespace-only `"   "` are rejected with HTTP 422.
    - `test_review_escalate_action`: Verifies `pending` -> `escalated`, escalation record created, appears in Chief queue.
    - `test_review_rbac_student_and_unauth_denied`: Verifies Pharmacy Students receive 403 Forbidden and unauthenticated callers receive 401 Unauthorized.
    - `test_escalation_queue_and_resolution_by_chief`: Verifies Chief Pharmacist resolves escalation with `APPROVED_BY_CHIEF` -> `reviewed`.
    - `test_escalation_resolution_rbac_staff_and_student_denied`: Verifies Staff Pharmacists and Students are forbidden (403) from resolving escalations.
    - `test_escalation_double_resolution_prevented`: Verifies second resolve attempt returns HTTP 409 Conflict.
    - `test_invalid_status_transitions_rejected`: Verifies reviewing an `escalated`, `reviewed`, or `overridden` prescription returns HTTP 409 Conflict.
    - `test_snapshot_findings_preserved_across_reverification`: Verifies that historical findings attached to a review decision remain immutable when prescription is re-verified.
    - `test_review_transaction_rollback_on_failure`: Verifies that if an unexpected database error occurs during review, changes roll back cleanly with zero partial writes.
  - All existing 26 verification tests, 13 auth tests, 8 database tests, and 4 health tests continue to pass with zero regressions.
- **Frontend Test Suite (`npm test --prefix frontend`)**:
  - Result: **3 passed (3 total)** in 12.64s with zero regressions.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*
- Milestone 3 Commit: `a8d7a7f` — *"Milestone 3: Authentication, server-side RBAC, override rationale protection, and audit tests"*
- Milestone 4 Commit: `5722f72` — *"Milestone 4: Deterministic clinical verification engine, rule services, and verification API"*
- Milestone 4 Audit Verification: `4dde454` — *"Milestone 4 audit: verify immutability boundaries, transactional rollback, and benchmark integrity"*
- Milestone 5 Commit: `efd76c7` — *"Milestone 5: Review workflow, escalation resolution services, and audit integration"*
- Milestone 5 Audit Remediation Commit: `718ae23` — *"Milestone 5 audit: prevent high-severity approval bypass, enforce consistent status transitions, and add atomic concurrency safeguards"*
- Milestone 5 Final Check Commit: `83e0687` — *"Milestone 5 final check: rename to APPROVED_AFTER_CLARIFICATION and verify high findings after escalation with regression test"*

---

## Milestone 5: Final Security and Workflow Audit Remediation

**Date**: 2026-10-30  
**Objective**: Resolve security, workflow consistency, and concurrency vulnerabilities identified during final inspection of Milestone 5 review and escalation services.

### Audit Discoveries & Remediations

1. **HIGH-Severity Approval Bypass Vulnerability Fixed**:
   - *Discovery*: A staff pharmacist could submit `action: "ACCEPT"` on a prescription with an active `HIGH`-severity finding (e.g. fatal penicillin anaphylaxis) without providing a clinical rationale, because rationale enforcement previously evaluated only `action == "OVERRIDE"`.
   - *Fix*: Hardened `POST /api/v1/prescriptions/{id}/review` to require a non-empty, trimmed `override_rationale` whenever any active finding is `HIGH` severity for both `ACCEPT` and `OVERRIDE` actions (HTTP 422 if blank/missing/whitespace). Derived strictly from database records (`f.review_id is None`), rendering client-side severity spoofing ineffective.
   - *Chief Approval Hardening*: Hardened `POST /api/v1/oversight/escalations/{id}/resolve` to require non-empty documented clinical rationale in `resolution_notes` (HTTP 422 if blank or whitespace-only) when Chief Pharmacist approves an escalated case involving `HIGH`-severity findings. Added Pydantic `@field_validator` on `EscalationResolutionRequest.resolution_notes` enforcing >= 5 non-whitespace characters.

2. **Workflow Status Consistency Model Established**:
   - *Discovery*: In previous draft logic, `MODIFIED_AND_APPROVED` was ambiguous because the electronic prescription entity and line items are not altered in this prototype. Conflating this with an unmodeled amendment capability was inaccurate.
   - *Clarification & Renaming*: Renamed action to `APPROVED_AFTER_CLARIFICATION`. Explicitly documented that the electronic prescription entity itself is not modified; the Chief Pharmacist reviews the case, clarifies clinical rationale with the prescriber, and approves the regimen with justification recorded in `resolution_notes`.
   - *Model Implemented*:
     - `pending`: Active in staff review queue; no decision rendered.
     - `reviewed`: Clinically approved for dispensing (standard clean acceptance, Chief `APPROVED_BY_CHIEF`, or Chief `APPROVED_AFTER_CLARIFICATION`).
     - `overridden`: Clinically approved for dispensing under documented pharmacist override rationale for detected conflicts.
     - `escalated`: Active in Chief Pharmacist oversight queue; held from dispensing.
     - `resolved`: Terminal closed state for orders rejected by Chief Pharmacist (`REJECTED_RETURNED_TO_PRESCRIBER`) and returned to prescriber without dispensing.

3. **Concurrency Safeguards & Atomic Conditional Updates**:
   - *Discovery*: Two simultaneous requests to resolve the same escalation could both read `resolved_at is None` before either committed, overwriting decisions and logging duplicate audit events (TOCTOU race condition).
   - *Fix*: Implemented database-level atomic conditional updates:
     - `EscalationResolution`: `UPDATE ... WHERE id = :id AND resolved_at IS NULL`.
     - `Prescription`: `UPDATE ... WHERE id = :id AND status = 'escalated'`.
     - If either update affects 0 rows, the transaction immediately rolls back and returns HTTP `409 Conflict`.
   - Applied identical conditional update pattern to `POST /api/v1/prescriptions/{id}/review` (`WHERE status = 'pending'`).

4. **HIGH-Severity Findings After Escalation Verified**:
   - In `resolve_escalated_case`, verified the exact database query:
     `db.query(ReviewFinding).filter(ReviewFinding.prescription_id == rx.id, ReviewFinding.severity == 'HIGH').first()`
   - Confirmed this query evaluates ALL high-severity findings for the prescription, specifically including findings already attached to the escalation review (where `review_id` is NOT NULL). Does not rely on unreviewed-finding queries.
   - Added dedicated 7-step regression test `test_chief_approval_high_severity_after_escalation_regression` confirming:
     1. High finding attached to escalation review (`review_id is not None`).
     2. Zero unreviewed high findings exist (`review_id is None` is empty).
     3. Whitespace resolution notes rejected with HTTP 422.
     4. Valid rationale succeeds with HTTP 200 and preserves rationale in escalation record.

5. **Historical Record Preservation Verified**:
   - Finding snapshots remain permanently bound to `PharmacistReview` (`f.review_id == review.id`) and are never overwritten by subsequent re-verifications.
   - Escalation records and resolution notes remain retrievable via `GET /api/v1/prescriptions/{id}`.
   - Sequential repeated requests return HTTP `409 Conflict`.
   - Append-only `AuditEvent` records are emitted for all reviews and resolutions with full user attribution.

### Tests Run & Verification
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **66 passed (66 total)** in 46.39s (100% pass rate)
  - 15 comprehensive review workflow tests in `tests/test_review_workflow.py`:
    - `test_pharmacist_accept_review` (passed)
    - `test_override_rationales_blank_missing_valid` (passed)
    - `test_high_severity_approval_bypass_prevented` (passed - verifies ACCEPT bypass prevention, whitespace rejection, and spoofed payload rejection)
    - `test_escalate_prescription_creates_traceable_escalation` (passed)
    - `test_student_and_unauthorized_review_denial` (passed)
    - `test_staff_pharmacist_forbidden_from_escalation_resolution` (passed)
    - `test_chief_pharmacist_escalation_resolution_actions` (passed - verifies `APPROVED_BY_CHIEF` -> `reviewed`, `APPROVED_AFTER_CLARIFICATION` -> `reviewed`, `REJECTED_RETURNED_TO_PRESCRIBER` -> `resolved`)
    - `test_chief_approval_high_severity_after_escalation_regression` (passed - 7-step regression test with snapshotted findings)
    - `test_cannot_resolve_escalation_twice_sequential` (passed - sequential duplicate test)
    - `test_concurrent_escalation_resolution_race_condition` (passed - multi-threaded concurrent race condition test)
    - `test_invalid_transitions_rejected` (passed)
    - `test_preserves_finding_snapshot_across_reverification` (passed)
    - `test_review_transaction_rollback_on_failure` (passed)
    - `test_escalation_resolution_rollback_on_failure` (passed)
    - `test_historical_record_preservation_and_decision_retrieval` (passed)
  - All existing 26 verification tests, 13 auth tests, 8 database tests, and 4 health tests continue to pass with zero regressions.
- **Frontend Test Suite (`npm test --prefix frontend`)**:
  - Result: **3 passed (3 total)** in 12.50s with zero regressions.

### Known Limitations at Milestone 5 Audit
- The review and escalation system is strictly an advisory decision-support prototype operating on synthetic benchmark data; it does not authorize real-world clinical medication dispensing.
- Multi-signoff or peer-review workflows (e.g. two-pharmacist verification for high-risk antineoplastic or pediatric infusions) are not modeled in this single-step review prototype.
- Real-time websocket or push notifications for escalation queues are not implemented; the Chief Pharmacist queue operates via standard HTTP GET polling.
- Database-level audit immutability is enforced via SQLAlchemy ORM event listeners (`before_update`, `before_delete`); direct raw SQL queries bypassing the ORM are not intercepted by SQLite triggers.

---

## Milestone 6: Inventory Management and Oversight APIs

**Date**: 2026-10-30  
**Objective**: Implement and verify backend inventory-management and chief-pharmacist oversight APIs using existing database models, authentication, RBAC, audit logging, and workflow conventions, with atomic stock transactions and immutable transaction tracking.

### Features Implemented

1. **Inventory Management APIs (`/api/v1/inventory`)**:
   - `GET /api/v1/inventory`:
     - Returns inventory items ordered deterministically by medication generic name and medication ID.
     - Computes live stock status (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) and boolean `is_low_stock` dynamically.
     - Supports filtering by `status` query parameter (`all`, `low_stock`, `out_of_stock`, `in_stock`) and boolean query flags `low_stock=true` and `out_of_stock=true`.
     - Accessible by Staff Pharmacists and Chief Pharmacists (`require_any_pharmacist`). Students forbidden (403), unauthenticated rejected (401).
   - `GET /api/v1/inventory/summary`:
     - Computes real-time inventory aggregation metrics: total unique items, total units on hand, out-of-stock item count, low-stock item count, adequate stock item count, and total estimated inventory valuation in cents.
     - Accessible by Staff Pharmacists and Chief Pharmacists.
   - `GET /api/v1/inventory/{medication_id}`:
     - Retrieves detailed medication inventory record by either `medication_id` (e.g., `MED-CEF-500`) or primary key UUID.
     - Returns medication clinical details, current balance, reorder threshold, lot information, expiration date, and complete chronological transaction history (`InventoryTransactionDetail`) ordered with newest first.
     - Accessible by Staff Pharmacists and Chief Pharmacists.
   - `POST /api/v1/inventory/transactions`:
     - Atomic stock mutation supporting `RESTOCK` (receipt from distributor) and `ADJUSTMENT` (shrinkage, count discrepancy, damage write-off).
     - Validates positive non-zero quantity (`gt=0`).
     - Mandates documented explanation string (`min_length=3` non-whitespace) for adjustments.
     - Enforces negative balance prevention: deductions that exceed `quantity_on_hand` are rejected with HTTP 422 Unprocessable Content, leaving balances intact.
     - Enforces atomic database commit: updates balance, inserts immutable `InventoryTransaction`, inserts append-only `AuditEvent`, and rolls back completely on any database exception.

2. **Chief Pharmacist Oversight APIs (`/api/v1/oversight`)**:
   - `GET /api/v1/oversight/dashboard`:
     - Executive clinical and operations dashboard aggregating:
       - Real-time inventory metrics (total units, low/out stock counts, valuation).
       - Inventory exceptions list with calculated unit deficits below threshold.
       - Prescription clinical workflow distribution by status and prescriber department.
       - Pending escalation queue count.
       - Ten most recent system audit log events.
     - Restricted strictly to Chief Pharmacists (`require_chief_pharmacist`). Staff Pharmacists and Students forbidden (403).
   - `GET /api/v1/oversight/inventory-exceptions`:
     - Filtered exception list returning all items in `OUT_OF_STOCK` or `LOW_STOCK` status with calculated deficit units required to reach reorder threshold.
     - Restricted strictly to Chief Pharmacists.
   - `GET /api/v1/oversight/workflow-summary`:
     - Aggregated breakdown of all prescription records by workflow status and prescriber department.
     - Restricted strictly to Chief Pharmacists.

3. **Data Integrity & ORM Immutability**:
   - Attached SQLAlchemy `before_update` and `before_delete` event listeners to `InventoryTransaction` in `backend/app/models/inventory.py`, raising `PermissionError` on any ORM modification or deletion attempt.
   - Every inventory transaction generates an associated append-only `AuditEvent` record with actor username, role, action code (`INVENTORY_RESTOCK` or `INVENTORY_ADJUSTMENT`), entity ID, and structured JSON payload.

### API Endpoints & Role Permission Matrix

| Endpoint | Method | Allowed Role(s) | Forbidden Roles | Key Validations & Logic |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/inventory` | GET | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` (403), Unauth (401) | Deterministic alphabetical ordering. Filters: `status` (`low_stock`, `out_of_stock`, `in_stock`), `low_stock=true`, `out_of_stock=true`. Computes live stock status and advisory banner. |
| `/api/v1/inventory/summary` | GET | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` (403), Unauth (401) | Computes total items, total units, out-of-stock count, low-stock count, adequate count, total valuation cents. |
| `/api/v1/inventory/{medication_id}` | GET | `staff_pharmacist`, `chief_pharmacist` | `pharmacy_student` (403), Unauth (401) | Matches on `medication_id` or `id`. Returns 404 if not found. Includes reverse-chronological transaction history. |
| `/api/v1/inventory/transactions` | POST | `RESTOCK`: `staff_pharmacist`, `chief_pharmacist`<br>`ADJUSTMENT`: `chief_pharmacist` only | `pharmacy_student` (403), Unauth (401), Staff Pharmacist on `ADJUSTMENT` (403) | Enforces positive quantity (`gt=0`), mandatory adjustment reason (422), negative stock prevention (422), atomic commit/rollback, and append-only audit event logging. |
| `/api/v1/oversight/dashboard` | GET | `chief_pharmacist` only | `staff_pharmacist` (403), `pharmacy_student` (403), Unauth (401) | Executive oversight aggregation of inventory metrics, deficits, workflow distribution, escalation count, and recent audits. |
| `/api/v1/oversight/inventory-exceptions` | GET | `chief_pharmacist` only | `staff_pharmacist` (403), `pharmacy_student` (403), Unauth (401) | Returns low-stock and out-of-stock items with calculated reorder deficit. |
| `/api/v1/oversight/workflow-summary` | GET | `chief_pharmacist` only | `staff_pharmacist` (403), `pharmacy_student` (403), Unauth (401) | Returns prescription counts grouped by status and prescriber department. |

### Tests Run & Verification

- **Inventory Test Suite (`python -m pytest backend/tests/test_inventory.py`)**:
  - Result: **15 passed (15 total)** in 15.71s
  - 15 comprehensive tests in `backend/tests/test_inventory.py`:
    - `test_inventory_listing_and_ordering`: Deterministic ordering, item fields, stock status calculation.
    - `test_inventory_low_stock_and_out_of_stock_filtering`: Query param and boolean flag filtering.
    - `test_inventory_detail_and_transaction_history`: Single item detail lookup and chronological transaction history.
    - `test_successful_stock_receipt_by_staff_pharmacist`: Staff pharmacist records restock, updates balance, creates transaction and audit event.
    - `test_successful_stock_adjustment_by_chief_pharmacist`: Chief pharmacist records adjustment with documented rationale.
    - `test_invalid_quantities_rejected`: Zero, negative, and invalid quantities rejected with HTTP 422.
    - `test_attempted_negative_stock_rejected`: Deductions exceeding balance rejected with HTTP 422; database unmodified.
    - `test_unknown_medication_or_inventory_record_rejected`: Unknown medication IDs return HTTP 404.
    - `test_missing_adjustment_explanation_rejected`: Missing, null, empty, or whitespace reasons rejected with HTTP 422.
    - `test_student_and_unauthorized_access_denial`: Students receive 403 Forbidden; unauthenticated requests receive 401 Unauthorized across all endpoints.
    - `test_staff_pharmacist_adjustment_denial_narrowest_permission`: Staff pharmacists attempting `ADJUSTMENT` receive 403 Forbidden under the narrowest safe permission principle.
    - `test_atomic_rollback_on_inventory_transaction_failure`: Simulated commit error triggers full rollback; balances and audit records remain clean.
    - `test_no_mutation_of_historical_inventory_transactions`: ORM event listener blocks `UPDATE` and `DELETE` on `InventoryTransaction`, raising `PermissionError`.
    - `test_inventory_summary_accuracy`: Verifies aggregate math across items, units, categories, and total valuation.
    - `test_chief_pharmacist_oversight_endpoints`: Verifies dashboard, inventory exceptions, and workflow summary access for Chief Pharmacists and 403 denial for Staff Pharmacists.
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **81 passed (81 total)** in 54.53s (100% pass rate)
  - Auth (13), Database (8), Health (4), Inventory (15), Review Workflow (15), Verification Engine (26).
- **Frontend Test Suite (`npm test --prefix frontend`)**:
  - Result: **3 passed (3 total)** in 13.50s with zero regressions.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*
- Milestone 3 Commit: `a8d7a7f` — *"Milestone 3: Authentication, server-side RBAC, override rationale protection, and audit tests"*
- Milestone 4 Commit: `5722f72` — *"Milestone 4: Deterministic clinical verification engine, rule services, and verification API"*
- Milestone 4 Audit Verification: `4dde454` — *"Milestone 4 audit: verify immutability boundaries, transactional rollback, and benchmark integrity"*
- Milestone 5 Commit: `efd76c7` — *"Milestone 5: Review workflow, escalation resolution services, and audit integration"*
- Milestone 5 Audit Remediation Commit: `718ae23` — *"Milestone 5 audit: prevent high-severity approval bypass, enforce consistent status transitions, and add atomic concurrency safeguards"*
- Milestone 5 Final Check Commit: `83e0687` — *"Milestone 5 final check: rename to APPROVED_AFTER_CLARIFICATION and verify high findings after escalation with regression test"*
- Milestone 6 Implementation Commit: `524383b` — *"Milestone 6: Inventory management APIs, atomic transaction tracking, and chief oversight dashboard"*

### Known Limitations at Milestone 6
- The inventory subsystem is a simulated local hospital inventory model operating on synthetic benchmark medications; it is not integrated with automated dispensing cabinets (e.g. Pyxis, Omnicell) or wholesale electronic ordering (EDI 850/855).
- Database-level immutability for inventory transactions is enforced via SQLAlchemy ORM event listeners (`before_update`, `before_delete`); raw SQL operations bypassing the ORM are not blocked by database triggers.
- Unit costs and inventory valuations are synthetic static demonstration values.
- Real-time inventory push notifications (e.g. WebSocket alerts on critical stock depletion) are not implemented; oversight screens operate via HTTP GET polling.

---

## Milestone 7: Educational Simulation Backend

**Date**: 2026-10-30  
**Objective**: Build a separate educational simulation API for pharmacy students using synthetic prescription cases and the existing deterministic verification engine, with transparent rubric-based scoring, pedagogical rule feedback, and strict operational workflow isolation.

### Features Implemented

1. **Educational Simulation APIs (`/api/v1/education`)**:
   - `GET /api/v1/education/cases`:
     - Lists synthetic educational cases available for pharmacy students (`CASE-BEG-01`, `CASE-INT-01`, `CASE-ADV-01`).
     - Returns case metadata, difficulty tiers, clinical categories, learning objectives, completion status (`COMPLETED` or `NOT_ATTEMPTED`), student attempts count, best score, and non-clinical simulation disclaimer.
     - Strictly strips answer keys (`predefined_answer`), expected explanations (`predefined_explanation`), and internal rule criteria.
     - Accessible to all authenticated users (`pharmacy_student`, `staff_pharmacist`, `chief_pharmacist`).
   - `GET /api/v1/education/cases/{case_id}`:
     - Returns full clinical scenario, patient summary, prescription summary, learning objectives, and available clinical determinations (`APPROVE`, `REJECT`, `APPROVE_WITH_MONITORING`, `OVERRIDE_WITH_RATIONALE`, `ESCALATE`).
     - Resolves by case UUID or `case_code`. Returns 404 if not found.
     - Strictly excludes hidden evaluation rubrics and answer keys.
   - `POST /api/v1/education/cases/{case_id}/submit`:
     - Accepts structured student assessment: `determination` (validated enum), `reasoning` (min 10 chars, trimmed), and optional `identified_issues`.
     - Evaluates submission against benchmark criteria using deterministic, non-AI rule evaluator.
     - Persists new immutable `StudentSubmission` attempt (never overwrites historical submissions).
     - Logs append-only `AuditEvent` (`action="STUDENT_CASE_SUBMITTED"`).
     - Returns comprehensive `StudentSubmissionResponse` with structured feedback and pedagogical rule breakdown.
   - `GET /api/v1/education/submissions`:
     - Returns authenticated student's personal submission history ordered newest first (`submitted_at DESC`).
     - Strictly enforces student ownership: students can only view their own submissions.
   - `GET /api/v1/education/submissions/{submission_id}`:
     - Returns single submission record and detailed feedback breakdown.
     - Enforces ownership: student attempting to access another student's submission receives `HTTP 403 Forbidden`.
     - Supports supervisory oversight: Chief Pharmacists are authorized to inspect student submissions for academic evaluation. Staff Pharmacists are forbidden (403).

2. **Deterministic Evaluation & Scoring Rubric (`education_evaluator.py`)**:
   - **Total Score Range**: 0 to 100 points.
   - **Determination Accuracy (Max 50 points)**:
     - Exact match with expected determination: **50 points**.
     - Partial match (`ESCALATE` when expected is `REJECT`): **25 points** (recognizes safety hazard and stops dispensing, but fails to execute required prescriber rejection).
     - Inappropriate approval of contraindicated regimen: **0 points**.
   - **Clinical Issue Identification (Max 30 points)**:
     - Evaluates `identified_issues` list and keywords in student's clinical reasoning against configured criteria.
     - Awards proportional points based on expected issues identified: e.g. 100% of issues = **30 points**; 1 of 2 issues = **15 points**; none = **0 points**.
     - Identifies correctly identified issues, missed issues, and unconfirmed issues.
   - **Clinical Reasoning Documentation Quality (Max 20 points)**:
     - < 20 characters: **5 points** (minimal/insufficient rationale).
     - 20–60 characters: **12 points** (basic rationale).
     - > 60 characters: **20 points** (thorough, substantive clinical justification).
   - **Overall Pass Condition**: `is_correct = (determination_correct and total_score >= 70)`.

3. **Pedagogical Rule Feedback**:
   - Links student findings to configured demonstration rules (`RULE-ALG-PEN-01`, `RULE-INT-NSAID-NSAID-01`, `RULE-IND-MET-01`, `RULE-DOSE-MET-01`).
   - Returns rule identifier, rule title, clinical evidence, and benchmark pharmacological rationale.
   - Extracts structured key learning points from the case monograph.
   - Bounded by explicit non-clinical disclaimer: *"Educational Simulation Boundary Notice: A passing score indicates understanding of simulated scenario concepts and must NEVER be construed as clinical validation, qualification for autonomous medication dispensing, or proof of real-world clinical competence."*

4. **Strict Isolation from Operational Workflows**:
   - Pharmacy students are forbidden (HTTP 403) from all operational prescription routes (`/prescriptions/queue`, `/prescriptions/{id}/review`, `/prescriptions/{id}/reviews`).
   - Pharmacy students are forbidden (HTTP 403) from operational inventory routes (`/inventory`, `/inventory/transactions`, `/inventory/summary`).
   - Pharmacy students are forbidden (HTTP 403) from Chief Pharmacist oversight endpoints (`/oversight/dashboard`, `/oversight/escalations`).
   - Educational submissions never modify operational prescription records, prescription findings, or inventory balances.
   - Educational case identifiers cannot be used to retrieve or review operational prescriptions (`GET /api/v1/prescriptions/CASE-BEG-01` returns 404).

5. **Data Integrity & Immutability**:
   - Attached SQLAlchemy `before_update` and `before_delete` event listeners to `StudentSubmission`, raising `PermissionError` on any modification or deletion attempt.
   - Atomic database transaction: submission insert, audit event insert, and attempt counter increment commit together or roll back cleanly on exception.

### API Endpoints & Role Permission Matrix

| Endpoint | Method | Allowed Role(s) | Forbidden Roles | Key Validations & Logic |
| :--- | :--- | :--- | :--- | :--- |
| `/api/v1/education/cases` | GET | `pharmacy_student`, `staff_pharmacist`, `chief_pharmacist` | Unauth (401) | Lists cases. Excludes answer keys and evaluation criteria. Calculates student-specific completion status, attempts count, and best score. |
| `/api/v1/education/cases/{case_id}` | GET | `pharmacy_student`, `staff_pharmacist`, `chief_pharmacist` | Unauth (401) | Returns case clinical scenarios and available determinations. Excludes answer keys. 404 if unknown case ID. |
| `/api/v1/education/cases/{case_id}/submit` | POST | `pharmacy_student`, `staff_pharmacist`, `chief_pharmacist` | Unauth (401) | Validates determination enum and reasoning min_length=10. Evaluates deterministically against rubric. Creates immutable submission and audit event. |
| `/api/v1/education/submissions` | GET | Authenticated users | Unauth (401) | Returns student's personal submission history ordered by newest first. Ownership strictly enforced. |
| `/api/v1/education/submissions/{submission_id}` | GET | Submitting Student, `chief_pharmacist` | Other Students (403), `staff_pharmacist` (403), Unauth (401) | Returns detailed submission record and evaluation breakdown. Chief Pharmacist permitted for academic oversight; non-owner students rejected with 403. |

### Tests Run & Verification

- **Educational Simulation Test Suite (`python -m pytest backend/tests/test_education.py`)**:
  - Result: **14 passed (14 total)** in 16.95s
  - 14 comprehensive tests in `backend/tests/test_education.py`:
    - `test_student_case_listing`: Verifies case metadata, completion status, attempts count, and hidden criteria exclusion.
    - `test_case_detail_access_and_hidden_criteria_protection`: Resolves by case_code and UUID; verifies answer keys are strictly hidden.
    - `test_valid_student_submission_full_score`: Verifies 100/100 score on CASE-BEG-01, demo rule linkage, and feedback structure.
    - `test_invalid_submission_validation`: Tests rejection of short reasoning (<10 chars), whitespace reasoning, invalid determinations, and unknown cases.
    - `test_partial_scoring_escalate_and_partial_issues`: Tests 25/50 determination partial credit for ESCALATE and 15/30 partial issue identification on CASE-ADV-01.
    - `test_completely_incorrect_submission`: Tests 0 determination score and low score when approving contraindicated regimen.
    - `test_duplicate_submission_behavior_and_history_preservation`: Confirms multiple submissions create new attempt records without overwriting past attempts; updates best_score.
    - `test_student_submission_history_listing`: Verifies personal attempt history listing.
    - `test_submission_ownership_enforcement_between_students`: Confirms Student B receives 403 Forbidden when attempting to view Student A's submission.
    - `test_student_access_to_operational_endpoints_denied`: Confirms students are rejected (403) from operational prescription queues, reviews, inventory, and oversight.
    - `test_educational_submission_does_not_mutate_operational_data`: Proves operational prescriptions, findings, and inventory remain completely untouched by educational submissions.
    - `test_pharmacist_access_behavior_to_education`: Confirms pharmacists can browse cases; Chief Pharmacist can inspect student submissions; Staff Pharmacists cannot.
    - `test_submission_immutability_blocks_update_and_delete`: Confirms ORM event listeners block UPDATE and DELETE on StudentSubmission.
    - `test_audit_event_logged_and_rollback_on_failure`: Verifies STUDENT_CASE_SUBMITTED audit logging and clean rollback on simulated DB error.
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **95 passed (95 total)** in 70.19s (100% pass rate)
  - Auth (13), Database (8), Education (14), Health (4), Inventory (15), Review Workflow (15), Verification Engine (26).
- **Frontend Test Suite (`npm test --prefix frontend`)**:
  - Result: **3 passed (3 total)** in 13.57s with zero regressions.

### Commits & Git Provenance
- Initial Commit: `8257101` — *"Milestone 1: Project structure, dependencies, initial scaffold, and verification tests"*
- Milestone 2 Commit: `0dbb8b6` — *"Milestone 2: Database layer, SQLAlchemy 2.x models, idempotent seed data, and relationship tests"*
- Milestone 2 Log Update: `e102978` — *"docs: Record commit hash for Milestone 2"*
- Milestone 3 Commit: `a8d7a7f` — *"Milestone 3: Authentication, server-side RBAC, override rationale protection, and audit tests"*
- Milestone 4 Commit: `5722f72` — *"Milestone 4: Deterministic clinical verification engine, rule services, and verification API"*
- Milestone 4 Audit Verification: `4dde454` — *"Milestone 4 audit: verify immutability boundaries, transactional rollback, and benchmark integrity"*
- Milestone 5 Commit: `efd76c7` — *"Milestone 5: Review workflow, escalation resolution services, and audit integration"*
- Milestone 5 Audit Remediation Commit: `718ae23` — *"Milestone 5 audit: prevent high-severity approval bypass, enforce consistent status transitions, and add atomic concurrency safeguards"*
- Milestone 5 Final Check Commit: `83e0687` — *"Milestone 5 final check: rename to APPROVED_AFTER_CLARIFICATION and verify high findings after escalation with regression test"*
- Milestone 6 Implementation Commit: `524383b` — *"Milestone 6: Inventory management APIs, atomic transaction tracking, and chief oversight dashboard"*
- Milestone 6 Log Update: `4b7aabf` — *"docs: Record commit hash and completion details for Milestone 6"*
- Milestone 7 Implementation Commit: `5f90496` — *"Milestone 7: Educational simulation backend, student assessment evaluation, and pedagogical feedback"*
- Milestone 7 Audit Remediation Commit: `c3ec5dc` — *"Milestone 7 audit remediation: Replace character-length scoring with content rubrics, case-specific alternatives, and student-only submission RBAC"*

---

## Milestone 7: Final Audit and Scoring Remediation

**Date**: 2026-10-30  
**Objective**: Replace character-length scoring with deterministic content-based rubrics, enforce case-specific acceptable determinations, and restrict educational submissions strictly to pharmacy students while preserving complete operational isolation.

### Audit Discoveries & Remediations

1. **Elimination of Character-Length Scoring**:
   - *Issue*: Previously, documentation quality awarded points based on character thresholds (<20, <60, >=60 chars), allowing rambling text to receive unearned points and penalizing concise explanations.
   - *Fix*: Replaced length-based scoring with a deterministic, content-grounded reasoning rubric. For each case, 3 specific clinical reasoning elements were configured with regex word-boundary keyword matching:
     - `CASE-BEG-01`: Structural Beta-Lactam Cross-Reactivity (7 pts), Severe Anaphylaxis / ICU History (7 pts), Absolute Contraindication & Order Rejection (6 pts).
     - `CASE-INT-01`: Dual Systemic NSAID Class Duplication (7 pts), Analgesic Ceiling Effect & Lack of Additive Benefit (7 pts), Compounded GI Bleeding or Nephrotoxicity Risks (6 pts).
     - `CASE-ADV-01`: Unconfirmed Indication / Missing Diabetes Diagnosis (7 pts), Impaired Renal Function / Stage 3b CKD (eGFR 38) (7 pts), Max 1000 mg/day Limit & Fatal Lactic Acidosis Risk (6 pts).
   - Concise responses that identify all required concepts receive full credit (20/20); long rambling responses lacking required elements receive 0 points. Partial credit is awarded transparently with element-level itemization.

2. **Case-Specific Acceptable Determinations**:
   - *Issue*: Generic fallback logic previously assumed identical alternative determination behavior across all cases.
   - *Fix*: Configured explicit case-specific determination policies:
     - `preferred_determination`: Primary action (50 pts, `PREFERRED`).
     - `acceptable_alternatives`: Explicitly configured safe alternatives with case-specific rationale (e.g. `ESCALATE` awards 25 pts, `ACCEPTABLE_ALTERNATIVE`).
     - `unsupported_determination`: Any unconfigured action (e.g. `OVERRIDE_WITH_RATIONALE` or `APPROVE` on a severe allergy) receives 0 pts and is marked `UNSUPPORTED`.
   - Feedback transparently distinguishes preferred determinations from acceptable alternatives and unsupported/unsafe actions.

3. **Restricted Educational Submissions (Student-Only RBAC)**:
   - *Issue*: `POST /api/v1/education/cases/{case_id}/submit` previously accepted any authenticated user.
   - *Fix*: Restricted submission authorization strictly to `pharmacy_student` users using `Depends(require_pharmacy_student)`.
   - Staff Pharmacists and Chief Pharmacists attempting to submit receive `HTTP 403 Forbidden`.
   - Browsing cases remains accessible to all authenticated roles.
   - Chief Pharmacists retain supervisory authority to inspect student submissions for academic review.

### Tests Run & Verification

- **Educational Simulation Test Suite (`python -m pytest backend/tests/test_education.py`)**:
  - Result: **17 passed (17 total)** in 23.34s
  - Tests verified:
    - `test_student_case_listing` (passed)
    - `test_case_detail_access_and_hidden_criteria_protection` (passed)
    - `test_short_complete_reasoning_gets_full_credit` (passed - 98 char concise response receives 20/20 pts)
    - `test_long_irrelevant_reasoning_receives_no_bonus` (passed - >300 char rambling text receives 0/20 pts)
    - `test_partial_reasoning_receives_partial_credit` (passed - identifies 1 element, misses 2; awards 7/20 pts)
    - `test_case_specific_preferred_determinations` (passed - verifies REJECT is PREFERRED for all 3 cases)
    - `test_case_specific_acceptable_alternatives` (passed - verifies ESCALATE is ACCEPTABLE_ALTERNATIVE with 25 pts)
    - `test_unsupported_alternative_receives_zero_credit` (passed - OVERRIDE_WITH_RATIONALE receives 0 pts and UNSUPPORTED)
    - `test_submission_authorization_roles` (passed - student: 200 OK; staff pharmacist: 403; chief pharmacist: 403; unauth: 401)
    - `test_invalid_submission_validation` (passed)
    - `test_duplicate_submission_behavior_and_history_preservation` (passed)
    - `test_student_submission_history_listing` (passed)
    - `test_submission_ownership_enforcement_between_students` (passed)
    - `test_student_access_to_operational_endpoints_denied` (passed)
    - `test_educational_submission_does_not_mutate_operational_data` (passed)
    - `test_pharmacist_oversight_and_immutability` (passed)
    - `test_audit_event_logged_and_rollback_on_failure` (passed)
- **Full Backend Test Suite (`python -m pytest`)**:
  - Result: **98 passed (98 total)** in 70.39s (100% pass rate)
  - Auth (13), Database (8), Education (17), Health (4), Inventory (15), Review Workflow (15), Verification Engine (26).
- **Frontend Test Suite (`npm test --prefix frontend`)**:
  - Result: **3 passed (3 total)** in 12.96s with zero regressions.

### Known Limitations at Milestone 7 Audit Remediation
- Educational evaluation uses transparent regex word-boundary keyword patterns matching configured clinical rubric elements; it does not parse free-form clinical semantics with natural language understanding models or external LLMs.
- Case-specific rubric configurations are static and defined for benchmark scenarios (`CASE-BEG-01`, `CASE-INT-01`, `CASE-ADV-01`).
- The simulation is purely an academic learning aid; scoring is not clinically validated and does not confer qualification or licensure for autonomous dispensing.

---

## Milestone 8: Complete Frontend Workstation Implementation (Stages 1–5)

**Date**: 2026-10-31 to 2026-11-01  
**Objective**: Build and verify production React 19 frontend interfaces corresponding to all backend clinical and educational contracts, with complete role-based isolation, route protection, deterministic rule triggers, inventory controls, and student evaluation workflows.

### Workstations Implemented
1. **Stage 1 — Route Protection & Session Controller**:
   - Implemented `AuthProvider` with automatic HTTP 401 eviction, local storage session persistence, and instant workspace redirect.
   - Built `AccessDeniedView` and role-restricted navigation guards preventing privilege escalation.
2. **Stage 2 — Staff Pharmacist Workstation**:
   - Built `PrescriptionQueueTable` with status filtering, multi-field search, and high-severity alert toggle.
   - Built `PrescriptionDetailPanel` rendering complete patient demographics, prescriber notes, line items, and deterministic findings.
   - Implemented `ReviewActionModal` strictly requiring non-empty pharmacist rationale for `OVERRIDE_WITH_RATIONALE` actions.
3. **Stage 3 — Chief Pharmacist Oversight & Workstation**:
   - Built `ChiefOversightDashboard` tracking inventory valuation ($2,414.40), active stock exceptions, pending escalations, and total overrides.
   - Built `EscalationResolutionModal` enforcing minimum 5-character resolution rationale.
   - Built `CentralInventoryWorkstation` with balance tracking, reorder thresholds, and stock adjustment modal preventing negative inventory balances.
4. **Stage 4 — Pharmacy Student Simulation Lab**:
   - Built `CaseCatalog` with difficulty filtering (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`) and completion status tracking.
   - Built `AssessmentStudio` strictly protecting academic integrity (hiding preferred determinations and rubrics until after submission).
   - Built `EvaluationResultsView` rendering deterministic 50/30/20 scores (Determination 50 pts, Findings 30 pts, Clinical Reasoning 20 pts).
   - Built `StudentSubmissionHistory` with chronological attempt inspection.
5. **Stage 5 — Cross-Role System Hardening**:
   - End-to-end integration tests verifying concurrent role switches, HTTP 409 conflict handling on resolved escalations, and audit log generation.

### Commits & Git Provenance
- `a5cdfc8` — *"Stage 1 verification remediation: 401 eviction, session restoration, role-based route guard, responsive layout"*
- `7e8f88f` — *"Stage 2: Staff Pharmacist prescription verification workflow"*
- `ad35c44` — *"fix(review): align OVERRIDE rationale validation with backend contract and expand test coverage"*
- `a8662bb` — *"feat(stage-3): implement Chief Pharmacist oversight, escalation resolution, and central inventory management"*
- `07a81fe` — *"fix(oversight): align WorkflowSummaryResponse contract with backend schema"*
- `22fb6e4` — *"feat(stage-4): harmonize education API client with verified FastAPI contracts (Phase 4.1)"*
- `de09604` — *"feat(stage-4): implement student Case Catalog and Assessment Studio (Prompt 1)"*
- `cb3a2ef` — *"feat(stage-4): implement Evaluation Results and Student Submission History (Prompt 2)"*
- `5183440` — *"feat(stage-4): integrate student simulation workspace and complete verification"*
- `02995a8` — *"chore(stage-5): harden system and complete final verification"*

---

## Milestone 9: Meta Muse Spark Open AI Copilot Integration (Stages 6 & 6.1)

**Date**: 2026-11-01 to 2026-11-02  
**Objective**: Integrate Meta's frontier model **Muse Spark Open** (`meta-models/muse-spark-open-1026`) via Baseten inference API into the Staff Pharmacist workflow with deterministic primacy and robust safety guardrails.

### Safety Boundaries & Implementation
1. **Deterministic Rule Engine Primacy**:
   - Deterministic verification runs before AI invocation. AI receives structured findings and provides clinical context, pharmacological mechanisms, and clinical uncertainties.
   - AI is strictly prohibited from approving prescriptions, authorizing dispensing, or changing rule severities.
2. **Anti-Approval Safety Screen**:
   - Backend output validation checks responses for autonomous approval language. If the model attempts to authorize dispensing, the response is rejected (`ai_status="rejected"`).
3. **Bounded 14.0s Inference Timeout**:
   - Configured an explicit 14.0-second safety timeout (`BASETEN_TIMEOUT_SECONDS=14.0`). If Baseten inference exceeds 14 seconds, the system returns a safe timeout fallback (`ai_status="timeout"`), leaving deterministic safety findings 100% operational.
4. **Persistent Non-Authoritative Disclaimer**:
   - All AI clinical responses display a clear, persistent clinical advisory disclaimer.
5. **Live Baseten Integration (Stage 6.1)**:
   - Configured official hackathon model routing to `meta-models/muse-spark-open-1026` via `https://inference.baseten.co/v1`.
   - Verified live responses on test scenarios with structured clinical context, uncertainties, and review considerations.

### Commits & Git Provenance
- `3d64fb9` — *"feat(stage-6): integrate Meta Muse Spark Open through Baseten"*
- `b89b881` — *"fix(stage-6.1): resolve Baseten hackathon model routing and response parsing"*
- `de51409` — *"docs: update README with hackathon architecture, Meta AI integration, and test suite summary"*
- `e682557` — *"style(branding): integrate official shield logo and visual identity"*

---

## Milestone 10: Multi-Stage Containerization & Render Cloud Deployment

**Date**: 2026-11-02  
**Objective**: Build a production-grade multi-stage Docker container that builds the Vite React frontend and embeds it directly into FastAPI's static asset mounting, allowing single-port cloud deployment on Render without disrupting existing services.

### Architecture & Deployment
1. **Multi-Stage Dockerfile**:
   - Stage 1 (Node 20): Installs frontend dependencies and executes `tsc -b && vite build`, outputting compiled assets to `/app/frontend/dist`.
   - Stage 2 (Python 3.11-slim): Installs backend requirements, copies backend application code, and copies `/frontend/dist` directly into the web application directory.
2. **Unified Static Asset & Catch-All Routing**:
   - Mounted `/assets` directly to `frontend/dist/assets`.
   - Added a SPA catch-all fallback route serving `frontend/dist/index.html` for any client-side routes (`/`, `?workspace=chief`, etc.), while preserving `/api/v1/*` routes.
3. **Cloud Infrastructure on Render**:
   - Service Name: `PharmacyGuard-Meta`
   - Runtime: Docker
   - GitHub Repository: `https://github.com/nanadjan996-debug/PharmacyGuard-Meta`
   - Live URL: `https://pharmacyguard-meta.onrender.com`
   - Configured Environment Variables:
     - `BASETEN_API_KEY`: Configured production inference token
     - `BASETEN_MODEL`: `meta-models/muse-spark-open-1026`
     - `BASETEN_BASE_URL`: `https://inference.baseten.co/v1`
     - `BASETEN_TIMEOUT_SECONDS`: `14.0`
4. **Live Cloud Endpoint Verification**:
   - `GET https://pharmacyguard-meta.onrender.com/api/v1/health` -> `HTTP 200 OK`
   - `POST https://pharmacyguard-meta.onrender.com/api/v1/auth/login` -> `HTTP 200 OK` (JWT issued)
   - `GET https://pharmacyguard-meta.onrender.com/api/v1/prescriptions/queue` -> `HTTP 200 OK` (5 seeded scenarios)
   - `POST https://pharmacyguard-meta.onrender.com/api/v1/prescriptions/rx-synth-001/ai-explanation` -> `HTTP 200 OK` (Live Meta Muse Spark Open response)

### Commits & Git Provenance
- `cd66385` — *"feat(deploy): configure unified multi-stage Dockerfile and cloud deployment configs"*
- `fdaf878` — *"chore: clean up file line endings"*
- `cdfcd73` — *"chore: merge remote license"*

---

## Milestone 11: Clinical Workstation Ergonomics & Cognitive Load Overhaul

**Date**: 2026-11-02  
**Objective**: Redesign the UI across all 4 workflows (Staff Pharmacist, Chief Pharmacist, Student Simulation, and Global Advisory/Login) to eliminate "AI-generated" visual noise and prevent pharmacist alert fatigue, while strictly preserving 100% of clinical data fields.

### Ergonomic Improvements
1. **Preservation of All Clinical Data**:
   - Zero patient demographics, MRNs, dosages, routes, instructions, prescriber notes, or safety findings were omitted or collapsed behind hidden tabs.
2. **Staff Pharmacist Two-Column Review Layout**:
   - Left Column (7/12 width): Prescribed medication items table + Deterministic verification findings with severity badges + Audit trail.
   - Right Column (5/12 width): Sticky **Meta Muse Spark Open** AI Copilot card.
   - Result: Pharmacists can cross-examine order line items on the left against the AI's clinical synthesis on the right without endless vertical scrolling.
3. **Hospital Station Status Bar**:
   - Replaced loud developer test panels with an executive hospital station strip (`● Station Online`, `Safety Engine: Deterministic Active`, `Meta AI: Muse Spark Open`).
4. **Chief Pharmacist Executive Restyling**:
   - Converted harsh pitch-black containers into soft medical cards with clear metric indicators and direct navigation shortcuts.
5. **Student Simulation Lab Clean Hierarchy**:
   - Professional simulation catalog with difficulty badges, learning objectives, and completion status.
6. **Automated Verification**:
   - Frontend Vitest suite: **114 / 114 tests passed** across all 9 test suites.
   - Production Vite build: Compiled cleanly in 32s with zero TypeScript warnings.

### Commits & Git Provenance
- `d751e3c` — *"style(ui): elevate clinical workstation ergonomics, reduce cognitive noise, and refine visual hierarchy across all roles"*

---

## Milestone 12: Future Clinical Grounding Specification — Population-Specific Pharmacogenomics & Domain-Constrained Medical RAG

**Date**: 2026-11-02  
**Objective**: Formulate architectural and clinical specifications requiring future clinical releases of PharmacyGuard to ground the AI in curated, evidence-based medical compendiums and demographic-adjusted guidelines to prevent dangerous population-specific treatment errors.

### Clinical Background & Problem Statement
Generic frontier LLMs trained on uncurated corpora pose acute patient safety hazards if applied unconstrained to clinical pharmacotherapy:
1. **Hypertension in Patients of African Descent**:
   - Major clinical guidelines (ACC/AHA, JNC-8, British Hypertension Society, Pan-African Society of Cardiology) demonstrate that Black patients have lower circulating plasma renin levels.
   - Calcium channel blockers (CCBs, e.g., Amlodipine) or thiazide/thiazide-like diuretics are the recommended first-line monotherapy.
   - Monotherapy with ACE inhibitors (e.g., Lisinopril) or ARBs produces significantly lower blood pressure reduction and carries a **3- to 4-fold higher incidence of life-threatening angioedema**.
   - An ungrounded AI might recommend standard ACE inhibitor titration without recognizing demographic contraindications or failure of monotherapy efficacy.
2. **Pharmacogenomic & Enzymatic Variations**:
   - **G6PD Deficiency**: Highest prevalence in individuals of African, Mediterranean, and Southeast Asian ancestry. Exposure to oxidant medications (e.g., Rasburicase, Dapsone, Primaquine, Nitrofurantoin) precipitates acute hemolytic anemia.
   - **CYP Polymorphisms**: High prevalence of CYP2C19 loss-of-function alleles (*2, *3) in specific ethnic groups compromises Clopidogrel (Plavix) bioactivation, requiring alternative P2Y12 inhibitors (Ticagrelor, Prasugrel).
3. **Sickle Cell Disease / Trait Considerations**:
   - High prevalence in populations of sub-Saharan African descent; acute pain crises require distinct multimodal analgesia while avoiding nephrotoxic NSAID escalation in patients with underlying sickle cell nephropathy.

### Architectural Solution: Domain-Constrained Medical RAG
Future clinical releases of PharmacyGuard will implement a four-pillar safety architecture:
1. **Vetted Clinical Guideline Compendium**:
   - Clinical Pharmacogenetics Implementation Consortium (CPIC) Guidelines.
   - WHO Essential Medicines & Regional Treatment Guidelines.
   - ACC/AHA Population-Specific Hypertension & Cardiovascular Recommendations.
   - South African Heart Association & Pan-African Society of Cardiology Guidelines.
2. **Demographic & Pharmacogenomic Pre-Inference Validation**:
   - Patient profiles will include structured demographic and pharmacogenomic data fields (`ancestry_demographic`, `g6pd_status`, `cyp2c19_genotype`).
   - The inference engine dynamically injects mandatory population-specific retrieval constraints before the model generates clinical commentary.
3. **Strict Guideline Lineage & Citation Check**:
   - The model must cite the exact clinical guideline document, section, and publication year.
   - If a treatment recommendation conflicts with population-specific guidelines, the deterministic safety engine immediately triggers a **HIGH SEVERITY POPULATION PHARMACOTHERAPY ALERT** and flags the prescription for mandatory human pharmacist review.
4. **Reference Document**: Detailed implementation specification published in `docs/CLINICAL_POPULATION_GUIDANCE_SPEC.md`.

---

## Milestone 11: Alert-Prioritized Cognitive Ergonomics & Alert Fatigue Mitigation in AI Panel

- **Date**: 2026-11-04  
- **Commit**: `247aa11` — *"feat(ui): prioritize actionable clinical alerts and collapse clean findings in AI panel to eliminate cognitive clutter"*  
- **Objective**: Mitigate hospital pharmacist alert fatigue and eliminate visual duplication between deterministic checklist findings and Meta Muse Spark Open AI synthesis.

### Clinical & Ergonomic Rationale
In high-volume hospital pharmacy verification workflows, incoming orders routinely have several rules that evaluate as completely clean (e.g., single-agent orders with no drug-drug interaction, no therapeutic duplication, standard indication match, dose within normal bounds, and sufficient pharmacy stock).

Previously, the AI Explanation panel mirrored every single deterministic rule sequentially under `Finding Interpretations (6)`. This created two clinical problems:
1. **Cognitive Redundancy**: The right-column AI card repeated the exact same 5 clean checks that were already clearly displayed in the left-column deterministic table.
2. **Alert Displacement**: The 5 redundant clean cards occupied excessive vertical space, pushing critical actionable recommendations (e.g., the review considerations suggesting Azithromycin as a non-beta-lactam alternative) below the browser fold, forcing clinicians to scroll past non-actionable data.

### Architectural & UI Implementation
In [`frontend/src/components/prescriptions/AIExplanationSection.tsx`](../frontend/src/components/prescriptions/AIExplanationSection.tsx):
1. **Dynamic Finding Segmentation**:
   - `alertFindings`: Extracted all findings with `HIGH`, `WARNING`, or `MEDIUM` severity requiring pharmacist intervention.
   - `cleanFindings`: Extracted all routine `INFO` and `LOW` findings that passed without clinical conflict.
2. **Prominent Alert Presentation**:
   - Active clinical alerts (e.g., `RULE-ALG-PEN-01` for Penicillin/Amoxicillin cross-reactivity) are rendered immediately at the top with distinct severity badges and high-visibility borders under an actionable header: *`Actionable Clinical Alerts (N) — Pharmacist Review Required`*.
3. **Collapsible Clean Summary Bar**:
   - Routine clean checks are grouped into a compact, single-line bar:  
     *`✓ N Routine Safety Checks Verified Clean (No Conflicts) [Show Details / Hide]`*.
   - When toggled, clean findings smoothly expand with an emerald accent indicator, preserving complete auditability without cluttering the primary review surface.
4. **Immediate Visibility of Actionable Recommendations**:
   - The *Clinical Uncertainties & Missing Data* and *Review Considerations for Pharmacist* cards now sit directly below the active alert, allowing pharmacists to immediately see recommended therapeutic alternatives without vertical scrolling.

### Automated Test & Build Verification
- **Backend Pytest Suite**: 114 passed, 0 failed in 135.38s.
- **Frontend Vitest Suite**: 115 passed, 0 failed across all 9 test suites in 65.11s.
- **Total Passing Tests**: 229 passing tests with 0 failures.
- **Production Build**: Clean compilation (`tsc -b && vite build`) in 31.52s.
- **Live Deployment**: Live on Render (`pharmacyguard-meta.onrender.com`).








