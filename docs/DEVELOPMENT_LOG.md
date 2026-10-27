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
