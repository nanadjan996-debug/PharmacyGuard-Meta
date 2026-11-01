import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvaluationResultsView } from './EvaluationResultsView';
import { StudentSubmissionHistory } from './StudentSubmissionHistory';
import { api, ApiError } from '../../services/api';
import {
  StudentSubmissionResponse,
  StudentSubmissionListItem,
} from '../../types/api';

const mockFullSubmission: StudentSubmissionResponse = {
  id: 'sub-test-001',
  case_id: 'case-beg-01-uuid',
  case_code: 'CASE-BEG-01',
  case_title: 'Severe Penicillin Allergy with Beta-Lactam Order',
  student_id: 'usr-student-001',
  student_name: 'Jordan Taylor',
  submitted_determination: 'REJECT',
  submitted_reasoning:
    'Amoxicillin is an amino-penicillin sharing the beta-lactam core. Absolute contraindication in documented IgE anaphylaxis.',
  is_correct: true,
  score_awarded: 93,
  predefined_explanation: 'Amoxicillin is contraindicated in severe penicillin allergy.',
  feedback: {
    determination_status: 'PREFERRED',
    preferred_determination: 'REJECT',
    acceptable_alternatives: ['ESCALATE'],
    determination_correct: true,
    determination_feedback: 'Appropriately selected REJECT as the primary clinical action.',
    expected_determination: 'REJECT',
    determination_score: 50,
    expected_rules: [
      {
        rule_identifier: 'RULE-ALG-PEN-01',
        rule_name: 'Severe Penicillin IgE Cross-Reactivity Rule',
        category: 'ALLERGY',
        severity: 'HIGH',
        description: 'Prescribed Amoxicillin in patient with verified anaphylaxis to Penicillin.',
        clinical_evidence:
          'Sharing the beta-lactam core structure creates life-threatening IgE cross-reactivity.',
      },
    ],
    correctly_identified_issues: ['ALLERGY_CROSS_REACTIVITY'],
    missed_issues: [],
    unconfirmed_issues: ['DUPLICATE_THERAPY'],
    issue_identification_score: 25,
    correctly_identified_reasoning_elements: ['BETA_LACTAM_STRUCTURE', 'SEVERE_ANAPHYLAXIS_HISTORY'],
    missed_reasoning_elements: ['CONTRAINDICATION_AND_ACTION'],
    reasoning_feedback: 'Strong pharmacology rationale articulated clearly.',
    reasoning_score: 18,
    total_score: 93,
    is_correct: true,
    clinical_rationale:
      'Beta-lactam antibiotics share structural determinants that trigger IgE-mediated anaphylaxis. An alternative non-beta-lactam agent such as azithromycin or levofloxacin is indicated.',
    key_learning_points: [
      'Recognize structural beta-lactam ring cross-reactivity',
      'Never override verified IgE anaphylaxis with direct penicillins',
      'Recommend safe non-cross-reactive alternatives',
    ],
    educational_limitations: 'Advisory prototype benchmark.',
    disclaimer: 'Advisory educational simulation prototype. Synthetic training benchmark only.',
  },
  submitted_at: '2026-11-01T04:30:00Z',
  attempt_number: 1,
  disclaimer: 'Advisory educational simulation prototype.',
};

const mockSubmissionsList: StudentSubmissionListItem[] = [
  {
    id: 'sub-list-002',
    case_id: 'case-int-01-uuid',
    case_code: 'CASE-INT-01',
    case_title: 'Therapeutic Duplication: Dual NSAIDs',
    difficulty: 'INTERMEDIATE',
    category: 'DUPLICATE_THERAPY',
    submitted_determination: 'REJECT',
    is_correct: true,
    score_awarded: 85,
    submitted_at: '2026-11-01T04:45:00Z',
    attempt_number: 1,
  },
  {
    id: 'sub-list-001',
    case_id: 'case-beg-01-uuid',
    case_code: 'CASE-BEG-01',
    case_title: 'Severe Penicillin Allergy with Beta-Lactam Order',
    difficulty: 'BEGINNER',
    category: 'ALLERGY_CROSS_REACTIVITY',
    submitted_determination: 'APPROVE',
    is_correct: false,
    score_awarded: 35,
    submitted_at: '2026-11-01T04:15:00Z',
    attempt_number: 1,
  },
];

describe('PharmacyGuard Stage 4: Evaluation Results and Student Submission History (Prompt 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // PART A: Evaluation Results Tests
  // =========================================================================
  describe('Part A — EvaluationResultsView Component', () => {
    it('renders accurate overall score out of 100 without client-side recalculation', () => {
      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      const scoreEl = screen.getByTestId('overall-score');
      expect(scoreEl).toHaveTextContent('93');
      expect(scoreEl).toHaveTextContent('/ 100');
      expect(screen.getByText('Clinical Mastery Achieved')).toBeInTheDocument();
    });

    it('renders the correct 50/30/20 rubric breakdown for determination, issues, and reasoning', () => {
      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      expect(screen.getByTestId('score-determination')).toHaveTextContent('50 / 50 pts');
      expect(screen.getByTestId('score-issues')).toHaveTextContent('25 / 30 pts');
      expect(screen.getByTestId('score-reasoning')).toHaveTextContent('18 / 20 pts');
    });

    it('renders correctly identified, missed, and unconfirmed/incorrectly selected issues', () => {
      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      // Correctly identified
      const correctSection = screen.getByTestId('correctly-identified-issues');
      expect(correctSection).toHaveTextContent('ALLERGY CROSS REACTIVITY');

      // Unconfirmed / false-positive selections
      const unconfirmedSection = screen.getByTestId('unconfirmed-issues');
      expect(unconfirmedSection).toHaveTextContent('DUPLICATE THERAPY');
    });

    it('renders missed clinical issues when returned in feedback', () => {
      const submissionWithMissed = {
        ...mockFullSubmission,
        feedback: {
          ...mockFullSubmission.feedback,
          missed_issues: ['DOSAGE_ADJUSTMENT'],
        },
      };

      render(
        <EvaluationResultsView
          submission={submissionWithMissed}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      const missedSection = screen.getByTestId('missed-issues');
      expect(missedSection).toHaveTextContent('DOSAGE ADJUSTMENT');
    });

    it('renders expert clinical rationale and key learning points', () => {
      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      const rationale = screen.getByTestId('expert-clinical-rationale');
      expect(rationale).toHaveTextContent(/Beta-lactam antibiotics share structural determinants/);

      const keyPoints = screen.getByTestId('key-learning-points');
      expect(keyPoints).toHaveTextContent('Recognize structural beta-lactam ring cross-reactivity');
      expect(keyPoints).toHaveTextContent('Never override verified IgE anaphylaxis with direct penicillins');
    });

    it('renders grounded reference rules with severity badges and clinical evidence', () => {
      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      const rulesList = screen.getByTestId('reference-rules-list');
      expect(rulesList).toHaveTextContent('RULE-ALG-PEN-01');
      expect(rulesList).toHaveTextContent('Severe Penicillin IgE Cross-Reactivity Rule');
      expect(rulesList).toHaveTextContent(/Sharing the beta-lactam core structure/);
    });

    it('handles missing optional feedback fields gracefully without crashing', () => {
      const minimalSubmission: StudentSubmissionResponse = {
        ...mockFullSubmission,
        feedback: {
          ...mockFullSubmission.feedback,
          expected_rules: [],
          key_learning_points: [],
          missed_issues: [],
          unconfirmed_issues: [],
          missed_reasoning_elements: [],
          reasoning_feedback: '',
        },
      };

      render(
        <EvaluationResultsView
          submission={minimalSubmission}
          onBackToCatalog={vi.fn()}
          onViewHistory={vi.fn()}
        />
      );

      expect(screen.getByTestId('overall-score')).toHaveTextContent('93');
      expect(screen.queryByTestId('reference-rules-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('key-learning-points')).not.toBeInTheDocument();
    });

    it('navigates back to catalog and submission history when buttons clicked', () => {
      const onBackToCatalog = vi.fn();
      const onViewHistory = vi.fn();
      const onRetakeCase = vi.fn();

      render(
        <EvaluationResultsView
          submission={mockFullSubmission}
          onBackToCatalog={onBackToCatalog}
          onViewHistory={onViewHistory}
          onRetakeCase={onRetakeCase}
        />
      );

      fireEvent.click(screen.getByTestId('results-back-button'));
      expect(onBackToCatalog).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('results-history-button'));
      expect(onViewHistory).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('results-retake-button'));
      expect(onRetakeCase).toHaveBeenCalledWith('CASE-BEG-01');
    });
  });

  // =========================================================================
  // PART B: Student Submission History Tests
  // =========================================================================
  describe('Part B — StudentSubmissionHistory Component', () => {
    it('retrieves and renders chronological student submissions with real backend fields', async () => {
      vi.spyOn(api.education, 'listSubmissions').mockResolvedValueOnce(mockSubmissionsList);

      render(<StudentSubmissionHistory />);

      expect(screen.getByTestId('history-loading')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Verify chronological sorting (latest first: sub-list-002 from 04:45, then sub-list-001 from 04:15)
      const rows = screen.getAllByRole('row');
      // row 0 is header, row 1 is CASE-INT-01, row 2 is CASE-BEG-01
      expect(rows[1]).toHaveTextContent('CASE-INT-01');
      expect(rows[1]).toHaveTextContent('85 / 100');
      expect(rows[2]).toHaveTextContent('CASE-BEG-01');
      expect(rows[2]).toHaveTextContent('35 / 100');
    });

    it('displays empty state when student has no submission history', async () => {
      vi.spyOn(api.education, 'listSubmissions').mockResolvedValueOnce([]);

      render(<StudentSubmissionHistory onBackToCatalog={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('No Submissions Recorded Yet')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Complete a clinical case assessment in the Case Catalog/)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Browse Case Catalog/i })).toBeInTheDocument();
    });

    it('displays error state on failure and supports retrying the fetch', async () => {
      vi.spyOn(api.education, 'listSubmissions')
        .mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'))
        .mockResolvedValueOnce(mockSubmissionsList);

      render(<StudentSubmissionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId('history-error')).toBeInTheDocument();
      });
      expect(screen.getByText(/Unable to Load Submission History/)).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /Retry Connection/i }));

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });
      expect(screen.getByText('CASE-INT-01')).toBeInTheDocument();
    });

    it('inspects detailed feedback in modal when clicking Inspect Feedback button', async () => {
      vi.spyOn(api.education, 'listSubmissions').mockResolvedValueOnce(mockSubmissionsList);
      const detailSpy = vi
        .spyOn(api.education, 'getSubmissionDetail')
        .mockResolvedValueOnce(mockFullSubmission);

      render(<StudentSubmissionHistory />);

      await waitFor(() => {
        expect(screen.getByTestId('submissions-table')).toBeInTheDocument();
      });

      // Click inspect feedback for first item (sub-list-002)
      const inspectBtn = screen.getByTestId('inspect-submission-btn-sub-list-002');
      fireEvent.click(inspectBtn);

      expect(detailSpy).toHaveBeenCalledWith('sub-list-002');

      // Modal appears
      await waitFor(() => {
        expect(screen.getByTestId('inspection-modal-content')).toBeInTheDocument();
      });

      expect(screen.getByTestId('modal-total-score')).toHaveTextContent('93 / 100');
      expect(
        screen.getByText(/Amoxicillin is an amino-penicillin sharing the beta-lactam core/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Beta-lactam antibiotics share structural determinants/)
      ).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByTestId('inspection-modal-content')).not.toBeInTheDocument();
      });
    });
  });
});

