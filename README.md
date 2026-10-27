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

## Role Workspaces

1. **Staff Pharmacist**:
   - Verification queue: pending, reviewed, overridden, escalated cases.
   - Comprehensive prescription inspection (diagnoses, allergies, medication orders).
   - Deterministic rule findings with severity, evidence, and rule source.
   - Accept, override (with mandatory written rationale for high-priority findings), or escalate.
2. **Chief Pharmacist**:
   - Escalated case resolution queue.
   - Override ledger with staff rationale.
   - Simulated inventory tracking, low-stock alerts, and manual adjustments.
   - Operational audit events and performance metrics.
3. **Pharmacy Student**:
   - Separate educational case repository across difficulty tiers.
   - Clinical determination submission and rationalization.
   - Immediate comparison with predefined benchmark answers and explanations.
   - Explicitly restricted from operational dispensing, overrides, or escalation resolutions.

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
