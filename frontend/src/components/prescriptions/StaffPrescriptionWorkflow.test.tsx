import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PrescriptionQueueTable } from './PrescriptionQueueTable';
import { PrescriptionDetailPanel } from './PrescriptionDetailPanel';
import { ReviewActionModal } from './ReviewActionModal';
import { StaffPrescriptionWorkspace } from './StaffPrescriptionWorkspace';
import { api, ApiError } from '../../services/api';
import {
  PrescriptionQueueItemResponse,
  PrescriptionDetailResponse,
  VerificationResponse,
  ReviewActionResponse,
} from '../../types/api';

const mockQueueData: PrescriptionQueueItemResponse[] = [
  {
    id: 'rx-synth-001',
    prescription_number: 'RX-2026-0001',
    patient_id: 'pat-synth-001',
    patient_name: 'Arthur Pendelton',
    patient_mrn: 'SYNTH-MRN-001',
    prescriber_name: 'Dr. Elena Rostova, MD',
    prescriber_department: 'Cardiology Outpatient Clinic',
    status: 'pending',
    scenario_key: 'SCENARIO_1_CLEAN',
    created_at: '2026-10-27T10:46:50.425918Z',
    findings_count: 1,
    has_high_severity_finding: false,
  },
  {
    id: 'rx-synth-005',
    prescription_number: 'RX-2026-0005',
    patient_id: 'pat-synth-005',
    patient_name: 'Edward Sterling',
    patient_mrn: 'SYNTH-MRN-005',
    prescriber_name: 'Dr. Anthony Morales, MD',
    prescriber_department: 'Infectious Disease Unit',
    status: 'pending',
    scenario_key: 'SCENARIO_5_STOCKOUT',
    created_at: '2026-10-27T10:55:00.000000Z',
    findings_count: 1,
    has_high_severity_finding: true,
  },
  {
    id: 'rx-synth-006',
    prescription_number: 'RX-2026-0006',
    patient_id: 'pat-synth-006',
    patient_name: 'Clara Oswald',
    patient_mrn: 'SYNTH-MRN-006',
    prescriber_name: 'Dr. Gregory Hayes, MD',
    prescriber_department: 'General Internal Medicine',
    status: 'reviewed',
    scenario_key: 'SCENARIO_6_ACCEPTED',
    created_at: '2026-10-27T11:00:00.000000Z',
    findings_count: 0,
    has_high_severity_finding: false,
  },
];

const mockCleanDetail: PrescriptionDetailResponse = {
  id: 'rx-synth-001',
  prescription_number: 'RX-2026-0001',
  patient_id: 'pat-synth-001',
  patient_name: 'Arthur Pendelton',
  patient_mrn: 'SYNTH-MRN-001',
  patient_dob: '1968-04-12',
  patient_gender: 'Male',
  patient_weight_kg: 82.5,
  patient_height_cm: 178.0,
  prescriber_name: 'Dr. Elena Rostova, MD',
  prescriber_department: 'Cardiology Outpatient Clinic',
  status: 'pending',
  scenario_key: 'SCENARIO_1_CLEAN',
  clinical_notes: 'Routine maintenance for essential hypertension.',
  created_at: '2026-10-27T10:46:50.425918Z',
  items: [
    {
      id: 'item-001',
      medication_id: 'MED-LIS-10',
      generic_name: 'Lisinopril',
      brand_name: 'Prinivil',
      drug_class: 'ACE Inhibitor',
      dose_amount: 10.0,
      dose_unit: 'mg',
      frequency: 'Once daily',
      route: 'Oral',
      duration_days: 30,
      quantity_prescribed: 30,
      instructions: 'Take 1 tablet every morning with water.',
    },
  ],
  findings: [
    {
      id: 'f-001',
      rule_identifier: 'RULE-CLEAN-001',
      category: 'INDICATION',
      severity: 'INFO',
      status: 'CLEAN',
      evidence: 'Prescribed Lisinopril matches hypertension diagnosis.',
      rule_source: 'Demo Guidelines',
      human_review_required: false,
    },
  ],
  reviews: [],
  escalations: [],
};

const mockHighSeverityDetail: PrescriptionDetailResponse = {
  id: 'rx-synth-005',
  prescription_number: 'RX-2026-0005',
  patient_id: 'pat-synth-005',
  patient_name: 'Edward Sterling',
  patient_mrn: 'SYNTH-MRN-005',
  patient_dob: '1975-08-20',
  patient_gender: 'Male',
  patient_weight_kg: 74.0,
  patient_height_cm: 175.0,
  prescriber_name: 'Dr. Anthony Morales, MD',
  prescriber_department: 'Infectious Disease Unit',
  status: 'pending',
  scenario_key: 'SCENARIO_5_STOCKOUT',
  clinical_notes: 'Acute respiratory infection with severe deficit.',
  created_at: '2026-10-27T10:55:00.000000Z',
  items: [
    {
      id: 'item-005',
      medication_id: 'MED-CEF-500',
      generic_name: 'Cefdinir',
      brand_name: 'Omnicef',
      drug_class: 'Cephalosporin Antibiotic',
      dose_amount: 500.0,
      dose_unit: 'mg',
      frequency: 'Every 12 hours',
      route: 'Oral',
      duration_days: 10,
      quantity_prescribed: 20,
      instructions: 'Take 1 capsule every 12 hours.',
    },
  ],
  findings: [
    {
      id: 'f-005',
      rule_identifier: 'RULE-INV-STOCK-01',
      category: 'INVENTORY',
      severity: 'HIGH',
      status: 'CONFLICT_DETECTED',
      evidence: 'SIMULATED INVENTORY SHORTAGE: Requested 20 units exceeds carousel stock (12 on hand, 13 deficit).',
      rule_source: 'Demo Central Inventory',
      human_review_required: true,
    },
  ],
  reviews: [],
  escalations: [],
};

describe('Stage 2: PrescriptionQueueTable Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders queue items with prescription number, patient, prescriber, and severity', async () => {
    vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValueOnce(mockQueueData);

    const handleSelect = vi.fn();
    render(<PrescriptionQueueTable onSelectPrescription={handleSelect} />);

    // Shows loading skeleton initially
    expect(screen.getByRole('status', { name: /Loading data/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Arthur Pendelton')).toBeInTheDocument();
      expect(screen.getByText('RX-2026-0005')).toBeInTheDocument();
      expect(screen.getByText('Edward Sterling')).toBeInTheDocument();
      expect(screen.getByText('HIGH SEVERITY')).toBeInTheDocument();
    });

    // Selecting a row calls onSelectPrescription
    fireEvent.click(screen.getByText('Arthur Pendelton'));
    expect(handleSelect).toHaveBeenCalledWith('rx-synth-001');
  });

  it('filters queue by search query, status dropdown, and high severity toggle', async () => {
    vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValueOnce(mockQueueData);

    render(<PrescriptionQueueTable onSelectPrescription={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('RX-2026-0005')).toBeInTheDocument();
    });

    // 1. Search by patient name
    const searchInput = screen.getByPlaceholderText(/Search RX #/i);
    fireEvent.change(searchInput, { target: { value: 'Sterling' } });

    expect(screen.queryByText('Arthur Pendelton')).not.toBeInTheDocument();
    expect(screen.getByText('Edward Sterling')).toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Arthur Pendelton')).toBeInTheDocument();

    // 2. Filter by status: 'reviewed'
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'reviewed' } });

    expect(screen.queryByText('Arthur Pendelton')).not.toBeInTheDocument();
    expect(screen.getByText('Clara Oswald')).toBeInTheDocument();

    // Reset status
    fireEvent.change(statusSelect, { target: { value: 'ALL' } });

    // 3. High severity toggle
    const highToggle = screen.getByRole('button', { name: /High Severity Only/i });
    fireEvent.click(highToggle);

    expect(screen.queryByText('Arthur Pendelton')).not.toBeInTheDocument();
    expect(screen.getByText('Edward Sterling')).toBeInTheDocument();
  });

  it('displays empty state when no prescriptions match active filters', async () => {
    vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValueOnce(mockQueueData);

    render(<PrescriptionQueueTable onSelectPrescription={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search RX #/i);
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT_QUERY_1234' } });

    expect(screen.getByText('No Prescriptions Found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset Filters/i })).toBeInTheDocument();

    // Clicking reset clears search
    fireEvent.click(screen.getByRole('button', { name: /Reset Filters/i }));
    expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
  });

  it('displays error alert and supports retry on API failure', async () => {
    const listSpy = vi
      .spyOn(api.prescriptions, 'listQueue')
      .mockRejectedValueOnce(new ApiError(500, 'Database connection timeout'));

    render(<PrescriptionQueueTable onSelectPrescription={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Unable to Retrieve Prescription Queue')).toBeInTheDocument();
      expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
    });

    // Mock success on retry
    listSpy.mockResolvedValueOnce(mockQueueData);

    const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
    });
  });
});

describe('Stage 2: PrescriptionDetailPanel & Deterministic Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders complete prescription details, demographics, medication items, and findings', async () => {
    vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValueOnce(mockCleanDetail);

    const handleBack = vi.fn();
    render(<PrescriptionDetailPanel prescriptionId="rx-synth-001" onBack={handleBack} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Arthur Pendelton')).toBeInTheDocument();
      expect(screen.getByText('SYNTH-MRN-001')).toBeInTheDocument();
      expect(screen.getByText(/1968-04-12/i)).toBeInTheDocument();
      expect(screen.getByText('Dr. Elena Rostova, MD')).toBeInTheDocument();
      expect(screen.getByText('Lisinopril')).toBeInTheDocument();
      expect(screen.getByText(/Prinivil/i)).toBeInTheDocument();
      expect(screen.getByText('RULE-CLEAN-001')).toBeInTheDocument();
      expect(screen.getByText(/Prescribed Lisinopril matches hypertension/i)).toBeInTheDocument();
    });

    // Back button
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('executes deterministic verification and refreshes findings on success', async () => {
    vi.spyOn(api.prescriptions, 'getDetail')
      .mockResolvedValueOnce(mockCleanDetail)
      .mockResolvedValueOnce({
        ...mockCleanDetail,
        findings: [
          ...mockCleanDetail.findings,
          {
            id: 'f-verified-002',
            rule_identifier: 'RULE-DOSE-001',
            category: 'DOSAGE',
            severity: 'INFO',
            status: 'CLEAN',
            evidence: 'Calculated daily dose falls safely within reference bounds.',
            rule_source: 'Demo Dose Reference',
            human_review_required: false,
          },
        ],
      });

    const verifyMock: VerificationResponse = {
      summary: {
        prescription_id: 'rx-synth-001',
        prescription_number: 'RX-2026-0001',
        total_findings: 2,
        conflicts_count: 0,
        review_required_count: 0,
        clean_count: 2,
        max_severity: 'INFO',
        requires_human_review: false,
        engine_version: '1.0.0-deterministic',
        disclaimer: 'Advisory deterministic rule engine demonstration.',
      },
      findings: [],
    };

    vi.spyOn(api.prescriptions, 'verify').mockResolvedValueOnce(verifyMock);

    render(<PrescriptionDetailPanel prescriptionId="rx-synth-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /Re-Run Verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(api.prescriptions.verify).toHaveBeenCalledWith('rx-synth-001');
      expect(screen.getByText(/Verification completed: 2 findings evaluated/i)).toBeInTheDocument();
      expect(screen.getByText('RULE-DOSE-001')).toBeInTheDocument();
    });
  });

  it('displays verification error message when verify API fails', async () => {
    vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValueOnce(mockCleanDetail);
    vi.spyOn(api.prescriptions, 'verify').mockRejectedValueOnce(
      new ApiError(500, 'Verification engine timeout')
    );

    render(<PrescriptionDetailPanel prescriptionId="rx-synth-001" onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
    });

    const verifyBtn = screen.getByRole('button', { name: /Re-Run Verification/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(screen.getByText('Verification engine timeout')).toBeInTheDocument();
    });
  });
});

describe('Stage 2: ReviewActionModal & Rationale Enforcement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks ACCEPT without rationale when prescription contains active HIGH severity finding', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReviewActionModal
        isOpen={true}
        onClose={handleClose}
        prescription={mockHighSeverityDetail}
        initialAction="ACCEPT"
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText(/ACTIVE HIGH-SEVERITY FINDINGS DETECTED/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Written Clinical Rationale/i)).toBeInTheDocument();

    // Attempt to submit empty rationale
    const submitBtn = screen.getByRole('button', { name: /Confirm ACCEPT/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/Override rationale is mandatory when accepting a prescription with active high-priority clinical findings/i)
    ).toBeInTheDocument();
    expect(handleSuccess).not.toHaveBeenCalled();
  });

  it('submits ACCEPT with rationale successfully when active HIGH finding exists', async () => {
    const reviewResponse: ReviewActionResponse = {
      status: 'success',
      prescription_id: 'rx-synth-005',
      prescription_number: 'RX-2026-0005',
      action: 'ACCEPT',
      new_status: 'reviewed',
      review_id: 'rev-001',
      findings_snapshotted: 1,
      disclaimer: 'Advisory deterministic verification rule engine demonstration.',
      created_at: new Date().toISOString(),
    };

    vi.spyOn(api.prescriptions, 'submitReview').mockResolvedValueOnce(reviewResponse);

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReviewActionModal
        isOpen={true}
        onClose={handleClose}
        prescription={mockHighSeverityDetail}
        initialAction="ACCEPT"
        onSuccess={handleSuccess}
      />
    );

    // Provide non-empty rationale
    const rationaleInput = screen.getByLabelText(/Written Clinical Rationale/i);
    fireEvent.change(rationaleInput, {
      target: { value: 'Inventory shortage mitigated: stock transferred from Satellite Pharmacy.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Confirm ACCEPT/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.prescriptions.submitReview).toHaveBeenCalledWith('rx-synth-005', {
        action: 'ACCEPT',
        override_rationale: 'Inventory shortage mitigated: stock transferred from Satellite Pharmacy.',
        notes: undefined,
      });
      expect(handleSuccess).toHaveBeenCalledWith(reviewResponse);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('blocks OVERRIDE without clinical rationale', async () => {
    const handleSuccess = vi.fn();

    render(
      <ReviewActionModal
        isOpen={true}
        onClose={vi.fn()}
        prescription={mockCleanDetail}
        initialAction="OVERRIDE"
        onSuccess={handleSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Confirm OVERRIDE/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Clinical rationale is mandatory for overriding clinical safety findings/i)).toBeInTheDocument();
    expect(handleSuccess).not.toHaveBeenCalled();
  });

  it('submits ESCALATE with clarification notes carried in notes field', async () => {
    const escalationResponse: ReviewActionResponse = {
      status: 'success',
      prescription_id: 'rx-synth-001',
      prescription_number: 'RX-2026-0001',
      action: 'ESCALATE',
      new_status: 'escalated',
      review_id: 'rev-002',
      findings_snapshotted: 1,
      disclaimer: 'Advisory deterministic verification rule engine demonstration.',
      created_at: new Date().toISOString(),
    };

    vi.spyOn(api.prescriptions, 'submitReview').mockResolvedValueOnce(escalationResponse);

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <ReviewActionModal
        isOpen={true}
        onClose={handleClose}
        prescription={mockCleanDetail}
        initialAction="ESCALATE"
        onSuccess={handleSuccess}
      />
    );

    const notesInput = screen.getByLabelText(/Clarification \/ Escalation Reason/i);
    fireEvent.change(notesInput, {
      target: { value: 'Patient reports dizziness, requesting prescriber dose adjustment confirmation.' },
    });

    const submitBtn = screen.getByRole('button', { name: /Confirm ESCALATE/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.prescriptions.submitReview).toHaveBeenCalledWith('rx-synth-001', {
        action: 'ESCALATE',
        override_rationale: undefined,
        notes: 'Patient reports dizziness, requesting prescriber dose adjustment confirmation.',
      });
      expect(handleSuccess).toHaveBeenCalledWith(escalationResponse);
    });
  });

  it('presents backend API errors (e.g. 409 Conflict) without falsely indicating success', async () => {
    vi.spyOn(api.prescriptions, 'submitReview').mockRejectedValueOnce(
      new ApiError(409, 'Conflict: Prescription RX-2026-0001 has already been reviewed and finalized.')
    );

    const handleSuccess = vi.fn();

    render(
      <ReviewActionModal
        isOpen={true}
        onClose={vi.fn()}
        prescription={mockCleanDetail}
        initialAction="ACCEPT"
        onSuccess={handleSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Confirm ACCEPT/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(/Conflict: Prescription RX-2026-0001 has already been reviewed/i)
      ).toBeInTheDocument();
      expect(handleSuccess).not.toHaveBeenCalled();
    });
  });
});

describe('Stage 2: StaffPrescriptionWorkspace Integration', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('navigates from queue table to detail panel and back seamlessly', async () => {
    vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValue(mockQueueData);
    vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValue(mockCleanDetail);

    render(<StaffPrescriptionWorkspace />);

    // 1. Initial queue view
    await waitFor(() => {
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Arthur Pendelton')).toBeInTheDocument();
    });

    // 2. Click inspect/review on Arthur Pendelton
    fireEvent.click(screen.getByText('Arthur Pendelton'));

    // 3. Detail panel is rendered
    await waitFor(() => {
      expect(screen.getByText('Patient Demographics')).toBeInTheDocument();
      expect(screen.getByText(/Prinivil/i)).toBeInTheDocument();
    });

    // 4. Click Back button
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));

    // 5. Returned to queue view
    await waitFor(() => {
      expect(screen.getByText('Clinical Prescription Queue')).toBeInTheDocument();
      expect(screen.getByText('RX-2026-0001')).toBeInTheDocument();
    });
  });
});
