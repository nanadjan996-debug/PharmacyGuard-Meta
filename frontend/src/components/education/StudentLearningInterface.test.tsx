import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaseCatalog } from './CaseCatalog';
import { AssessmentStudio } from './AssessmentStudio';
import { api, ApiError } from '../../services/api';
import {
  EducationalCaseListItem,
  EducationalCaseDetailResponse,
  StudentSubmissionResponse,
} from '../../types/api';

const mockCatalogCases: EducationalCaseListItem[] = [
  {
    id: 'case-beg-01-uuid',
    case_code: 'CASE-BEG-01',
    title: 'Severe Penicillin Allergy with Beta-Lactam Order',
    difficulty: 'BEGINNER',
    category: 'ALLERGY_CROSS_REACTIVITY',
    learning_objectives: [
      'Identify beta-lactam class cross-reactivity in patients with severe penicillin allergy',
      'Recognize absolute contraindications requiring immediate prescription rejection',
    ],
    completion_status: 'COMPLETED',
    is_completed: true,
    attempts_count: 2,
    best_score: 95,
    disclaimer: 'Advisory educational simulation prototype.',
  },
  {
    id: 'case-int-01-uuid',
    case_code: 'CASE-INT-01',
    title: 'Therapeutic Duplication: Dual NSAIDs in Post-Operative Patient',
    difficulty: 'INTERMEDIATE',
    category: 'DUPLICATE_THERAPY',
    learning_objectives: [
      'Detect therapeutic duplication across non-identical chemical entities in the same drug class',
      'Understand the ceiling effect and compounded toxicity of systemic NSAIDs',
    ],
    completion_status: 'NOT_ATTEMPTED',
    is_completed: false,
    attempts_count: 0,
    best_score: null,
    disclaimer: 'Advisory educational simulation prototype.',
  },
  {
    id: 'case-adv-01-uuid',
    case_code: 'CASE-ADV-01',
    title: 'Missing Indication and Severe Renal Impairment Dosing Conflict',
    difficulty: 'ADVANCED',
    category: 'RENAL_DOSING_INDICATION',
    learning_objectives: [
      'Reconcile prescribed medications against documented active diagnostic problem lists',
      'Evaluate renal clearance parameters (eGFR) against drug monograph dosage limits',
    ],
    completion_status: 'NOT_ATTEMPTED',
    is_completed: false,
    attempts_count: 0,
    best_score: null,
    disclaimer: 'Advisory educational simulation prototype.',
  },
];

const mockCaseDetail: EducationalCaseDetailResponse = {
  id: 'case-beg-01-uuid',
  case_code: 'CASE-BEG-01',
  title: 'Severe Penicillin Allergy with Beta-Lactam Order',
  difficulty: 'BEGINNER',
  category: 'ALLERGY_CROSS_REACTIVITY',
  patient_summary:
    'Patient: John Doe, 54 yo male\nHistory: Documented severe penicillin anaphylaxis with ICU admission.',
  prescription_summary:
    'Rx: Amoxicillin 500mg PO TID for 10 days\nPrescriber: Dr. Angela Miller (Emergency Medicine)',
  clinical_scenario:
    'Patient presented with acute bacterial sinusitis. Prescriber issued amoxicillin 500mg without reconciling the penicillin allergy history.',
  learning_objectives: [
    'Identify beta-lactam class cross-reactivity in patients with severe penicillin allergy',
    'Recognize absolute contraindications requiring immediate prescription rejection',
  ],
  available_determinations: [
    'APPROVE',
    'REJECT',
    'APPROVE_WITH_MONITORING',
    'OVERRIDE_WITH_RATIONALE',
    'ESCALATE',
  ],
  is_completed: false,
  attempts_count: 1,
  disclaimer: 'Advisory educational simulation prototype. Synthetic training benchmark only.',
};

describe('PharmacyGuard Stage 4: Student Learning Interface (Prompt 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Part A: Case Catalog Tests
  // =========================================================================
  describe('Part A — CaseCatalog Component', () => {
    it('retrieves and renders case catalog with real attributes, difficulty badges, and metrics', async () => {
      vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCatalogCases);
      const onSelectCase = vi.fn();

      render(<CaseCatalog onSelectCase={onSelectCase} />);

      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('cases-grid')).toBeInTheDocument();
      });

      // Verify case cards render
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
      expect(screen.getByText('CASE-ADV-01')).toBeInTheDocument();

      // Verify attempt and score information on completed case
      expect(screen.getByText('2 attempts')).toBeInTheDocument();
      expect(screen.getByText('Best: 95/100')).toBeInTheDocument();

      // Verify learning objectives
      expect(
        screen.getByText(/Identify beta-lactam class cross-reactivity/)
      ).toBeInTheDocument();
    });

    it('filters cases by difficulty level (BEGINNER, INTERMEDIATE, ADVANCED)', async () => {
      vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCatalogCases);
      render(<CaseCatalog onSelectCase={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      });

      // Click Beginner filter
      fireEvent.click(screen.getByRole('button', { name: 'Beginner' }));
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.queryByText('CASE-INT-01')).not.toBeInTheDocument();
      expect(screen.queryByText('CASE-ADV-01')).not.toBeInTheDocument();

      // Click Intermediate filter
      fireEvent.click(screen.getByRole('button', { name: 'Intermediate' }));
      expect(screen.queryByText('CASE-BEG-01')).not.toBeInTheDocument();
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
      expect(screen.queryByText('CASE-ADV-01')).not.toBeInTheDocument();

      // Click Advanced filter
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
      expect(screen.queryByText('CASE-BEG-01')).not.toBeInTheDocument();
      expect(screen.queryByText('CASE-INT-01')).not.toBeInTheDocument();
      expect(screen.getByText('CASE-ADV-01')).toBeInTheDocument();

      // Reset to All Tiers
      fireEvent.click(screen.getByRole('button', { name: 'All Tiers' }));
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
      expect(screen.getByText('CASE-ADV-01')).toBeInTheDocument();
    });

    it('filters cases by completion status using actual backend fields', async () => {
      vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCatalogCases);
      render(<CaseCatalog onSelectCase={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      });

      // Filter by Completed
      fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.queryByText('CASE-INT-01')).not.toBeInTheDocument();
      expect(screen.queryByText('CASE-ADV-01')).not.toBeInTheDocument();

      // Filter by Not Attempted
      fireEvent.click(screen.getByRole('button', { name: 'Not Attempted' }));
      expect(screen.queryByText('CASE-BEG-01')).not.toBeInTheDocument();
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
      expect(screen.getByText('CASE-ADV-01')).toBeInTheDocument();
    });

    it('displays empty state when search filters yield zero results and supports clearing filters', async () => {
      vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCatalogCases);
      render(<CaseCatalog onSelectCase={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      });

      const searchInput = screen.getByLabelText('Search educational cases');
      fireEvent.change(searchInput, { target: { value: 'NonexistentCondition' } });

      expect(screen.getByText('No Cases Match Active Filters')).toBeInTheDocument();
      expect(screen.queryByText('CASE-BEG-01')).not.toBeInTheDocument();

      // Click Clear All Filters
      fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
    });

    it('displays error state on API failure and supports retry', async () => {
      vi.spyOn(api.education, 'listCases')
        .mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'))
        .mockResolvedValueOnce(mockCatalogCases);

      render(<CaseCatalog onSelectCase={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/Failed to Load Simulation Cases/)).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /Retry Connection/i }));

      await waitFor(() => {
        expect(screen.getByTestId('cases-grid')).toBeInTheDocument();
      });
      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
    });

    it('triggers onSelectCase callback with correct case id when action button clicked', async () => {
      vi.spyOn(api.education, 'listCases').mockResolvedValueOnce(mockCatalogCases);
      const onSelectCase = vi.fn();

      render(<CaseCatalog onSelectCase={onSelectCase} />);

      await waitFor(() => {
        expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      });

      // Completed case has "Retake Case"
      const retakeBtn = screen.getByRole('button', { name: /Retake Case/i });
      fireEvent.click(retakeBtn);
      expect(onSelectCase).toHaveBeenCalledWith('case-beg-01-uuid');

      // Uncompleted case has "Start Assessment"
      const startBtns = screen.getAllByRole('button', { name: /Start Assessment/i });
      fireEvent.click(startBtns[0]);
      expect(onSelectCase).toHaveBeenCalledWith('case-int-01-uuid');
    });
  });

  // =========================================================================
  // Part B: Assessment Studio Tests
  // =========================================================================
  describe('Part B — AssessmentStudio Component', () => {
    it('retrieves and displays actual synthetic clinical presentation, patient summary, and order details', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      expect(screen.getByTestId('assessment-studio-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      expect(screen.getByText('CASE-BEG-01')).toBeInTheDocument();
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
      expect(screen.getByText(/Documented severe penicillin anaphylaxis/)).toBeInTheDocument();
      expect(screen.getByText(/Amoxicillin 500mg PO TID/)).toBeInTheDocument();
      expect(screen.getByText(/Patient presented with acute bacterial sinusitis/)).toBeInTheDocument();
    });

    it('strictly preserves academic integrity and does not reveal preferred answers or rubrics before submission', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      // Ensure no scoring or ideal answer leaks
      expect(screen.queryByText(/Preferred determination:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Points awarded/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Rubric score/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/RULE-ALG-PEN-01/i)).not.toBeInTheDocument();
    });

    it('dynamically renders determination selector from available_determinations', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      // All 5 dynamic determinations must be present
      expect(screen.getByTestId('determination-option-REJECT')).toBeInTheDocument();
      expect(screen.getByTestId('determination-option-APPROVE')).toBeInTheDocument();
      expect(screen.getByTestId('determination-option-ESCALATE')).toBeInTheDocument();
      expect(screen.getByTestId('determination-option-APPROVE_WITH_MONITORING')).toBeInTheDocument();
      expect(screen.getByTestId('determination-option-OVERRIDE_WITH_RATIONALE')).toBeInTheDocument();

      // Click REJECT
      const rejectOption = screen.getByTestId('determination-option-REJECT');
      fireEvent.click(rejectOption);
      expect(rejectOption).toHaveAttribute('aria-checked', 'true');
    });

    it('supports selecting and toggling clinical issue categories', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      const allergyOption = screen.getByTestId('issue-option-ALLERGY_CROSS_REACTIVITY');
      expect(screen.getByText('0 selected')).toBeInTheDocument();

      // Toggle ON
      fireEvent.click(allergyOption);
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      // Toggle OFF
      fireEvent.click(allergyOption);
      expect(screen.getByText('0 selected')).toBeInTheDocument();
    });

    it('enforces minimum 10-character clinical reasoning and disables submit until satisfied', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      const submitBtn = screen.getByTestId('submit-assessment-button');
      const textarea = screen.getByTestId('student-reasoning-textarea');
      const charCounter = screen.getByTestId('reasoning-character-counter');

      // 1. Initially disabled
      expect(submitBtn).toBeDisabled();
      expect(charCounter).toHaveTextContent('0 characters (min 10)');

      // 2. Select determination only -> still disabled
      fireEvent.click(screen.getByTestId('determination-option-REJECT'));
      expect(submitBtn).toBeDisabled();

      // 3. Short reasoning (<10 chars) -> still disabled
      fireEvent.change(textarea, { target: { value: 'short' } });
      expect(charCounter).toHaveTextContent('5 characters (min 10)');
      expect(submitBtn).toBeDisabled();
      expect(
        screen.getByText(/Please write at least 10 non-whitespace characters/)
      ).toBeInTheDocument();

      // 4. Valid reasoning (>= 10 chars) -> enabled
      fireEvent.change(textarea, {
        target: { value: 'Absolute contraindication due to severe penicillin anaphylaxis.' },
      });
      expect(charCounter).toHaveTextContent(/characters \(min 10\)/);
      expect(submitBtn).toBeEnabled();
    });

    it('submits assessment successfully and invokes onSubmitted with server response', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      const mockSubmitResponse: StudentSubmissionResponse = {
        id: 'sub-new-uuid',
        case_id: 'case-beg-01-uuid',
        case_code: 'CASE-BEG-01',
        case_title: 'Severe Penicillin Allergy with Beta-Lactam Order',
        student_id: 'usr-student-001',
        student_name: 'Jordan Taylor',
        submitted_determination: 'REJECT',
        submitted_reasoning: 'Absolute contraindication due to severe penicillin anaphylaxis history.',
        is_correct: true,
        score_awarded: 100,
        predefined_explanation: 'Amoxicillin is an amino-penicillin sharing the beta-lactam core.',
        feedback: {
          determination_status: 'PREFERRED',
          preferred_determination: 'REJECT',
          acceptable_alternatives: ['ESCALATE'],
          determination_correct: true,
          determination_feedback: 'Optimal determination.',
          expected_determination: 'REJECT',
          determination_score: 50,
          expected_rules: [],
          correctly_identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
          missed_issues: [],
          unconfirmed_issues: [],
          issue_identification_score: 30,
          correctly_identified_reasoning_elements: ['BETA_LACTAM_STRUCTURE'],
          missed_reasoning_elements: [],
          reasoning_feedback: 'Excellent clinical rationale.',
          reasoning_score: 20,
          total_score: 100,
          is_correct: true,
          clinical_rationale: 'Expert clinical rationale.',
          key_learning_points: ['Point 1'],
          educational_limitations: 'Advisory prototype',
          disclaimer: 'Advisory educational simulation prototype.',
        },
        submitted_at: '2026-11-01T04:45:00Z',
        attempt_number: 2,
        disclaimer: 'Advisory educational simulation prototype.',
      };

      const submitSpy = vi.spyOn(api.education, 'submitAssessment').mockResolvedValueOnce(mockSubmitResponse);
      const onSubmitted = vi.fn();

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={onSubmitted}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      // Fill form
      fireEvent.click(screen.getByTestId('determination-option-REJECT'));
      fireEvent.click(screen.getByTestId('issue-option-ALLERGY_CROSS_REACTIVITY'));
      fireEvent.change(screen.getByTestId('student-reasoning-textarea'), {
        target: { value: 'Absolute contraindication due to severe penicillin anaphylaxis history.' },
      });

      // Submit form
      fireEvent.click(screen.getByTestId('submit-assessment-button'));

      await waitFor(() => {
        expect(submitSpy).toHaveBeenCalledWith('CASE-BEG-01', {
          determination: 'REJECT',
          reasoning: 'Absolute contraindication due to severe penicillin anaphylaxis history.',
          identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
        });
        expect(onSubmitted).toHaveBeenCalledWith(mockSubmitResponse);
      });
    });

    it('prevents duplicate submissions while request is in flight', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);

      let resolveSubmit: (val: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveSubmit = resolve;
      });
      vi.spyOn(api.education, 'submitAssessment').mockReturnValueOnce(pendingPromise as any);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('determination-option-REJECT'));
      fireEvent.change(screen.getByTestId('student-reasoning-textarea'), {
        target: { value: 'Valid clinical reasoning documentation.' },
      });

      const submitBtn = screen.getByTestId('submit-assessment-button');
      fireEvent.click(submitBtn);

      // Button must be disabled and showing loading state while in-flight
      expect(submitBtn).toBeDisabled();

      // Resolve submit
      resolveSubmit!({ id: 'done' });
    });

    it('displays error message when submission fails with HTTP 403 Forbidden', async () => {
      vi.spyOn(api.education, 'getCaseDetail').mockResolvedValueOnce(mockCaseDetail);
      vi.spyOn(api.education, 'submitAssessment').mockRejectedValueOnce(
        new ApiError(403, 'Forbidden: action requires one of the following roles: pharmacy_student')
      );

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('determination-option-REJECT'));
      fireEvent.change(screen.getByTestId('student-reasoning-textarea'), {
        target: { value: 'Valid clinical reasoning text exceeding 10 characters.' },
      });

      fireEvent.click(screen.getByTestId('submit-assessment-button'));

      await waitFor(() => {
        expect(screen.getByTestId('submit-error-alert')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Forbidden: only accounts with the Pharmacy Student role may submit assessments/)
      ).toBeInTheDocument();
    });

    it('displays error state when case detail fails to load and allows retry', async () => {
      vi.spyOn(api.education, 'getCaseDetail')
        .mockRejectedValueOnce(new ApiError(404, 'Case not found'))
        .mockResolvedValueOnce(mockCaseDetail);

      render(
        <AssessmentStudio
          caseId="CASE-BEG-01"
          onBackToList={vi.fn()}
          onSubmitted={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio-error')).toBeInTheDocument();
      });

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /Retry Connection/i }));

      await waitFor(() => {
        expect(screen.getByTestId('assessment-studio')).toBeInTheDocument();
      });
      expect(screen.getByText('Severe Penicillin Allergy with Beta-Lactam Order')).toBeInTheDocument();
    });
  });
});

