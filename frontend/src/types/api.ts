/**
 * PharmacyGuard — Verified TypeScript API Contracts
 * Fully typed against FastAPI route handlers and Pydantic v2 schemas.
 */

// ---------------------------------------------------------------------------
// 1. Common & Health
// ---------------------------------------------------------------------------
export interface HealthCheckResponse {
  status: string;
  project: string;
  version: string;
  engine_type: string;
  disclaimer: string;
}

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

export interface ApiErrorResponse {
  detail: string | ApiErrorDetail[];
}

// ---------------------------------------------------------------------------
// 2. Authentication & Authorization
// ---------------------------------------------------------------------------
export type UserRole = 'staff_pharmacist' | 'chief_pharmacist' | 'pharmacy_student';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user: UserProfileResponse;
}

export interface LogoutResponse {
  status: string;
  message: string;
}

// ---------------------------------------------------------------------------
// 3. Clinical Prescriptions & Verification
// ---------------------------------------------------------------------------
export type PrescriptionStatus =
  | 'pending'
  | 'reviewed'
  | 'overridden'
  | 'escalated'
  | 'resolved';

export type FindingSeverity = 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';

export type FindingStatus =
  | 'CONFLICT_DETECTED'
  | 'REVIEW_REQUIRED'
  | 'INSUFFICIENT_DATA'
  | 'CLEAN';

export interface PrescriptionQueueItemResponse {
  id: string;
  prescription_number: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  prescriber_name: string;
  prescriber_department: string;
  status: PrescriptionStatus | string;
  scenario_key: string | null;
  created_at: string;
  findings_count: number;
  has_high_severity_finding: boolean;
}

export interface PrescriptionItemDetail {
  id: string;
  medication_id: string;
  generic_name: string;
  brand_name: string;
  drug_class: string;
  dose_amount: number;
  dose_unit: string;
  frequency: string;
  route: string;
  duration_days: number;
  quantity_prescribed: number;
  instructions: string;
}

export interface ReviewFindingResponse {
  id: string;
  rule_identifier: string;
  category: string;
  severity: FindingSeverity;
  status: FindingStatus | string;
  evidence: string;
  rule_source: string;
  human_review_required: boolean;
}

export interface PharmacistReviewDetail {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  action: string;
  override_rationale: string | null;
  notes: string | null;
  created_at: string;
  findings_count: number;
}

export interface EscalationDetail {
  id: string;
  prescription_id: string;
  escalated_by_id: string;
  escalated_by_name: string;
  escalation_reason: string;
  created_at: string;
  resolved_by_id: string | null;
  resolved_by_name: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
}

export interface PrescriptionDetailResponse {
  id: string;
  prescription_number: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  patient_dob: string;
  patient_gender: string;
  patient_weight_kg: number;
  patient_height_cm: number;
  prescriber_name: string;
  prescriber_department: string;
  status: PrescriptionStatus | string;
  scenario_key: string | null;
  clinical_notes: string | null;
  created_at: string;
  items: PrescriptionItemDetail[];
  findings: ReviewFindingResponse[];
  reviews: PharmacistReviewDetail[];
  escalations: EscalationDetail[];
}

export interface ReviewActionRequest {
  action: 'ACCEPT' | 'OVERRIDE' | 'ESCALATE';
  override_rationale?: string | null;
  notes?: string | null;
}

export interface ReviewActionResponse {
  status: string;
  prescription_id: string;
  prescription_number: string;
  action: string;
  new_status: string;
  review_id: string;
  findings_snapshotted: number;
  created_at: string;
  disclaimer: string;
}

export interface GeneratedFinding {
  rule_identifier: string;
  category: string;
  severity: FindingSeverity;
  status: string;
  message: string;
  evidence: string;
  rule_source: string;
  human_review_required: boolean;
}

export interface VerificationSummary {
  prescription_id: string;
  prescription_number: string;
  total_findings: number;
  conflicts_count: number;
  review_required_count: number;
  clean_count: number;
  max_severity: FindingSeverity;
  requires_human_review: boolean;
  engine_version: string;
  disclaimer: string;
}

export interface VerificationResponse {
  summary: VerificationSummary;
  findings: GeneratedFinding[];
}

// ---------------------------------------------------------------------------
// 4. Central Pharmacy Inventory Management
// ---------------------------------------------------------------------------
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface InventoryItemResponse {
  id: string;
  medication_id: string;
  generic_name: string;
  brand_name: string;
  drug_class: string;
  dosage_form: string;
  standard_strength: string;
  location: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  stock_status: StockStatus;
  is_low_stock: boolean;
  lot_number: string;
  expiration_date: string;
  unit_cost_cents: number;
  last_updated: string;
}

export interface InventoryTransactionDetail {
  id: string;
  inventory_item_id: string;
  transaction_type: string;
  quantity_delta: number;
  quantity_after: number;
  reason: string;
  actor_id: string | null;
  actor_username: string | null;
  created_at: string;
}

export interface InventoryItemDetailResponse extends InventoryItemResponse {
  transactions: InventoryTransactionDetail[];
}

export interface InventorySummaryResponse {
  total_items: number;
  total_units_on_hand: number;
  low_stock_count: number;
  out_of_stock_count: number;
  adequate_stock_count: number;
  total_inventory_value_cents: number;
  disclaimer: string;
}

export interface InventoryTransactionRequest {
  medication_id?: string | null;
  inventory_item_id?: string | null;
  transaction_type: 'RESTOCK' | 'ADJUSTMENT';
  quantity: number;
  direction?: 'INCREASE' | 'DECREASE' | null;
  reason?: string | null;
}

export interface InventoryTransactionResponse {
  status: string;
  transaction_id: string;
  inventory_item_id: string;
  medication_id: string;
  transaction_type: string;
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  created_at: string;
  actor_username: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// 5. Chief Pharmacist Oversight
// ---------------------------------------------------------------------------
export interface InventoryExceptionItem {
  inventory_item_id: string;
  medication_id: string;
  generic_name: string;
  brand_name: string;
  location: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  deficit: number;
  stock_status: string;
  severity: string;
}

export interface ChiefOversightDashboardResponse {
  inventory_summary: InventorySummaryResponse;
  inventory_exceptions: InventoryExceptionItem[];
  workflow_counts: Record<string, number>;
  pending_escalations_count: number;
  total_overrides_count: number;
  recent_audit_events: Array<Record<string, unknown>>;
  disclaimer: string;
}

export interface OverrideLedgerItem {
  review_id: string;
  prescription_id: string;
  prescription_number: string;
  patient_name: string;
  reviewer_id: string;
  reviewer_name: string;
  action: string;
  override_rationale: string | null;
  notes: string | null;
  findings_snapshotted: number;
  created_at: string | null;
}

export interface AuditLogItem {
  id: string;
  timestamp: string | null;
  actor_id: string | null;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
}

export interface WorkflowSummaryResponse {
  prescription_counts_by_status: Record<string, number>;
  total_reviews: number;
  review_counts_by_action: Record<string, number>;
  escalations_pending: number;
  escalations_resolved: number;
  disclaimer: string;
}

export interface EscalationQueueItemResponse {
  escalation_id: string;
  prescription_id: string;
  prescription_number: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  prescriber_name: string;
  prescriber_department: string;
  escalated_by_id: string;
  escalated_by_name: string;
  escalation_reason: string;
  scenario_key: string | null;
  created_at: string;
  findings_count: number;
  has_high_severity_finding: boolean;
}

export interface EscalationResolutionRequest {
  resolution_action:
    | 'APPROVED_BY_CHIEF'
    | 'APPROVED_AFTER_CLARIFICATION'
    | 'REJECTED_RETURNED_TO_PRESCRIBER';
  resolution_notes: string;
}

export interface EscalationResolutionResponse {
  status: string;
  prescription_id: string;
  prescription_number: string;
  escalation_id: string;
  resolution_action: string;
  prescription_status: string;
  resolved_at: string;
  resolved_by: string;
  disclaimer: string;
}

// ---------------------------------------------------------------------------
// 6. Educational Simulation
// ---------------------------------------------------------------------------
export type CaseDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export type StudentDetermination =
  | 'APPROVE'
  | 'REJECT'
  | 'APPROVE_WITH_MONITORING'
  | 'OVERRIDE_WITH_RATIONALE'
  | 'ESCALATE';

export interface EducationalCaseListItem {
  id: string;
  case_code: string;
  title: string;
  difficulty: string;
  category: string;
  learning_objectives: string[];
  completion_status: 'COMPLETED' | 'NOT_ATTEMPTED';
  is_completed: boolean;
  attempts_count: number;
  best_score: number | null;
  disclaimer: string;
}

export interface EducationalCaseDetailResponse {
  id: string;
  case_code: string;
  title: string;
  difficulty: string;
  category: string;
  patient_summary: string;
  prescription_summary: string;
  clinical_scenario: string;
  learning_objectives: string[];
  available_determinations: string[];
  is_completed: boolean;
  attempts_count: number;
  disclaimer: string;
}

export interface StudentSubmissionRequest {
  determination: string;
  reasoning: string;
  identified_issues?: string[];
}

export interface ReferenceRuleFeedback {
  rule_identifier: string;
  rule_name: string;
  category: string;
  severity: string;
  description: string;
  clinical_evidence: string;
}

export interface DetailedFeedback {
  determination_status: 'PREFERRED' | 'ACCEPTABLE_ALTERNATIVE' | 'UNSUPPORTED';
  preferred_determination: string;
  acceptable_alternatives: string[];
  determination_correct: boolean;
  determination_feedback: string;
  expected_determination: string;
  determination_score: number;
  expected_rules: ReferenceRuleFeedback[];
  correctly_identified_issues: string[];
  missed_issues: string[];
  unconfirmed_issues: string[];
  issue_identification_score: number;
  correctly_identified_reasoning_elements: string[];
  missed_reasoning_elements: string[];
  reasoning_feedback: string;
  reasoning_score: number;
  total_score: number;
  is_correct: boolean;
  clinical_rationale: string;
  key_learning_points: string[];
  educational_limitations: string;
  disclaimer: string;
}

export interface StudentSubmissionResponse {
  id: string;
  case_id: string;
  case_code: string;
  case_title: string;
  student_id: string;
  student_name: string;
  submitted_determination: string;
  submitted_reasoning: string;
  is_correct: boolean;
  score_awarded: number;
  predefined_explanation?: string | null;
  feedback: DetailedFeedback;
  submitted_at: string;
  attempt_number: number;
  disclaimer: string;
}

export interface StudentSubmissionListItem {
  id: string;
  case_id: string;
  case_code: string;
  case_title: string;
  difficulty: string;
  category: string;
  submitted_determination: string;
  is_correct: boolean;
  score_awarded: number;
  submitted_at: string;
  attempt_number: number;
}

