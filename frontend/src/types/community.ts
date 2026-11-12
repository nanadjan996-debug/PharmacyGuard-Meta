/**
 * Types for PharmacyGuard Community Edition Walk-In Counter Consultations.
 */

export type MRDTStatus = 'NOT_DONE' | 'CONFIRMED_POSITIVE' | 'CONFIRMED_NEGATIVE' | 'TESTING_UNAVAILABLE';

export type G6PDEpistemicStatus =
  | 'NOT_COLLECTED'
  | 'REPORTED_UNKNOWN'
  | 'CONFIRMED_NORMAL'
  | 'CONFIRMED_DEFICIENT'
  | 'NOT_TESTED';

export type EpistemicStatus =
  | 'CONFIRMED_OBJECTIVE'
  | 'REPORTED_UNVERIFIED'
  | 'PATIENT_UNKNOWN'
  | 'NOT_COLLECTED'
  | 'CLINICALLY_IRRELEVANT';

export type AllergyEpistemicState = EpistemicStatus;

export type ConsultationLifecycleState =
  | 'DRAFT'
  | 'VERIFICATION_COMPLETED'
  | 'FINDINGS_REVIEWED'
  | 'PRESCRIBER_CLARIFICATION_PENDING'
  | 'REFERRED'
  | 'APPROVED_FOR_DISPENSING'
  | 'COMPLETED'
  | 'AMENDED';

export interface AllergyEntry {
  allergen: string;
  state: AllergyEpistemicState;
  reaction?: string;
}

export interface ConsultationItem {
  id?: string;
  drug_name: string;
  strength: string;
  dosage_form: string;
  dose_amount: number;
  dose_unit: string;
  frequency: string;
  duration_days: number;
  route: string;
  instructions?: string;
  legal_category: 'OTC' | 'P' | 'POM';
}

export interface CommunityFinding {
  id: string;
  rule_identifier: string;
  category: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';
  epistemic_status?: EpistemicStatus;
  title: string;
  description: string;
  action_required: string;
  is_red_flag: boolean;
  requires_referral: boolean;
}

export interface CommunityConsultation {
  id: string;
  consultation_number: string;
  patient_identifier: string;
  status: ConsultationLifecycleState;
  age_years?: number | null;
  age_months?: number | null;
  gender?: string | null;
  weight_kg?: number | null;
  temperature_c?: number | null;
  sbp_mmhg?: number | null;
  dbp_mmhg?: number | null;
  heart_rate_bpm?: number | null;
  respiratory_rate_bpm?: number | null;
  spo2_percent?: number | null;
  mrdt_status: MRDTStatus;
  g6pd_status: G6PDEpistemicStatus;
  chief_complaint: string;
  symptoms: string[];
  allergies: AllergyEntry[];
  current_medications: string[];
  referral_triggered: boolean;
  referral_urgency?: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | null;
  referral_reason?: string | null;
  referral_notes?: string | null;
  pharmacist_notes?: string | null;
  dispense_rationale?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  items: ConsultationItem[];
  findings: CommunityFinding[];
}

export interface ConsultationCreatePayload {
  patient_identifier: string;
  age_years?: number | null;
  age_months?: number | null;
  gender?: string | null;
  weight_kg?: number | null;
  temperature_c?: number | null;
  sbp_mmhg?: number | null;
  dbp_mmhg?: number | null;
  heart_rate_bpm?: number | null;
  respiratory_rate_bpm?: number | null;
  spo2_percent?: number | null;
  mrdt_status: MRDTStatus;
  g6pd_status: G6PDEpistemicStatus;
  chief_complaint: string;
  symptoms: string[];
  allergies: AllergyEntry[];
  current_medications: string[];
  proposed_items: ConsultationItem[];
}

export interface ConsultationTransitionPayload {
  target_state: ConsultationLifecycleState;
  pharmacist_notes?: string;
  dispense_rationale?: string;
  referral_notes?: string;
}

export interface ClinicalRuleMetadata {
  id: string;
  name: string;
  category: string;
  version: string;
  source_reference: string;
  clinical_trigger: string;
  approval_status: string;
  is_active: boolean;
}

