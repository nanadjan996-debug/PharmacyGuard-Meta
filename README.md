# PharmacyGuard — Hospital Pharmacy Decision Support Prototype

> **Non-Clinical Demonstration Prototype**: PharmacyGuard is an educational, deterministic rule-based prescription-verification and pharmacy operations prototype developed for the Meta Global AI Developer Hackathon. All patient data, clinical cases, and inventory figures are synthetic. This system has **not** been clinically validated and must **never** be used for patient care or real-world medication dispensing.

---

## Architecture Overview

PharmacyGuard is built with strict separation of concerns across presentation, API routing, business logic, deterministic rule evaluation, and persistence:

```
PharmacyGuard Meta Rebuild/
├── backend/
│   ├── app/
│   │   ├── api/             # HTTP endpoints and versioned routers (FastAPI)
│   │   ├── core/            # Database engine, session maker, JWT & bcrypt security
│   │   ├── models/          # SQLAlchemy 2.x relational ORM models
│   │   ├── schemas/         # Pydantic v2 validation contracts
│   │   ├── services/        # Verification services, workflow operations
│   │   ├── reference_data/  # Explicit demo clinical datasets (rules, interactions, dosages)
│   │   ├── config.py        # Centralized settings & non-clinical disclaimer
│   │   └── main.py          # FastAPI application factory & CORS configuration
│   ├── tests/               # Pytest suite with TestClient
│   ├── pytest.ini           # Pytest runner settings
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI controls, banners, dialogs
│   │   ├── pages/           # Role workspaces: Staff, Chief, Student
│   │   ├── context/         # Auth & role session context
│   │   ├── types/           # TypeScript data interfaces
│   │   ├── test/            # Vitest + React Testing Library setup
│   │   ├── App.tsx          # Root shell with workspace switching
│   │   └── main.tsx         # React 19 entry point
│   ├── package.json         # React 19, TypeScript, Tailwind, Lucide, Vitest
│   ├── vite.config.ts       # Vite bundler & API proxy configuration
│   └── tailwind.config.js   # Clinical color palette & dark-mode styling
├── docs/
│   └── DEVELOPMENT_LOG.md   # Chronological engineering log & provenance tracking
└── README.md
```

---

## Role Workspaces & Demo Credentials

The following synthetic demo credentials are configured for evaluation in local development:

| Role | Username | Demo Password | Purpose & Scope |
| :--- | :--- | :--- | :--- |
| **Staff Pharmacist** | `pharmacist_demo` | `StaffDemoPassword2026!` | Verification queue, clinical finding evaluation, accept/override/escalate. |
| **Chief Pharmacist** | `chief_demo` | `ChiefDemoPassword2026!` | Escalated case resolution, override audit ledger, simulated inventory control. |
| **Pharmacy Student** | `student_demo` | `StudentDemoPassword2026!` | Educational case library, clinical determination submissions, scoring. |

> **Security Note**: These passwords are bcrypt-hashed demonstration credentials intended strictly for local development and review. No production credentials or secrets exist in the repository.

---

## Database Architecture & Logical Separation Trade-off

PharmacyGuard utilizes a **single unified SQLite database** (`pharmacyguard.db`) with strict logical module separation across domain models:
- `app/models/user.py`: Users, roles, and assignments.
- `app/models/patient.py`: Synthetic patients, diagnoses, and allergies.
- `app/models/prescription.py`: Prescriptions and ordered items.
- `app/models/reference.py`: Clinical reference monographs, indication rules, allergy cross-reactivity, and drug-drug interactions.
- `app/models/inventory.py`: Inventory catalog, stock levels, and audit transactions.
- `app/models/review.py`: Pharmacist reviews, findings, and chief escalation resolutions.
- `app/models/education.py`: Student cases and determinations.
- `app/models/audit.py`: Append-only audit events.

### Single vs Multi-Database Trade-off:
- **Relational Integrity & Foreign Keys**: SQLite does not support cross-database foreign key constraints (`ATTACH DATABASE` foreign keys are not enforced). Using a single database allows native enforcement of `PRAGMA foreign_keys=ON`, preventing orphaned findings, missing item references, or invalid role assignments.
- **Transactional Consistency**: Atomic commits guarantee that whenever a prescription review or inventory adjustment is saved, the associated audit event and resolution state persist together without distributed two-phase commit overhead.
- **Logical Separation**: Clean separation is maintained at the code and schema level rather than physical file fragmentation, ensuring high testability and reliable migration.

---

## Synthetic Benchmark Scenarios

The database is seeded with five fictional benchmark cases:
1. **Scenario 1 — Clean Demo Case (`RX-2026-0001`)**: Patient Arthur Pendelton (Hypertension, `I10`) prescribed Lisinopril 10mg once daily. All demo rules evaluate clean.
2. **Scenario 2 — Indication Review Required (`RX-2026-0002`)**: Patient Beatrice Montgomery prescribed Metformin 500mg BID without a documented diagnosis of Type 2 Diabetes (`E11.x`). Triggers a moderate indication review finding.
3. **Scenario 3 — Severe Allergy Conflict (`RX-2026-0003`)**: Patient Charles Vance has a documented severe Penicillin allergy (anaphylaxis with bronchospasm) and is prescribed Amoxicillin 500mg TID. Triggers a high-severity allergy conflict finding.
4. **Scenario 4 — Duplicate Systemic NSAIDs (`RX-2026-0004`)**: Patient Diana Rosslyn is co-prescribed Ketorolac 10mg and Ibuprofen 600mg. Triggers a high-severity therapeutic duplication conflict finding.
5. **Scenario 5 — Simulated Stock Shortage (`RX-2026-0005`)**: Patient Edward Sterling prescribed Cefdinir 300mg BID (quantity 20), but current simulated inventory on hand is only 12 capsules. Triggers a high-severity stock shortage alert.

---

## Deterministic Rule Verification Engine

The verification engine operates **without generative AI or external LLM dependencies**. It relies solely on explicitly curated, documented demo reference datasets:
- **Indication review**: Validates medication necessity against patient diagnosis list.
- **Allergy & cross-reactivity**: Detects direct conflicts and cross-reactive drug classes.
- **Therapeutic duplication**: Flags concurrent active ingredients or duplicated drug classes.
- **Drug-drug interactions**: Evaluates medication pairs against a documented interaction table.
- **Dosage range checks**: Compares daily dosages against reference ranges.
- **Simulated inventory availability**: Verifies local on-hand quantities before fulfillment.

---

## Quickstart

### Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m pytest
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm test
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API requests to `http://127.0.0.1:8000`.
