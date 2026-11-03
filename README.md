# PharmacyGuard — Clinical Pharmacy Decision Support & Simulation

> **Meta Global AI Developer Hackathon Submission**  
> *Track: Build for Your World / Healthcare & Clinical Systems*  
> *Powered by Meta Muse Spark Open (`meta-models/muse-spark-open-1026`) via Baseten Hosted Inference*  
> 
> **Live Production Deployment:** [https://pharmacyguard-meta.onrender.com](https://pharmacyguard-meta.onrender.com)  
> **Source Repository:** [https://github.com/nanadjan996-debug/PharmacyGuard-Meta](https://github.com/nanadjan996-debug/PharmacyGuard-Meta)  
> 
> **Non-Clinical Demonstration Prototype**: PharmacyGuard is an educational and operational pharmacy decision-support prototype. All patient data, clinical cases, and inventory figures are synthetic. This system has **not** been clinically validated and must **never** be used for real-world patient care or medication dispensing.

---

## Executive Summary

Hospital pharmacies process hundreds of complex prescriptions daily under severe time constraints. Standard pharmacy information systems produce alert fatigue through blunt, binary pop-ups, while naive generative AI systems introduce dangerous hallucinations and liability risks.

**PharmacyGuard** solves this with a **Dual Safety Boundary** architecture:
1. **Authoritative Deterministic Engine:** Hard clinical safety rules (IgE allergy cross-reactivity, pharmacokinetic drug interactions, daily dosage limits, therapeutic duplication, and real-time inventory shortage) are evaluated strictly deterministically with zero LLM dependence.
2. **Non-Authoritative AI Clinical Synthesis:** Meta's **Muse Spark Open** frontier model (hosted via Baseten inference) interprets structured clinical alert codes into natural-language clinical context, mechanistic rationales, clinical uncertainties, and review considerations for the human pharmacist.
3. **Licensed Pharmacist Primacy:** AI is strictly prohibited from approving prescriptions, authorizing dispensing, or altering finding severities. Pharmacist override of high-severity alerts requires mandatory written rationale, committed to an append-only immutable audit ledger.
4. **Patient Confidentiality & Zero-PHI Pipeline (HIPAA Safe):** To protect patient confidentiality, patient names, medical record numbers (MRNs), dates of birth, and direct personal identifiers are strictly excluded and redacted from all AI payloads. Meta Muse Spark Open receives only de-identified clinical parameters (age in years, weight, active allergies, condition codes, and prescribed medications). The AI never receives, processes, or outputs patient names.

---

## Live Cloud Deployment Architecture

PharmacyGuard is deployed live on **Render** using a unified multi-stage Docker container architecture:

* **Production URL:** [https://pharmacyguard-meta.onrender.com](https://pharmacyguard-meta.onrender.com)
* **Single-Port Unified Service:**
  * **Build Stage (Node 20):** Compiles the React 19 + TypeScript + Tailwind CSS frontend (`tsc -b && vite build`).
  * **Runtime Stage (Python 3.11-slim):** Fast, lightweight production container running FastAPI backend on Uvicorn, serving API routes at `/api/v1/*` while embedding frontend static assets (`/assets`) and a client-side SPA fallback under port 8000.
* **Baseten Serverless Inference:** Connects securely to Meta Muse Spark Open via environment variable configuration (`BASETEN_API_KEY`, `BASETEN_MODEL=meta-models/muse-spark-open-1026`, `BASETEN_BASE_URL=https://inference.baseten.co/v1`, `BASETEN_TIMEOUT_SECONDS=14.0`).

---

## System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Clinical Workstations (React 19 + TypeScript + Tailwind)"]
        StaffUI["Staff Pharmacist Workstation\n(Ergonomic 2-Column Review)"]
        ChiefUI["Chief Pharmacist Workstation\n(Executive Dashboard & Inventory)"]
        StudentUI["Pharmacy Student Studio\n(Case Catalog & 50/30/20 Rubric)"]
    end

    subgraph API["FastAPI Backend (JWT RBAC + Pydantic v2)"]
        AuthRouter["Auth & Session Controller\n(Auto-401 Eviction, Role Guards)"]
        RxRouter["Prescriptions & Review Service\n(Atomic Transactions, Override Enforcement)"]
        OversightRouter["Chief Oversight Service\n(Escalation Resolutions & Inventory Ledger)"]
        EduRouter["Educational Evaluator\n(Deterministic Scoring & Criteria Obfuscation)"]
    end

    subgraph DualSafety["Dual Safety Boundary"]
        DVE["Deterministic Safety Engine\n(Allergies, Interactions, Dosages, Inventory)"]
        BasetenClient["Baseten Inference Client\n(Meta Muse Spark Open, 14.0s Safety Cutoff)"]
        ValGuard["Output Validation & Anti-Approval Guard\n(Schema Lock, Severity Lock, Disclaimer)"]
    end

    subgraph Storage["Unified Persistence Layer (SQLite + SQLAlchemy 2.0)"]
        DB[(pharmacyguard.db\nPRAGMA foreign_keys=ON)]
        AuditLog[(Append-Only Immutable Audit Ledger)]
    end

    StaffUI --> AuthRouter & RxRouter
    ChiefUI --> AuthRouter & OversightRouter
    StudentUI --> AuthRouter & EduRouter

    RxRouter --> DVE
    DVE --> DB
    DVE --> BasetenClient
    BasetenClient --> ValGuard
    ValGuard --> StaffUI
    RxRouter --> AuditLog
    OversightRouter --> AuditLog
```

---

## Clinical Workstation Ergonomics & Visual Hierarchy

PharmacyGuard features an institutional, hospital-grade EHR interface specifically designed to combat **pharmacist alert fatigue** and prevent cognitive overload **without hiding any critical clinical data**:

1. **Staff Pharmacist Two-Column Review Workstation:**
   * **Left Column (7/12 width):** Prescribed medication order line items table + Deterministic safety verification findings with severity badges + Immutable audit history.
   * **Right Column (5/12 width):** Sticky **Meta Muse Spark Open** AI Copilot consultation card.
   * **Ergonomic Benefit:** Pharmacists can review orders and findings side-by-side with the AI's clinical explanations without vertical scrolling fatigue.
   * **Zero Hidden Data:** Patient demographics (Name, MRN, DOB, Gender, Weight, Height) and Prescriber context (Doctor, Clinic, Indication notes) remain 100% visible in a consolidated header strip.
2. **Chief Pharmacist Executive Workstation:**
   * Softened medical cards tracking real-time inventory valuation ($2,414.40), stock deficits, pending escalations, and staff override records.
   * Active formulary exception table with one-click restock actions and balance tracking that strictly prevents negative stock values.
3. **Pharmacy Student Simulation Lab:**
   * Clean academic simulation suite with difficulty badges (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`), structured learning objectives, and 50/30/20 rubric assessment.
4. **Station Status & Global Advisory:**
   * Hospital station indicator strip (`● Station Online`, `Safety Engine: Deterministic Active`, `Meta AI: Muse Spark Open`).
   * Subtle gradient advisory banner at the top keeping regulatory disclaimers legible without distracting from patient safety workflows.

---

## Role-Based Workspaces & Demo Credentials

PharmacyGuard supports 3 distinct clinical personas authenticated via JWT:

| Role | Username | Demo Password | Scope & Operational Authority |
| :--- | :--- | :--- | :--- |
| **Staff Pharmacist** | `pharmacist_demo` | `StaffDemoPassword2026!` | Verification queue, deterministic checks, Meta Muse Spark Open clinical explanations, review determinations (`Accept`, `Override` with mandatory rationale, `Escalate`). |
| **Chief Pharmacist** | `chief_demo` | `ChiefDemoPassword2026!` | Escalated case resolution, audit ledger review, simulated inventory adjustments, restock tracking. |
| **Pharmacy Student** | `student_demo` | `StudentDemoPassword2026!` | Case catalog, clinical assessment studio, automated 50/30/20 rubric evaluation, submission history. Read-only clinical actions. |

---

## Meta Muse Spark Open AI Integration

PharmacyGuard integrates Meta's open-weights frontier model **Muse Spark Open** (`meta-models/muse-spark-open-1026`) via Baseten's OpenAI-compatible inference API (`https://inference.baseten.co/v1`).

### AI Guardrails & Safety Constraints:
- **Primacy of Deterministic Verification:** Deterministic rules run first. AI receives structured findings and provides clinical context; it cannot invent findings or alter rule severities.
- **Anti-Approval Enforcement:** Model outputs are strictly screened. Phrases asserting autonomous approval or dispensing safety trigger immediate rejection (`ai_status="rejected"`).
- **Strict 14.0s Timeout:** Inference requests are bounded by a 14.0-second safety cutoff with graceful fallback to deterministic findings (`ai_status="timeout"`).
- **Non-Authoritative Disclaimer:** All AI outputs display a persistent non-authoritative clinical decision support notice.

---

## Future Clinical Roadmap: Population-Specific Pharmacogenomics & Domain-Constrained Medical RAG

As PharmacyGuard progresses toward clinical utilization, ungrounded frontier LLMs pose a known patient safety risk: **applying Caucasian-centric clinical assumptions to African, Mediterranean, or other ancestral populations**.

To prevent demographic and ancestral pharmacotherapy mismatch, the clinical roadmap establishes **Tier 2: Domain-Constrained Medical Retrieval (Medical RAG)**:

### 1. The Clinical Problem:
* **First-Line Hypertension:** Clinical guidelines (ACC/AHA 2017, JNC-8, Pan-African Society of Cardiology) establish that adult patients of African descent have low-renin hypertension and respond superiorly to **Calcium Channel Blockers (CCBs, e.g., Amlodipine) or Thiazide diuretics**. Monotherapy with ACE inhibitors (e.g., Lisinopril) yields inferior blood pressure reduction and carries a **3- to 4-fold higher risk of life-threatening angioedema**. An unguided AI could mistakenly treat ACEI monotherapy as standard first-line care.
* **G6PD Deficiency Hemolysis:** G6PD deficiency is prevalent in populations of African and Mediterranean descent. Exposure to oxidant medications (e.g., Rasburicase, Primaquine, Dapsone) induces severe, life-threatening intravascular hemolysis.
* **CYP2C19 & Antiplatelet Bioactivation:** Loss-of-function variants common in diverse populations compromise Clopidogrel conversion, risking acute stent thrombosis if alternative P2Y12 inhibitors (Ticagrelor, Prasugrel) are not utilized.

### 2. Architectural Solution (Medical RAG):
* **Vetted Guideline Compendiums:** The AI will be hard-constrained to search only ingested, verified clinical compendiums (CPIC Guidelines, WHO Formularies, ACC/AHA Practice Guidelines, and regional African cardiology guidelines).
* **Demographic Pre-Flight Constraints:** Ingested patient demographic and pharmacogenomic tags dynamically restrict the AI's retrieval window, ensuring population-specific evidence is prioritized.
* **Mandatory Guideline Citation & Lineage Check:** Every AI therapeutic suggestion must cite the exact guideline organization, section, and publication year. If ungrounded, the assertion is blocked.

📖 *Full architectural and clinical specification available in [CLINICAL_POPULATION_GUIDANCE_SPEC.md](docs/CLINICAL_POPULATION_GUIDANCE_SPEC.md).*

---

## Synthetic Benchmark Scenarios

The database includes 5 realistic clinical scenarios demonstrating rule coverage:
1. **Scenario 1 — Routine Maintenance (`RX-2026-0001`)**: Lisinopril 10mg for Essential Hypertension (`I10`). Evaluates all rules clean.
2. **Scenario 2 — Indication Review Required (`RX-2026-0002`)**: Metformin 500mg BID without documented Type 2 Diabetes diagnosis (`E11.x`). Triggers indication review.
3. **Scenario 3 — Severe Allergy Conflict (`RX-2026-0003`)**: Amoxicillin 500mg TID prescribed to patient with documented severe Penicillin anaphylaxis (bronchospasm). Triggers HIGH severity allergy conflict and AI clinical explanation.
4. **Scenario 4 — Duplicate Systemic NSAIDs (`RX-2026-0004`)**: Concurrent Ketorolac 10mg and Ibuprofen 600mg. Triggers high-severity therapeutic duplication conflict.
5. **Scenario 5 — Simulated Stock Shortage (`RX-2026-0005`)**: Cefdinir 300mg BID (quantity 20) with only 12 units on hand. Triggers inventory deficit alert.

---

## Automated Test Verification

PharmacyGuard includes comprehensive unit, integration, and regression test suites with 100% pass rate:

- **Backend Pytest Suite:** **113 passed, 0 failed** (FastAPI, SQLAlchemy, verification engine, Baseten client, RBAC, audit immutability).
- **Frontend Vitest Suite:** **114 passed, 0 failed** across 9 test files (React 19, workspace shells, queue filters, review modals, AI explanation states).
- **Total Tests:** **227 passing tests**.
- **Production Build:** `npm run build` cleanly compiled (`tsc -b && vite build`, 0 errors in 32s).

---

## Quickstart (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt

# Run full backend test suite (113 tests)
python -m pytest

# Start backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install

# Run frontend tests (114 tests)
npm test

# Build production bundle
npm run build

# Start Vite dev server
npm run dev
```

Visit `http://localhost:5173` to explore the clinical workstations locally, or visit the live cloud deployment at `https://pharmacyguard-meta.onrender.com`.
