"""SQLAlchemy ORM models package."""
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
from app.models.review import PharmacistReview, ReviewFinding, EscalationResolution
from app.models.audit import AuditEvent
from app.models.education import EducationalCase, StudentSubmission
from app.models.community import (
    CommunityConsultation,
    CommunityConsultationItem,
    CommunityFinding,
    ClinicalRuleMeta,
)

__all__ = [
    "User",
    "Role",
    "UserRole",
    "SyntheticPatient",
    "PatientDiagnosis",
    "PatientAllergy",
    "MedicationReference",
    "IndicationRule",
    "AllergyCrossReactivityRule",
    "DrugInteractionRule",
    "DosageRule",
    "Prescription",
    "PrescriptionItem",
    "InventoryItem",
    "InventoryTransaction",
    "PharmacistReview",
    "ReviewFinding",
    "EscalationResolution",
    "AuditEvent",
    "EducationalCase",
    "StudentSubmission",
    "CommunityConsultation",
    "CommunityConsultationItem",
    "CommunityFinding",
    "ClinicalRuleMeta",
]
