import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIExplanationSection } from './AIExplanationSection';
import { PrescriptionDetailPanel } from './PrescriptionDetailPanel';
import { api } from '../../services/api';
import { AIExplanationResponse, PrescriptionDetailResponse, VerificationResponse } from '../../types/api';

const mockAvailableExplanation: AIExplanationResponse = {
  summary: 'Prescription contains a severe cross-reactivity conflict with documented Penicillin anaphylaxis.',
  finding_explanations: [
    {
      rule_identifier: 'RULE-ALG-PEN-01',
      category: 'ALLERGY',
      severity: 'HIGH',
      clinical_explanation: 'Amoxicillin shares the beta-lactam bicyclic core, creating an acute risk of IgE-mediated anaphylaxis.',
    },
  ],
  clinical_context: '52-year-old female presenting with acute bacterial rhinosinusitis.',
  uncertainties: ['Exact year and reaction profile of initial penicillin exposure.'],
  review_considerations: ['Substitute with non-beta-lactam antibiotic such as Doxycycline.'],
  ai_status: 'available',
  status_detail: null,
  model_name: 'meta-models/muse-spark-open',
  disclaimer: 'AI-generated explanatory assistance only. Non-authoritative clinical decision support.',
};

const mockTimeoutExplanation: AIExplanationResponse = {
  summary: 'AI clinical explanation timed out. Deterministic safety verification remains fully available.',
  finding_explanations: [],
  clinical_context: 'Evaluation timed out after 14 seconds.',
  uncertainties: ['Inference exceeded 14s safety limit.'],
  review_considerations: ['Evaluate deterministic findings directly.'],
  ai_status: 'timeout',
  status_detail: 'Inference request exceeded 14.0-second timeout limit.',
  model_name: 'meta-models/muse-spark-open',
  disclaimer: 'AI-generated explanatory assistance only.',
};

const mockRejectedExplanation: AIExplanationResponse = {
  summary: 'AI clinical explanation rejected: Hallucinated rule identifier detected.',
  finding_explanations: [],
  clinical_context: 'Deterministic safety verification preserved.',
  uncertainties: ['Model output violated safety bounds.'],
  review_considerations: ['Evaluate deterministic findings directly.'],
  ai_status: 'rejected',
  status_detail: "Unknown rule identifier 'RULE-FAKE-01' not in deterministic findings.",
  model_name: 'meta-models/muse-spark-open',
  disclaimer: 'AI-generated explanatory assistance only.',
};

const mockUnavailableExplanation: AIExplanationResponse = {
  summary: 'AI clinical explanation service is temporarily unavailable.',
  finding_explanations: [],
  clinical_context: 'Deterministic safety verification preserved.',
  uncertainties: ['Provider connection unavailable.'],
  review_considerations: ['Evaluate deterministic findings directly.'],
  ai_status: 'unavailable',
  status_detail: 'Baseten authentication failed: Invalid or expired API key.',
  model_name: 'meta-models/muse-spark-open',
  disclaimer: 'AI-generated explanatory assistance only.',
};

const mockPrescription: PrescriptionDetailResponse = {
  id: 'rx-test-101',
  prescription_number: 'RX-2026-0003',
  patient_id: 'pat-101',
  patient_name: 'Eleanor Vance',
  patient_mrn: 'MRN-7741',
  patient_dob: '1974-06-12',
  patient_gender: 'Female',
  patient_weight_kg: 68.0,
  patient_height_cm: 165.0,
  prescriber_name: 'Dr. Robert Thorne',
  prescriber_department: 'Otolaryngology',
  status: 'pending',
  scenario_key: 'SCENARIO_3_ALLERGY',
  clinical_notes: 'Severe acute sinusitis.',
  created_at: '2026-11-01T08:00:00Z',
  items: [
    {
      id: 'it-1',
      medication_id: 'MED-AMX-500',
      generic_name: 'Amoxicillin',
      brand_name: 'Amoxil',
      drug_class: 'Penicillin Antibiotic',
      dose_amount: 500,
      dose_unit: 'mg',
      frequency: 'TID',
      route: 'Oral',
      duration_days: 10,
      quantity_prescribed: 30,
      instructions: 'Take 1 capsule 3 times daily',
    },
  ],
  findings: [
    {
      id: 'f-1',
      rule_identifier: 'RULE-ALG-PEN-01',
      category: 'ALLERGY',
      severity: 'HIGH',
      status: 'CONFLICT_DETECTED',
      evidence: 'Severe Penicillin anaphylaxis.',
      rule_source: 'Cross-Reactivity Reference',
      human_review_required: true,
    },
  ],
  reviews: [],
  escalations: [],
};

describe('Stage 6: AIExplanationSection Component', () => {
  it('renders initial unanalyzed state with prompt to generate', () => {
    const handleGenerate = vi.fn();
    render(
      <AIExplanationSection
        explanation={null}
        isLoading={false}
        onGenerate={handleGenerate}
      />
    );

    expect(screen.getAllByText(/Clinical AI Assistant/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/No AI explanation requested yet for this prescription/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explain with AI/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Explain with AI/i }));
    expect(handleGenerate).toHaveBeenCalledTimes(1);
  });

  it('renders processing state with spinner and 14s limit indicator', () => {
    render(
      <AIExplanationSection
        explanation={null}
        isLoading={true}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Processing \(14s max\)\.\.\./i)).toBeInTheDocument();
    expect(screen.getByText(/Contacting AI clinical service/i)).toBeInTheDocument();
  });

  it('renders fully populated clinical explanation when available', () => {
    render(
      <AIExplanationSection
        explanation={mockAvailableExplanation}
        isLoading={false}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByText('AI Explanation Available')).toBeInTheDocument();
    expect(screen.getByText(/severe cross-reactivity conflict/i)).toBeInTheDocument();
    expect(screen.getByText('RULE-ALG-PEN-01')).toBeInTheDocument();
    expect(screen.getByText(/beta-lactam bicyclic core/i)).toBeInTheDocument();
    expect(screen.getByText(/52-year-old female/i)).toBeInTheDocument();
    expect(screen.getByText(/Exact year and reaction profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Substitute with non-beta-lactam/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Non-Authoritative Clinical Decision Support/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders timeout state with fallback notice', () => {
    render(
      <AIExplanationSection
        explanation={mockTimeoutExplanation}
        isLoading={false}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByText(/AI Timed Out \(>14s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Inference request exceeded 14.0-second timeout limit/i)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic safety verification remains fully available/i)).toBeInTheDocument();
  });

  it('renders safety rejection state when output violates bounds', () => {
    render(
      <AIExplanationSection
        explanation={mockRejectedExplanation}
        isLoading={false}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByText('AI Response Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Hallucinated rule identifier detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Unknown rule identifier 'RULE-FAKE-01'/i)).toBeInTheDocument();
  });

  it('renders provider unavailable state with status detail', () => {
    render(
      <AIExplanationSection
        explanation={mockUnavailableExplanation}
        isLoading={false}
        onGenerate={vi.fn()}
      />
    );

    expect(screen.getByText('AI Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Baseten authentication failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic rule engine checks remain fully authoritative/i)).toBeInTheDocument();
  });
});

describe('Stage 6: PrescriptionDetailPanel AI Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers on-demand AI explanation when clicking Explain with AI button', async () => {
    vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValue(mockPrescription);
    const aiSpy = vi.spyOn(api.prescriptions, 'getAiExplanation').mockResolvedValue(mockAvailableExplanation);

    render(<PrescriptionDetailPanel prescriptionId="rx-test-101" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0003')).toBeInTheDocument();
    });

    const explainBtn = screen.getByRole('button', { name: /Explain with AI/i });
    fireEvent.click(explainBtn);

    await waitFor(() => {
      expect(aiSpy).toHaveBeenCalledWith('rx-test-101');
      expect(screen.getByText('AI Explanation Available')).toBeInTheDocument();
      expect(screen.getByText(/severe cross-reactivity conflict/i)).toBeInTheDocument();
    });
  });

  it('receives and displays AI explanation when re-running deterministic verification', async () => {
    vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValue(mockPrescription);
    const mockVerificationRes: VerificationResponse = {
      summary: {
        prescription_id: 'rx-test-101',
        prescription_number: 'RX-2026-0003',
        total_findings: 1,
        conflicts_count: 1,
        review_required_count: 1,
        clean_count: 0,
        max_severity: 'HIGH',
        requires_human_review: true,
        engine_version: '1.0.0-deterministic',
        disclaimer: 'Advisory deterministic verification.',
      },
      findings: [],
      ai_explanation: mockAvailableExplanation,
    };
    vi.spyOn(api.prescriptions, 'verify').mockResolvedValue(mockVerificationRes);

    render(<PrescriptionDetailPanel prescriptionId="rx-test-101" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0003')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /Re-Run Verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Verification completed: 1 findings evaluated/i)).toBeInTheDocument();
      expect(screen.getByText('AI Explanation Available')).toBeInTheDocument();
      expect(screen.getByText(/severe cross-reactivity conflict/i)).toBeInTheDocument();
    });
  });
});
