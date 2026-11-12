"""Synthetic benchmark dataset and demo user seeder for PharmacyGuard.

All patient records, clinical rules, and inventory levels are completely synthetic
demonstration artifacts for the Meta Global AI Developer Hackathon.
"""
from datetime import datetime, date, timezone
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.models.user import User, Role, UserRole
from app.models.patient import SyntheticPatient, PatientDiagnosis, PatientAllergy
from app.models.reference import (
    MedicationReference,
    IndicationRule,
    AllergyCrossReactivityRule,
    DrugInteractionRule,
    DosageRule,
)
from app.models.prescription import Prescription, PrescriptionItem
from app.models.inventory import InventoryItem, InventoryTransaction
from app.models.review import PharmacistReview, ReviewFinding
from app.models.audit import AuditEvent
from app.models.education import EducationalCase
from app.models.community import (
    ClinicalRuleMeta,
    CommunityConsultation,
    CommunityConsultationItem,
    CommunityFinding,
)


def seed_database(db: Session) -> dict[str, int]:
    """
    Idempotent database seeder.
    Checks for the existence of records by unique identifiers and inserts only missing entities.
    Returns counts of seeded entities.
    """
    stats = {
        "roles": 0,
        "users": 0,
        "medications": 0,
        "rules": 0,
        "inventory": 0,
        "patients": 0,
        "prescriptions": 0,
        "findings": 0,
        "educational_cases": 0,
        "audit_events": 0,
    }

    # Clean / migrate legacy demonstration labels in existing DB records to clinical standards
    for ir in db.query(IndicationRule).all():
        if ir.rule_source and "Demo" in ir.rule_source:
            ir.rule_source = ir.rule_source.replace("Demo Guideline", "Clinical Practice Guideline:")
    for ar in db.query(AllergyCrossReactivityRule).all():
        if ar.rule_source and "Demo" in ar.rule_source:
            ar.rule_source = ar.rule_source.replace("Demo Allergy Reference", "Clinical Allergy Reference:")
    for ddi in db.query(DrugInteractionRule).all():
        if ddi.rule_source and "Demo" in ddi.rule_source:
            ddi.rule_source = ddi.rule_source.replace("Demo DDI Matrix", "Drug Interaction Matrix:")
    for dr in db.query(DosageRule).all():
        if dr.rule_source and "Demo" in dr.rule_source:
            dr.rule_source = dr.rule_source.replace("Demo Monograph", "Clinical Dosing Monograph:")
    for rf in db.query(ReviewFinding).all():
        if rf.rule_source and "Demo" in rf.rule_source:
            rf.rule_source = (
                rf.rule_source
                .replace("Demo Allergy Reference", "Clinical Allergy Reference:")
                .replace("Demo DDI Matrix", "Drug Interaction Matrix:")
                .replace("Demo Inventory Availability Service", "Hospital Formulary & Perpetual Inventory Service")
                .replace("Demo Benchmark Scenario 1", "Clinical Practice Guideline: ACC/AHA-2026-HTN")
                .replace("Demo Guideline", "Clinical Practice Guideline:")
            )
    db.commit()

    # -------------------------------------------------------------
    # 1. ROLES
    # -------------------------------------------------------------
    roles_data = [
        {"id": "staff_pharmacist", "name": "Staff Pharmacist", "description": "Review queue, prescription verification, findings review, accept/override/escalate."},
        {"id": "chief_pharmacist", "name": "Chief Pharmacist", "description": "Escalated case resolution, override audit ledger, simulated inventory control."},
        {"id": "pharmacy_student", "name": "Pharmacy Student", "description": "Educational cases, determination practice, score tracking. Read-only clinical actions."},
    ]
    for r in roles_data:
        existing_role = db.query(Role).filter_by(id=r["id"]).first()
        if not existing_role:
            db.add(Role(**r))
            stats["roles"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 2. DEMO USERS (Hashed with bcrypt)
    # -------------------------------------------------------------
    demo_users = [
        {
            "id": "usr-staff-001",
            "username": "pharmacist_demo",
            "email": "sarah.lin@pharmacyguard.demo",
            "full_name": "Sarah Lin, PharmD",
            "password": "StaffDemoPassword2026!",
            "role_id": "staff_pharmacist",
        },
        {
            "id": "usr-chief-001",
            "username": "chief_demo",
            "email": "marcus.vance@pharmacyguard.demo",
            "full_name": "Marcus Vance, PharmD, BCPS",
            "password": "ChiefDemoPassword2026!",
            "role_id": "chief_pharmacist",
        },
        {
            "id": "usr-student-001",
            "username": "student_demo",
            "email": "alex.rivera@pharmacyguard.demo",
            "full_name": "Alex Rivera, P3 Pharmacy Candidate",
            "password": "StudentDemoPassword2026!",
            "role_id": "pharmacy_student",
        },
    ]

    for u in demo_users:
        existing_user = db.query(User).filter_by(username=u["username"]).first()
        if not existing_user:
            user = User(
                id=u["id"],
                username=u["username"],
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=hash_password(u["password"]),
                is_active=True,
            )
            db.add(user)
            db.flush()
            user_role = UserRole(user_id=user.id, role_id=u["role_id"])
            db.add(user_role)
            stats["users"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 3. MEDICATION REFERENCE CATALOG (Documented synthetic dataset)
    # -------------------------------------------------------------
    meds_data = [
        {
            "id": "MED-LIS-10",
            "generic_name": "Lisinopril",
            "brand_name": "Prinivil",
            "drug_class": "ACE Inhibitor",
            "dosage_form": "Oral Tablet",
            "standard_strength": "10 mg",
            "route": "Oral",
        },
        {
            "id": "MED-MET-500",
            "generic_name": "Metformin",
            "brand_name": "Glucophage",
            "drug_class": "Biguanide Antidiabetic",
            "dosage_form": "Oral Tablet",
            "standard_strength": "500 mg",
            "route": "Oral",
        },
        {
            "id": "MED-AMOX-500",
            "generic_name": "Amoxicillin",
            "brand_name": "Amoxil",
            "drug_class": "Penicillin Antibiotic",
            "dosage_form": "Oral Capsule",
            "standard_strength": "500 mg",
            "route": "Oral",
        },
        {
            "id": "MED-CEF-500",
            "generic_name": "Cefdinir",
            "brand_name": "Omnicef",
            "drug_class": "Cephalosporin Antibiotic",
            "dosage_form": "Oral Capsule",
            "standard_strength": "300 mg",
            "route": "Oral",
        },
        {
            "id": "MED-IBU-600",
            "generic_name": "Ibuprofen",
            "brand_name": "Motrin",
            "drug_class": "NSAID",
            "dosage_form": "Oral Tablet",
            "standard_strength": "600 mg",
            "route": "Oral",
        },
        {
            "id": "MED-KETO-10",
            "generic_name": "Ketorolac",
            "brand_name": "Toradol",
            "drug_class": "NSAID",
            "dosage_form": "Oral Tablet",
            "standard_strength": "10 mg",
            "route": "Oral",
        },
        {
            "id": "MED-AML-5",
            "generic_name": "Amlodipine",
            "brand_name": "Norvasc",
            "drug_class": "Calcium Channel Blocker",
            "dosage_form": "Oral Tablet",
            "standard_strength": "5 mg",
            "route": "Oral",
        },
        {
            "id": "MED-WAR-5",
            "generic_name": "Warfarin",
            "brand_name": "Coumadin",
            "drug_class": "Anticoagulant",
            "dosage_form": "Oral Tablet",
            "standard_strength": "5 mg",
            "route": "Oral",
        },
    ]

    for m in meds_data:
        existing_med = db.query(MedicationReference).filter_by(id=m["id"]).first()
        if not existing_med:
            db.add(MedicationReference(**m, is_demo_reference=True))
            stats["medications"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 4. DETERMINISTIC CLINICAL RULES (Demo references only)
    # -------------------------------------------------------------
    indication_rules_data = [
        {
            "id": "RULE-IND-LIS-01",
            "medication_id": "MED-LIS-10",
            "approved_icd10_codes": "I10,I11,I50",
            "indication_name": "Hypertension / Heart Failure",
            "evidence": "AHA/ACC Hypertension Practice Guidelines",
            "rule_source": "Clinical Practice Guideline: ACC/AHA-2026-HTN",
        },
        {
            "id": "RULE-IND-MET-01",
            "medication_id": "MED-MET-500",
            "approved_icd10_codes": "E11.9,E11.0,E11.2",
            "indication_name": "Type 2 Diabetes Mellitus",
            "evidence": "ADA Standards of Medical Care in Diabetes",
            "rule_source": "Clinical Practice Guideline: ADA-2026-T2D",
        },
        {
            "id": "RULE-IND-AMOX-01",
            "medication_id": "MED-AMOX-500",
            "approved_icd10_codes": "J01.0,J02.9,J18.9",
            "indication_name": "Bacterial Sinusitis / Pharyngitis / Pneumonia",
            "evidence": "IDSA Clinical Practice Guideline for Acute Bacterial Rhinosinusitis",
            "rule_source": "Clinical Practice Guideline: IDSA-2026-ABRS",
        },
        {
            "id": "RULE-IND-IBU-01",
            "medication_id": "MED-IBU-600",
            "approved_icd10_codes": "M79.7,M25.5,R52",
            "indication_name": "Mild-to-Moderate Acute Pain / Inflammation",
            "evidence": "Pain Management Clinical Reference Guidelines",
            "rule_source": "Clinical Practice Guideline: APS/ASHP-2026-NSAID",
        },
        {
            "id": "RULE-IND-KETO-01",
            "medication_id": "MED-KETO-10",
            "approved_icd10_codes": "M79.7,Z98.89",
            "indication_name": "Short-term Acute Post-Operative Pain Management",
            "evidence": "Short-term NSAID analgesia guideline (maximum 5 consecutive days)",
            "rule_source": "Surgical Analgesia Protocol: SURG-2026-KETO",
        },
        {
            "id": "RULE-IND-CEF-01",
            "medication_id": "MED-CEF-500",
            "approved_icd10_codes": "J18.9,J01.9",
            "indication_name": "Community-Acquired Pneumonia / Sinusitis",
            "evidence": "ATS/IDSA Community-Acquired Pneumonia Guidelines",
            "rule_source": "Clinical Practice Guideline: ATS/IDSA-2026-CAP",
        },
        {
            "id": "RULE-IND-AML-01",
            "medication_id": "MED-AML-5",
            "approved_icd10_codes": "I10,I20.9",
            "indication_name": "Essential Hypertension / Chronic Stable Angina",
            "evidence": "AHA/ACC Hypertension Practice Guidelines",
            "rule_source": "Clinical Practice Guideline: ACC/AHA-2026-CCB",
        },
    ]
    for ir in indication_rules_data:
        existing_ir = db.query(IndicationRule).filter_by(id=ir["id"]).first()
        if not existing_ir:
            db.add(IndicationRule(**ir, is_demo_rule=True))
            stats["rules"] += 1

    allergy_rules_data = [
        {
            "id": "RULE-ALG-PEN-01",
            "allergen_class": "Penicillin",
            "cross_reactive_class": "Penicillin Antibiotic",
            "risk_level": "High",
            "cross_reactivity_rate_pct": 100.0,
            "evidence": "Direct class match: Penicillin-derived beta-lactams share identical core ring structure.",
            "rule_source": "Clinical Allergy Reference: CPIC / Lexicomp ALG-2026-PEN",
        },
        {
            "id": "RULE-ALG-PEN-CEPH-01",
            "allergen_class": "Penicillin",
            "cross_reactive_class": "Cephalosporin Antibiotic",
            "risk_level": "Moderate",
            "cross_reactivity_rate_pct": 4.5,
            "evidence": "Cross-reactivity between penicillins and 1st/2nd generation cephalosporins occurs in ~3-5% of cases.",
            "rule_source": "Clinical Allergy Reference: EAACI / Lexicomp ALG-2026-CEPH",
        },
    ]
    for ar in allergy_rules_data:
        existing_ar = db.query(AllergyCrossReactivityRule).filter_by(id=ar["id"]).first()
        if not existing_ar:
            db.add(AllergyCrossReactivityRule(**ar, is_demo_rule=True))
            stats["rules"] += 1

    interaction_rules_data = [
        {
            "id": "RULE-INT-NSAID-NSAID-01",
            "drug_a_class_or_id": "NSAID",
            "drug_b_class_or_id": "NSAID",
            "severity": "High",
            "clinical_effect": "Duplicate systemic NSAID therapy increases risk of gastrointestinal hemorrhage, ulceration, and acute kidney injury without analgesic benefit.",
            "evidence": "FDA Black Box Warning & Clinical Pharmacology Interaction Matrix",
            "rule_source": "Drug Interaction Matrix: FDA / Facts & Comparisons DDI-2026-NSAID-DUP",
        },
        {
            "id": "RULE-INT-NSAID-WAR-01",
            "drug_a_class_or_id": "NSAID",
            "drug_b_class_or_id": "Anticoagulant",
            "severity": "High",
            "clinical_effect": "Concurrent use significantly elevates risk of severe upper gastrointestinal and internal bleeding.",
            "evidence": "CHEST Antithrombotic Therapy Guidelines",
            "rule_source": "Drug Interaction Matrix: CHEST DDI-2026-BLEED",
        },
    ]
    for ddi in interaction_rules_data:
        existing_ddi = db.query(DrugInteractionRule).filter_by(id=ddi["id"]).first()
        if not existing_ddi:
            db.add(DrugInteractionRule(**ddi, is_demo_rule=True))
            stats["rules"] += 1

    dosage_rules_data = [
        {
            "id": "RULE-DOSE-LIS-01",
            "medication_id": "MED-LIS-10",
            "min_daily_dose_mg": 2.5,
            "max_daily_dose_mg": 40.0,
            "max_single_dose_mg": 40.0,
            "evidence": "USP-NF Daily Dosing Boundaries",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-LIS",
        },
        {
            "id": "RULE-DOSE-MET-01",
            "medication_id": "MED-MET-500",
            "min_daily_dose_mg": 500.0,
            "max_daily_dose_mg": 2000.0,
            "max_single_dose_mg": 1000.0,
            "evidence": "ADA / USP-NF Maximum Daily Dose Monograph",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-MET",
        },
        {
            "id": "RULE-DOSE-AMOX-01",
            "medication_id": "MED-AMOX-500",
            "min_daily_dose_mg": 250.0,
            "max_daily_dose_mg": 3000.0,
            "max_single_dose_mg": 1000.0,
            "evidence": "IDSA / USP-NF Adult Antibiotic Dosing Monograph",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-AMOX",
        },
        {
            "id": "RULE-DOSE-IBU-01",
            "medication_id": "MED-IBU-600",
            "min_daily_dose_mg": 200.0,
            "max_daily_dose_mg": 2400.0,
            "max_single_dose_mg": 800.0,
            "evidence": "USP-NF Maximum Daily Dose Threshold",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-IBU",
        },
        {
            "id": "RULE-DOSE-KETO-01",
            "medication_id": "MED-KETO-10",
            "min_daily_dose_mg": 10.0,
            "max_daily_dose_mg": 40.0,
            "max_single_dose_mg": 10.0,
            "evidence": "FDA Boxed Warning / Short-Term Analgesia Monograph",
            "rule_source": "Clinical Dosing Monograph: FDA DOSE-2026-KETO",
        },
        {
            "id": "RULE-DOSE-CEF-01",
            "medication_id": "MED-CEF-500",
            "min_daily_dose_mg": 300.0,
            "max_daily_dose_mg": 600.0,
            "max_single_dose_mg": 300.0,
            "evidence": "IDSA / USP-NF Third-Generation Cephalosporin Monograph",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-CEF",
        },
        {
            "id": "RULE-DOSE-AML-01",
            "medication_id": "MED-AML-5",
            "min_daily_dose_mg": 2.5,
            "max_daily_dose_mg": 10.0,
            "max_single_dose_mg": 10.0,
            "evidence": "ACC/AHA Dosing Boundary Guidelines",
            "rule_source": "Clinical Dosing Monograph: USP-NF DOSE-2026-AML",
        },
    ]
    for dr in dosage_rules_data:
        existing_dr = db.query(DosageRule).filter_by(id=dr["id"]).first()
        if not existing_dr:
            db.add(DosageRule(**dr, is_demo_rule=True))
            stats["rules"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 5. SIMULATED INVENTORY ITEMS & STOCK LEVELS
    # -------------------------------------------------------------
    # Note: MED-CEF-500 has only 12 units on hand (triggering stock shortage for Scenario 5!)
    inventory_data = [
        {"medication_id": "MED-LIS-10", "quantity_on_hand": 350, "reorder_threshold": 50, "lot_number": "LOT-LIS-8841", "exp": date(2027, 8, 31)},
        {"medication_id": "MED-MET-500", "quantity_on_hand": 400, "reorder_threshold": 60, "lot_number": "LOT-MET-3321", "exp": date(2027, 10, 15)},
        {"medication_id": "MED-AMOX-500", "quantity_on_hand": 180, "reorder_threshold": 40, "lot_number": "LOT-AMX-9102", "exp": date(2027, 4, 30)},
        {"medication_id": "MED-CEF-500", "quantity_on_hand": 12, "reorder_threshold": 25, "lot_number": "LOT-CEF-1144", "exp": date(2027, 2, 28)},  # LOW STOCK
        {"medication_id": "MED-IBU-600", "quantity_on_hand": 500, "reorder_threshold": 50, "lot_number": "LOT-IBU-6623", "exp": date(2028, 1, 31)},
        {"medication_id": "MED-KETO-10", "quantity_on_hand": 85, "reorder_threshold": 20, "lot_number": "LOT-KTO-5521", "exp": date(2027, 6, 30)},
        {"medication_id": "MED-AML-5", "quantity_on_hand": 260, "reorder_threshold": 30, "lot_number": "LOT-AML-4491", "exp": date(2027, 12, 31)},
        {"medication_id": "MED-WAR-5", "quantity_on_hand": 120, "reorder_threshold": 20, "lot_number": "LOT-WAR-2201", "exp": date(2027, 9, 30)},
    ]

    for inv in inventory_data:
        existing_inv = db.query(InventoryItem).filter_by(medication_id=inv["medication_id"]).first()
        if not existing_inv:
            item = InventoryItem(
                id=f"inv-{inv['medication_id'].lower()}",
                medication_id=inv["medication_id"],
                location="Central Pharmacy Automated Carousel A",
                quantity_on_hand=inv["quantity_on_hand"],
                reorder_threshold=inv["reorder_threshold"],
                unit_cost_cents=120,
                lot_number=inv["lot_number"],
                expiration_date=inv["exp"],
            )
            db.add(item)
            stats["inventory"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 6. FIVE SYNTHETIC BENCHMARK CASES (Blueprint Scenarios)
    # -------------------------------------------------------------

    # SCENARIO 1: Clean Demo Case (Routine prescription, no conflicts)
    p1 = db.query(SyntheticPatient).filter_by(mrn="SYNTH-MRN-001").first()
    if not p1:
        p1 = SyntheticPatient(
            id="pat-synth-001",
            mrn="SYNTH-MRN-001",
            first_name="Arthur",
            last_name="Pendelton",
            date_of_birth=date(1968, 4, 12),
            gender="Male",
            weight_kg=82.5,
            height_cm=178.0,
            is_synthetic=True,
        )
        db.add(p1)
        db.flush()
        db.add(PatientDiagnosis(patient_id=p1.id, icd10_code="I10", description="Essential (primary) hypertension", diagnosed_date=date(2024, 2, 10)))
        stats["patients"] += 1

    rx1 = db.query(Prescription).filter_by(prescription_number="RX-2026-0001").first()
    if not rx1:
        rx1 = Prescription(
            id="rx-synth-001",
            prescription_number="RX-2026-0001",
            patient_id=p1.id,
            prescriber_name="Dr. Elena Rostova, MD",
            prescriber_department="Cardiology Outpatient Clinic",
            status="pending",
            scenario_key="SCENARIO_1_CLEAN",
            clinical_notes="Routine maintenance for uncomplicated essential hypertension. Blood pressure 138/86 mmHg.",
        )
        db.add(rx1)
        db.flush()
        db.add(PrescriptionItem(
            prescription_id=rx1.id,
            medication_id="MED-LIS-10",
            dose_amount=10.0,
            dose_unit="mg",
            frequency="Once daily",
            route="Oral",
            duration_days=30,
            quantity_prescribed=30,
            instructions="Take 1 tablet (10 mg) by mouth every morning with water.",
        ))
        # Initial benchmark finding: Clean
        db.add(ReviewFinding(
            prescription_id=rx1.id,
            rule_identifier="RULE-CLEAN-001",
            category="INDICATION",
            severity="INFO",
            status="CLEAN",
            evidence="Prescribed Lisinopril 10mg PO once daily matches documented primary hypertension diagnosis (I10). No known drug allergies, duplications, or dosage anomalies.",
            rule_source="Clinical Practice Guideline: ACC/AHA-2026-HTN",
            human_review_required=False,
        ))
        stats["prescriptions"] += 1
        stats["findings"] += 1

    # SCENARIO 2: Indication Review Required
    p2 = db.query(SyntheticPatient).filter_by(mrn="SYNTH-MRN-002").first()
    if not p2:
        p2 = SyntheticPatient(
            id="pat-synth-002",
            mrn="SYNTH-MRN-002",
            first_name="Beatrice",
            last_name="Montgomery",
            date_of_birth=date(1975, 9, 23),
            gender="Female",
            weight_kg=68.0,
            height_cm=165.0,
            is_synthetic=True,
        )
        db.add(p2)
        db.flush()
        db.add(PatientDiagnosis(patient_id=p2.id, icd10_code="K21.9", description="Gastroesophageal reflux disease without esophagitis", diagnosed_date=date(2023, 6, 14)))
        db.add(PatientDiagnosis(patient_id=p2.id, icd10_code="M19.9", description="Osteoarthritis, unspecified", diagnosed_date=date(2022, 11, 3)))
        stats["patients"] += 1

    rx2 = db.query(Prescription).filter_by(prescription_number="RX-2026-0002").first()
    if not rx2:
        rx2 = Prescription(
            id="rx-synth-002",
            prescription_number="RX-2026-0002",
            patient_id=p2.id,
            prescriber_name="Dr. James Thornton, MD",
            prescriber_department="General Internal Medicine",
            status="pending",
            scenario_key="SCENARIO_2_INDICATION",
            clinical_notes="Prescribing Metformin 500mg BID. Fasting glucose borderline at 112 mg/dL. Verify indication or off-label use.",
        )
        db.add(rx2)
        db.flush()
        db.add(PrescriptionItem(
            prescription_id=rx2.id,
            medication_id="MED-MET-500",
            dose_amount=500.0,
            dose_unit="mg",
            frequency="Twice daily (BID)",
            route="Oral",
            duration_days=30,
            quantity_prescribed=60,
            instructions="Take 1 tablet (500 mg) by mouth twice daily with meals.",
        ))
        db.add(ReviewFinding(
            prescription_id=rx2.id,
            rule_identifier="RULE-IND-MET-01",
            category="INDICATION",
            severity="MODERATE",
            status="REVIEW_REQUIRED",
            evidence="Metformin prescribed without active Type 2 Diabetes (ICD-10 E11.x) diagnosis in patient profile. May represent prediabetes or unrecorded off-label use.",
            rule_source="Clinical Practice Guideline: ADA-2026-T2D",
            human_review_required=True,
        ))
        stats["prescriptions"] += 1
        stats["findings"] += 1

    # SCENARIO 3: Severe Allergy Conflict
    p3 = db.query(SyntheticPatient).filter_by(mrn="SYNTH-MRN-003").first()
    if not p3:
        p3 = SyntheticPatient(
            id="pat-synth-003",
            mrn="SYNTH-MRN-003",
            first_name="Charles",
            last_name="Vance",
            date_of_birth=date(1982, 11, 5),
            gender="Male",
            weight_kg=88.0,
            height_cm=182.0,
            is_synthetic=True,
        )
        db.add(p3)
        db.flush()
        db.add(PatientDiagnosis(patient_id=p3.id, icd10_code="J01.0", description="Acute maxillary sinusitis", diagnosed_date=date(2026, 10, 25)))
        db.add(PatientAllergy(
            patient_id=p3.id,
            allergen="Penicillin",
            allergy_type="Drug",
            severity="Anaphylaxis",
            reaction="Severe acute bronchospasm, diffuse urticaria, and hypotension requiring epinephrine in 2021.",
        ))
        stats["patients"] += 1

    rx3 = db.query(Prescription).filter_by(prescription_number="RX-2026-0003").first()
    if not rx3:
        rx3 = Prescription(
            id="rx-synth-003",
            prescription_number="RX-2026-0003",
            patient_id=p3.id,
            prescriber_name="Dr. Priya Patel, MD",
            prescriber_department="Otolaryngology Specialist Clinic",
            status="pending",
            scenario_key="SCENARIO_3_ALLERGY",
            clinical_notes="10-day severe purulent sinusitis refractory to saline rinses.",
        )
        db.add(rx3)
        db.flush()
        db.add(PrescriptionItem(
            prescription_id=rx3.id,
            medication_id="MED-AMOX-500",
            dose_amount=500.0,
            dose_unit="mg",
            frequency="Three times daily (TID)",
            route="Oral",
            duration_days=10,
            quantity_prescribed=30,
            instructions="Take 1 capsule (500 mg) by mouth three times daily for 10 days.",
        ))
        db.add(ReviewFinding(
            prescription_id=rx3.id,
            rule_identifier="RULE-ALG-PEN-01",
            category="ALLERGY",
            severity="HIGH",
            status="CONFLICT_DETECTED",
            evidence="CRITICAL ALLERGY CONFLICT: Amoxicillin is a penicillin antibiotic. Patient Charles Vance has a documented history of severe anaphylaxis to Penicillin with bronchospasm.",
            rule_source="Clinical Allergy Reference: CPIC / Lexicomp ALG-2026-PEN",
            human_review_required=True,
        ))
        stats["prescriptions"] += 1
        stats["findings"] += 1

    # SCENARIO 4: Duplicate Systemic NSAID Therapy
    p4 = db.query(SyntheticPatient).filter_by(mrn="SYNTH-MRN-004").first()
    if not p4:
        p4 = SyntheticPatient(
            id="pat-synth-004",
            mrn="SYNTH-MRN-004",
            first_name="Diana",
            last_name="Rosslyn",
            date_of_birth=date(1990, 2, 18),
            gender="Female",
            weight_kg=61.2,
            height_cm=170.0,
            is_synthetic=True,
        )
        db.add(p4)
        db.flush()
        db.add(PatientDiagnosis(patient_id=p4.id, icd10_code="M79.7", description="Fibromyalgia / Acute post-surgical musculoskeletal pain", diagnosed_date=date(2026, 10, 20)))
        stats["patients"] += 1

    rx4 = db.query(Prescription).filter_by(prescription_number="RX-2026-0004").first()
    if not rx4:
        rx4 = Prescription(
            id="rx-synth-004",
            prescription_number="RX-2026-0004",
            patient_id=p4.id,
            prescriber_name="Dr. Gregory Hayes, MD",
            prescriber_department="Orthopedic Surgery Service",
            status="pending",
            scenario_key="SCENARIO_4_DUPLICATE_NSAID",
            clinical_notes="Post-operative knee arthroscopy pain regimen. Co-prescribing oral ketorolac and ibuprofen.",
        )
        db.add(rx4)
        db.flush()
        db.add(PrescriptionItem(
            prescription_id=rx4.id,
            medication_id="MED-KETO-10",
            dose_amount=10.0,
            dose_unit="mg",
            frequency="Every 6 hours (Q6H)",
            route="Oral",
            duration_days=5,
            quantity_prescribed=20,
            instructions="Take 1 tablet (10 mg) by mouth every 6 hours as needed for severe pain. Do not exceed 5 days.",
        ))
        db.add(PrescriptionItem(
            prescription_id=rx4.id,
            medication_id="MED-IBU-600",
            dose_amount=600.0,
            dose_unit="mg",
            frequency="Every 8 hours (Q8H)",
            route="Oral",
            duration_days=7,
            quantity_prescribed=21,
            instructions="Take 1 tablet (600 mg) by mouth every 8 hours with food for pain/inflammation.",
        ))
        db.add(ReviewFinding(
            prescription_id=rx4.id,
            rule_identifier="RULE-INT-NSAID-NSAID-01",
            category="THERAPEUTIC_DUPLICATION",
            severity="HIGH",
            status="CONFLICT_DETECTED",
            evidence="THERAPEUTIC DUPLICATION DETECTED: Concurrent systemic NSAIDs (Ketorolac 10mg + Ibuprofen 600mg). Substantially increases gastrointestinal hemorrhage and acute nephrotoxicity without superior analgesia.",
            rule_source="Drug Interaction Matrix: FDA / Facts & Comparisons DDI-2026-NSAID-DUP",
            human_review_required=True,
        ))
        stats["prescriptions"] += 1
        stats["findings"] += 1

    # SCENARIO 5: Polypharmacy with Simulated Stock Shortage
    p5 = db.query(SyntheticPatient).filter_by(mrn="SYNTH-MRN-005").first()
    if not p5:
        p5 = SyntheticPatient(
            id="pat-synth-005",
            mrn="SYNTH-MRN-005",
            first_name="Edward",
            last_name="Sterling",
            date_of_birth=date(1954, 7, 30),
            gender="Male",
            weight_kg=76.4,
            height_cm=175.0,
            is_synthetic=True,
        )
        db.add(p5)
        db.flush()
        db.add(PatientDiagnosis(patient_id=p5.id, icd10_code="J18.9", description="Pneumonia, unspecified organism", diagnosed_date=date(2026, 10, 26)))
        db.add(PatientDiagnosis(patient_id=p5.id, icd10_code="I10", description="Essential (primary) hypertension", diagnosed_date=date(2020, 3, 15)))
        stats["patients"] += 1

    rx5 = db.query(Prescription).filter_by(prescription_number="RX-2026-0005").first()
    if not rx5:
        rx5 = Prescription(
            id="rx-synth-005",
            prescription_number="RX-2026-0005",
            patient_id=p5.id,
            prescriber_name="Dr. Anthony Morales, MD",
            prescriber_department="Pulmonary & Critical Care Medicine",
            status="pending",
            scenario_key="SCENARIO_5_STOCK_SHORTAGE",
            clinical_notes="Discharge regimen for resolving right lower lobe community-acquired pneumonia. Continue outpatient antihypertensive therapy.",
        )
        db.add(rx5)
        db.flush()
        db.add(PrescriptionItem(
            prescription_id=rx5.id,
            medication_id="MED-CEF-500",
            dose_amount=300.0,
            dose_unit="mg",
            frequency="Twice daily (BID)",
            route="Oral",
            duration_days=10,
            quantity_prescribed=20,
            instructions="Take 1 capsule (300 mg) by mouth twice daily for 10 days.",
        ))
        db.add(PrescriptionItem(
            prescription_id=rx5.id,
            medication_id="MED-AML-5",
            dose_amount=5.0,
            dose_unit="mg",
            frequency="Once daily",
            route="Oral",
            duration_days=30,
            quantity_prescribed=30,
            instructions="Take 1 tablet (5 mg) by mouth once daily.",
        ))
        db.add(ReviewFinding(
            prescription_id=rx5.id,
            rule_identifier="RULE-INV-STOCK-01",
            category="INVENTORY",
            severity="HIGH",
            status="CONFLICT_DETECTED",
            evidence="SIMULATED INVENTORY SHORTAGE: Cefdinir 300mg oral capsules on-hand quantity is 12 units, but prescription requires 20 units. Reorder threshold is 25 units. Fulfillment cannot be completed without reallocation or stock replenishment.",
            rule_source="Hospital Formulary & Perpetual Inventory Service",
            human_review_required=True,
        ))
        stats["prescriptions"] += 1
        stats["findings"] += 1

    db.commit()

    # -------------------------------------------------------------
    # 7. PHARMACY STUDENT EDUCATIONAL CASES
    # -------------------------------------------------------------
    edu_cases = [
        {
            "id": "edu-case-001",
            "case_code": "CASE-BEG-01",
            "title": "Severe Penicillin Allergy with Beta-Lactam Order",
            "difficulty": "BEGINNER",
            "category": "ALLERGY_CROSS_REACTIVITY",
            "patient_summary": "42-year-old male presenting with acute purulent sinusitis. Medical history notes documented anaphylaxis to Penicillin with bronchospasm requiring ICU admission in 2022.",
            "prescription_summary": "Amoxicillin 500mg PO TID x 10 days (Qty: 30 capsules).",
            "clinical_scenario": "The primary care physician ordered Amoxicillin for acute bacterial sinusitis. The automated verification engine flagged a direct class match for severe Penicillin allergy.",
            "predefined_answer": "REJECT",
            "predefined_explanation": "Amoxicillin is an amino-penicillin sharing the beta-lactam core. In patients with verified IgE-mediated anaphylaxis to penicillin, direct penicillins are strictly contraindicated. The prescription must be rejected and returned to the prescriber to select an alternative non-cross-reactive antimicrobial agent (e.g., doxycycline or a respiratory fluoroquinolone depending on culture and guidelines).",
            "key_learning_points": "1. Never approve or override direct allergen class matches with severe anaphylaxis.\n2. Always reject and request prescriber re-selection.\n3. Verify allergy documentation accuracy before proceeding.",
        },
        {
            "id": "edu-case-002",
            "case_code": "CASE-INT-01",
            "title": "Therapeutic Duplication: Ketorolac with Concurrent Ibuprofen",
            "difficulty": "INTERMEDIATE",
            "category": "DUPLICATE_THERAPY",
            "patient_summary": "34-year-old female post elective outpatient knee meniscus debridement. Discharge orders include multiple oral analgesics.",
            "prescription_summary": "Ketorolac 10mg PO Q6H PRN severe pain (5 days) AND Ibuprofen 600mg PO Q8H scheduled (7 days).",
            "clinical_scenario": "The surgeon prescribed scheduled Ibuprofen for anti-inflammatory benefit plus PRN oral Ketorolac for breakthrough postoperative pain. Both are non-selective systemic NSAIDs.",
            "predefined_answer": "REJECT",
            "predefined_explanation": "Concurrent administration of two systemic NSAIDs does not provide additive analgesia but significantly multiplies the incidence of gastrointestinal ulceration, acute renal impairment, and bleeding complications. Systemic ketorolac already carries a black-box warning limiting total systemic use to 5 days. Dual NSAID therapy should be rejected, and a multimodal non-NSAID option (such as acetaminophen or an appropriate short-course adjuvant) recommended.",
            "key_learning_points": "1. Recognize therapeutic duplication across different chemical names in the same class.\n2. Understand the ceiling effect and compounded toxicity of systemic NSAIDs.\n3. Recommend appropriate multimodal alternatives.",
        },
        {
            "id": "edu-case-003",
            "case_code": "CASE-ADV-01",
            "title": "Missing Indication and Dosing Verification in Chronic Renal Disease",
            "difficulty": "ADVANCED",
            "category": "RENAL_DOSING_INDICATION",
            "patient_summary": "67-year-old male with Stage 3b Chronic Kidney Disease (eGFR 38 mL/min/1.73m2), hypertension, and GERD. No documented history of diabetes mellitus.",
            "prescription_summary": "Metformin 1000mg PO BID (Daily total: 2000mg).",
            "clinical_scenario": "A new prescription for high-dose Metformin was entered during outpatient follow-up. The patient profile has no diabetes diagnosis, and renal function is moderately-to-severely reduced.",
            "predefined_answer": "REJECT",
            "predefined_explanation": "Metformin is indicated for Type 2 Diabetes; when prescribed without a clear documented indication, clarification is required. Furthermore, at an eGFR of 38 mL/min, the maximum recommended daily dose of Metformin is 1000 mg/day (500 mg BID) with frequent renal monitoring, due to the increased risk of fatal lactic acidosis. Prescribing 2000 mg/day at this eGFR level is contraindicated. The order must be rejected or escalated immediately.",
            "key_learning_points": "1. Correlate medication indications against the active diagnostic problem list.\n2. Evaluate renal clearance parameters against dosage guidelines.\n3. Identify contraindications that require prescriber intervention before dispensing.",
        },
    ]

    for ec in edu_cases:
        existing_case = db.query(EducationalCase).filter_by(case_code=ec["case_code"]).first()
        if not existing_case:
            db.add(EducationalCase(**ec))
            stats["educational_cases"] += 1
    db.commit()

    # -------------------------------------------------------------
    # 8. AUDIT LOG SEEDING (Append-only baseline record)
    # -------------------------------------------------------------
    initial_audit = db.query(AuditEvent).filter_by(action="SYSTEM_DATABASE_INITIALIZED").first()
    if not initial_audit:
        db.add(AuditEvent(
            id="audit-init-001",
            actor_username="SYSTEM",
            actor_role="system_boot",
            action="SYSTEM_DATABASE_INITIALIZED",
            entity_type="Database",
            entity_id="pharmacyguard.db",
            details='{"event": "Milestone 2 Synthetic Benchmark Seeding Completed", "synthetic": true, "clinical_validation": false}',
        ))
        stats["audit_events"] += 1
        db.commit()

    # -------------------------------------------------------------
    # 9. CLINICAL RULES META SEEDING (Specification v3.1.1-MASTER)
    # Rules remain BLOCKED_PENDING_FACULTY_APPROVAL until faculty validation
    # -------------------------------------------------------------
    rules_meta = [
        {
            "id": "RF-MAL-SEV-01",
            "name": "Severe / Complicated Malaria Red Flag",
            "category": "RED_FLAG",
            "version": "1.0.0",
            "source_reference": "NMCP Guidelines for Case Management of Malaria in Ghana (2020), Section 4.2–4.3, pp. 24–30",
            "clinical_trigger": "Fever + Suspected/Confirmed Malaria + ANY severe sign (prostration, lethargy, coma, repeated vomiting, convulsions, blackwater)",
            "approval_status": "BLOCKED_PENDING_FACULTY_APPROVAL",
            "is_active": False,
        },
        {
            "id": "RF-CVD-HYP-01",
            "name": "Hypertensive Crisis / Emergency Red Flag",
            "category": "RED_FLAG",
            "version": "1.0.0",
            "source_reference": "Ghana STG 2017, Chapter 11 (Hypertension in Adults), pp. 112–118",
            "clinical_trigger": "SBP >= 180 mmHg or DBP >= 120 mmHg WITH acute end-organ symptoms (severe headache, blurred vision, chest pain, dyspnea)",
            "approval_status": "BLOCKED_PENDING_FACULTY_APPROVAL",
            "is_active": False,
        },
        {
            "id": "RF-ABD-ACU-01",
            "name": "Acute Abdomen / Suspected Surgical Emergency Red Flag",
            "category": "RED_FLAG",
            "version": "1.0.0",
            "source_reference": "Ghana STG 2017, Chapter 18 (Gastrointestinal Conditions), pp. 245–250",
            "clinical_trigger": "Acute abdominal pain (<72h) + guarding, rigidity, rebound tenderness, bilious vomiting, or shock",
            "approval_status": "BLOCKED_PENDING_FACULTY_APPROVAL",
            "is_active": False,
        },
        {
            "id": "RF-PED-RES-01",
            "name": "Pediatric Severe Pneumonia / Respiratory Distress",
            "category": "RED_FLAG",
            "version": "1.0.0",
            "source_reference": "Ghana IMCI Guidelines (GHS 2018); Ghana STG 2017, Chapter 24",
            "clinical_trigger": "Child < 5y with cough/dyspnea + chest indrawing, stridor in calm child, grunting, or fast breathing (>=50 bpm for <1y, >=40 bpm for 1-5y)",
            "approval_status": "BLOCKED_PENDING_FACULTY_APPROVAL",
            "is_active": False,
        },
        {
            "id": "RF-NEU-MEN-01",
            "name": "Acute Neurological / Suspected Meningitis Red Flag",
            "category": "RED_FLAG",
            "version": "1.0.0",
            "source_reference": "Ghana STG 2017, Chapter 20 (CNS Infections), pp. 280–285",
            "clinical_trigger": "Fever + neck stiffness, photophobia, altered mental state, or non-blanching petechial/purpuric rash",
            "approval_status": "BLOCKED_PENDING_FACULTY_APPROVAL",
            "is_active": False,
        },
    ]

    for rm in rules_meta:
        existing_rm = db.query(ClinicalRuleMeta).filter_by(id=rm["id"]).first()
        if not existing_rm:
            db.add(ClinicalRuleMeta(**rm))
        else:
            existing_rm.approval_status = rm["approval_status"]
            existing_rm.is_active = rm["is_active"]
            existing_rm.source_reference = rm["source_reference"]
            existing_rm.clinical_trigger = rm["clinical_trigger"]
    db.commit()

    return stats
