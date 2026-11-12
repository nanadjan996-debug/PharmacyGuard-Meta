import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../App';
import { StudentSimulationWorkspace } from './StudentSimulationWorkspace';
import { Stage1WorkspaceShell } from '../dashboard/Stage1WorkspaceShell';
import { AuthContextType } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  UserProfileResponse,
  EducationalCaseListItem,
  EducationalCaseDetailResponse,
  StudentSubmissionResponse,
  StudentSubmissionListItem,
  ChiefOversightDashboardResponse,
} from '../../types/api';

// Mock Users
const mockStudentUser: UserProfileResponse = {
  id: 'usr-student-001',
  username: 'student.taylor',
  email: 'jordan.taylor@pharmacyguard.internal',
  full_name: 'Jordan Taylor',
  is_active: true,
  roles: ['pharmacy_student'],
};

const mockStaffUser: UserProfileResponse = {
  id: 'usr-staff-001',
  username: 'staff.mercer',
  email: 'alex.mercer@pharmacyguard.internal',
  full_name: 'Alex Mercer',
  is_active: true,
  roles: ['staff_pharmacist'],
};

const mockChiefUser: UserProfileResponse = {
  id: 'usr-chief-001',
  username: 'chief.lin',
  email: 'sarah.lin@pharmacyguard.internal',
  full_name: 'Dr. Sarah Lin',
  is_active: true,
  roles: ['chief_pharmacist', 'staff_pharmacist'],
};

const createMockAuth = (user: UserProfileResponse): AuthContextType => ({
  user,
  token: 'mock-test-token',
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  switchRole: vi.fn(),
  clearError: vi.fn(),
  hasRole: (r: string) => user.roles.includes(r as any),
});

const mockCasesList: EducationalCaseListItem[] = [
  {
    id: 'case-beg-01-uuid',
    case_code: 'CASE-BEG-01',
    title: 'Severe Penicillin Allergy with Beta-Lactam Order',
    difficulty: 'BEGINNER',
    category: 'ALLERGY_CROSS_REACTIVITY',
    learning_objectives: ['Identify cross-reactivity risks'],
    completion_status: 'NOT_ATTEMPTED',
    is_completed: false,
    attempts_count: 0,
    best_score: null,
    disclaimer: 'Advisory prototype educational case.',
  },
  {
    id: 'case-adv-01-uuid',
    case_code: 'CASE-ADV-01',
    title: 'Severe Digoxin - Amiodarone Interaction with Hypokalemia',
    difficulty: 'ADVANCED',
    category: 'DRUG_INTERACTION',
    learning_objectives: ['Analyze pharmacokinetic toxicity multiplication'],
    completion_status: 'COMPLETED',
    is_completed: true,
    attempts_count: 1,
    best_score: 88,
    disclaimer: 'Advisory prototype educational case.',
  },
];

const mockCaseDetail: EducationalCaseDetailResponse = {
  id: 'case-beg-01-uuid',
  case_code: 'CASE-BEG-01',
  title: 'Severe Penicillin Allergy with Beta-Lactam Order',
  difficulty: 'BEGINNER',
  category: 'ALLERGY_CROSS_REACTIVITY',
  patient_summary: 'Patient: Jane Doe, 42 yo female. History: Penicillin anaphylaxis.',
  prescription_summary: 'Amoxicillin 500 mg PO TID x 10 days',
  clinical_scenario: 'Patient presents with severe sinusitis. Allergy chart indicates previous anaphylaxis.',
  learning_objectives: ['Identify cross-reactivity risks'],
  available_determinations: ['REJECT', 'ESCALATE', 'APPROVE_WITH_MONITORING'],
  is_completed: false,
  attempts_count: 0,
  disclaimer: 'Advisory simulation case.',
};

const mockSubmissionResult: StudentSubmissionResponse = {
  id: 'sub-new-001',
  case_id: 'case-beg-01-uuid',
  case_code: 'CASE-BEG-01',
  case_title: 'Severe Penicillin Allergy with Beta-Lactam Order',
  student_id: 'usr-student-001',
  student_name: 'Jordan Taylor',
  submitted_determination: 'REJECT',
  submitted_reasoning:
    'Documented IgE anaphylaxis to penicillin contraindicates amoxicillin due to shared beta-lactam core structure.',
  is_correct: true,
  score_awarded: 95,
  predefined_explanation: 'Amoxicillin is contraindicated in severe penicillin allergy.',
  feedback: {
    determination_status: 'PREFERRED',
    preferred_determination: 'REJECT',
    acceptable_alternatives: ['ESCALATE'],
    determination_correct: true,
    determination_feedback: 'Optimal determination selected.',
    expected_determination: 'REJECT',
    determination_score: 50,
    expected_rules: [
      {
        rule_identifier: 'RULE-ALG-PEN-01',
        rule_name: 'Severe Penicillin IgE Cross-Reactivity Rule',
        category: 'ALLERGY',
        severity: 'HIGH',
        description: 'Prescribed Amoxicillin in patient with verified anaphylaxis to Penicillin.',
        clinical_evidence: 'Shared beta-lactam core induces severe IgE cross-reactivity.',
      },
    ],
    correctly_identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
    missed_issues: [],
    unconfirmed_issues: [],
    issue_identification_score: 30,
    correctly_identified_reasoning_elements: ['BETA_LACTAM_CORE', 'ANAPHYLAXIS_HISTORY'],
    missed_reasoning_elements: [],
    reasoning_feedback: 'Flawless pharmacologic and clinical rationale.',
    reasoning_score: 15,
    total_score: 95,
    is_correct: true,
    clinical_rationale: 'Beta-lactam antibiotics share structural determinants that trigger IgE-mediated anaphylaxis.',
    key_learning_points: ['Recognize structural beta-lactam ring cross-reactivity'],
    educational_limitations: 'Advisory benchmark prototype.',
    disclaimer: 'Advisory educational simulation benchmark only.',
  },
  submitted_at: '2026-11-01T09:00:00Z',
  attempt_number: 1,
  disclaimer: 'Advisory educational simulation prototype.',
};

const mockHistoricalSubmissions: StudentSubmissionListItem[] = [
  {
    id: 'sub-new-001',
    case_id: 'case-beg-01-uuid',
    case_code: 'CASE-BEG-01',
    case_title: 'Severe Penicillin Allergy with Beta-Lactam Order',
    difficulty: 'BEGINNER',
    category: 'ALLERGY_CROSS_REACTIVITY',
    submitted_determination: 'REJECT',
    is_correct: true,
    score_awarded: 95,
    submitted_at: '2026-11-01T09:00:00Z',
    attempt_number: 1,
  },
];

const mockChiefDashboard: ChiefOversightDashboardResponse = {
  inventory_summary: {
    total_items: 25,
    total_units_on_hand: 5000,
    low_stock_count: 2,
    out_of_stock_count: 0,
    adequate_stock_count: 23,
    total_inventory_value_cents: 1540000,
    disclaimer: 'Advisory inventory valuation.',
  },
  inventory_exceptions: [],
  workflow_counts: {
    pending: 5,
    reviewed: 40,
    escalated: 2,
  },
  pending_escalations_count: 2,
  total_overrides_count: 4,
  recent_audit_events: [],
  disclaimer: 'Advisory chief oversight dashboard.',
};

describe('PharmacyGuard Stage 4: Student Simulation Workspace Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/?workspace=student');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  // =========================================================================
  // 1. Navigation & View Outlets
  // =========================================================================
  it('renders student simulation workspace tab navigation and defaults to Case Catalog', async () => {
    vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCasesList);

    render(<StudentSimulationWorkspace />);

    expect(screen.getByTestId('student-simulation-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('student-tab-catalog')).toBeInTheDocument();
    expect(screen.getByTestId('student-tab-assessment')).toBeInTheDocument();
    expect(screen.getByTestId('student-tab-results')).toBeInTheDocument();
    expect(screen.getByTestId('student-tab-history')).toBeInTheDocument();

    // Catalog is the active view initially
    await waitFor(() => {
      expect(screen.getByTestId('student-case-catalog')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
    });
  });

  it('renders fallback prompt when navigating to Assessment Studio without selecting a case', () => {
    render(<StudentSimulationWorkspace initialTab="assessment" initialCaseId={null} />);

    expect(screen.getByTestId('student-no-case-selected')).toBeInTheDocument();
    expect(screen.getByText(/No Case Selected for Assessment/i)).toBeInTheDocument();

    // Clicking prompt button takes student back to catalog
    fireEvent.click(screen.getByTestId('select-case-prompt-btn'));
    expect(screen.getByTestId('student-case-catalog')).toBeInTheDocument();
  });

  it('renders fallback prompt when navigating to Evaluation Results without an active submission in session', () => {
    render(<StudentSimulationWorkspace initialTab="results" />);

    expect(screen.getByTestId('student-no-results-selected')).toBeInTheDocument();
    expect(screen.getByText(/No Evaluation Results in Active Session/i)).toBeInTheDocument();
  });

  // =========================================================================
  // 2. End-to-End Required Workflow:
  // Catalog -> Select Case -> Assessment -> Submit -> Results -> History -> Inspect -> Retake
  // =========================================================================
  it('executes full required student simulation workflow seamlessly', async () => {
    // 1. Setup API mocks
    vi.spyOn(api.education, 'listCases').mockResolvedValue(mockCasesList);
    vi.spyOn(api.education, 'getCaseDetail').mockResolvedValue(mockCaseDetail);
    vi.spyOn(api.education, 'submitAssessment').mockResolvedValue(mockSubmissionResult);
    vi.spyOn(api.education, 'listSubmissions').mockResolvedValue(mockHistoricalSubmissions);
    vi.spyOn(api.education, 'getSubmissionDetail').mockResolvedValue(mockSubmissionResult);

    render(<StudentSimulationWorkspace />);

    // STEP 1: Case Catalog is displayed
    await waitFor(() => {
      expect(screen.getByTestId('student-case-catalog')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
    });

    // STEP 2: Select Case (CASE-BEG-01) by clicking "Start Assessment"
    const startBtns = screen.getAllByRole('button', { name: /Start Assessment/i });
    fireEvent.click(startBtns[0]);

    // STEP 3: Assessment Studio loads with genuine case details
    await waitFor(() => {
      expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
    });
    expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();

    // STEP 4: Complete and submit assessment
    // Select REJECT determination
    const rejectRadio = screen.getByTestId('determination-option-REJECT');
    fireEvent.click(rejectRadio);

    // Toggle Allergy Cross-Reactivity issue
    const allergyIssue = screen.getByTestId('issue-option-ALLERGY_CROSS_REACTIVITY');
    fireEvent.click(allergyIssue);

    // Enter clinical reasoning (>= 10 chars)
    const reasoningInput = screen.getByTestId('student-reasoning-textarea');
    fireEvent.change(reasoningInput, {
      target: {
        value: 'Documented IgE anaphylaxis to penicillin contraindicates amoxicillin due to shared beta-lactam core.',
      },
    });

    // Click submit button
    const submitBtn = screen.getByTestId('submit-assessment-button');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    // STEP 5: Automatically navigates to Evaluation Results view
    await waitFor(() => {
      expect(screen.getByTestId('overall-score')).toBeInTheDocument();
    });

    // Verify uncalculated server scores
    expect(screen.getByTestId('overall-score')).toHaveTextContent('95');
    expect(screen.getByTestId('score-determination')).toHaveTextContent('50 / 50 pts');
    expect(screen.getByTestId('score-issues')).toHaveTextContent('30 / 30 pts');
    expect(screen.getByTestId('score-reasoning')).toHaveTextContent('15 / 20 pts');
    expect(screen.getByTestId('correctly-identified-issues')).toHaveTextContent('ALLERGY CROSS REACTIVITY');
    expect(screen.getByTestId('expert-clinical-rationale')).toHaveTextContent(/Beta-lactam antibiotics share structural determinants/);

    // STEP 6: Navigate to Submission History
    const historyBtn = screen.getByTestId('results-history-button');
    fireEvent.click(historyBtn);

    await waitFor(() => {
      expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
    });
    const table = screen.getByTestId('submissions-table');
    expect(within(table).getByText('CASE-BEG-01')).toBeInTheDocument();
    expect(within(table).getByText('95 / 100')).toBeInTheDocument();

    // STEP 7: Inspect previous attempt in detail modal
    const inspectBtn = screen.getByTestId('inspect-submission-btn-sub-new-001');
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByTestId('inspection-modal-content')).toBeInTheDocument();
    });
    expect(screen.getByTestId('modal-total-score')).toHaveTextContent('95 / 100');
    expect(screen.getByTestId('modal-retake-case-btn')).toBeInTheDocument();

    // STEP 8: Retake Case directly from modal
    fireEvent.click(screen.getByTestId('modal-retake-case-btn'));

    // Should return to Assessment Studio with case loaded
    await waitFor(() => {
      expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
    });
  }, 20000);

  // =========================================================================
  // 3. Stage1WorkspaceShell Integration & Workstation Branding
  // =========================================================================
  it('mounts StudentSimulationWorkspace inside Stage1WorkspaceShell for pharmacy_student role', async () => {
    vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCasesList);

    const authModule = await import('../../context/AuthContext');
    vi.spyOn(authModule, 'useAuth').mockReturnValue(createMockAuth(mockStudentUser));

    render(<Stage1WorkspaceShell workspace="student" />);

    // Check workstation header and Stage 4 badge
    expect(screen.getByRole('heading', { level: 2, name: /Pharmacy Student Workstation/i })).toBeInTheDocument();
    expect(screen.getByText('Stage 4 Student Simulation Lab')).toBeInTheDocument();

    // Check student simulation workspace is rendered
    expect(screen.getByTestId('student-simulation-workspace')).toBeInTheDocument();
  });

  it('preserves Staff Pharmacist Stage 2 workstation in Stage1WorkspaceShell without regressions', async () => {
    vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValueOnce([]);

    const authModule = await import('../../context/AuthContext');
    vi.spyOn(authModule, 'useAuth').mockReturnValue(createMockAuth(mockStaffUser));

    render(<Stage1WorkspaceShell workspace="staff" />);

    expect(screen.getByRole('heading', { level: 2, name: /Staff Pharmacist Workstation/i })).toBeInTheDocument();
    expect(screen.getByText('Stage 2 Workstation')).toBeInTheDocument();
    // Does not render student workspace
    expect(screen.queryByTestId('student-simulation-workspace')).not.toBeInTheDocument();
  });

  it('preserves Chief Pharmacist Stage 3 oversight workstation in Stage1WorkspaceShell without regressions', async () => {
    vi.spyOn(api.oversight, 'getDashboard').mockResolvedValueOnce(mockChiefDashboard);

    const authModule = await import('../../context/AuthContext');
    vi.spyOn(authModule, 'useAuth').mockReturnValue(createMockAuth(mockChiefUser));

    render(<Stage1WorkspaceShell workspace="chief" />);

    expect(screen.getByRole('heading', { level: 2, name: /Chief Pharmacist Workstation/i })).toBeInTheDocument();
    expect(screen.getByText('Stage 3 Oversight Workstation')).toBeInTheDocument();
    expect(screen.getByTestId('chief-oversight-workspace')).toBeInTheDocument();
    // Does not render student workspace
    expect(screen.queryByTestId('student-simulation-workspace')).not.toBeInTheDocument();
  });

  // =========================================================================
  // 4. Deep-linking, Query Synchronization & Boundary Role Guards
  // =========================================================================
  it('initializes directly into Assessment Studio when deep-linked via URL parameters', async () => {
    window.history.pushState({}, '', '/?workspace=student&tab=assessment&case=CASE-BEG-01');
    vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

    render(<StudentSimulationWorkspace />);

    await waitFor(() => {
      expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
    });
  });

  it('initializes directly into Submission History when deep-linked via URL parameters', async () => {
    window.history.pushState({}, '', '/?workspace=student&tab=history');
    vi.spyOn(api.education, 'listSubmissions').mockResolvedValueOnce(mockHistoricalSubmissions);

    render(<StudentSimulationWorkspace />);

    await waitFor(() => {
      expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
    });
  });

  it('displays AccessDeniedView when Pharmacy Student navigates to operational Chief workspace (?workspace=chief)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'student-token');
    window.history.pushState({}, '', '/?workspace=chief');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStudentUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
    });
  });

  it('displays AccessDeniedView when Pharmacy Student navigates to operational Staff workspace (?workspace=staff)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'student-token');
    window.history.pushState({}, '', '/?workspace=staff');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStudentUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
    });
  });
});
