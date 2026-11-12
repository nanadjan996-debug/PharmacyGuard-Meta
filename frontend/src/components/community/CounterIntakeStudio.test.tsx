import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CounterIntakeStudio } from './CounterIntakeStudio';
import { api } from '../../services/api';
import { CommunityConsultation } from '../../types/community';

const mockCleanConsultation: CommunityConsultation = {
  id: 'c-test-001',
  consultation_number: 'CC-202611-0001',
  patient_identifier: 'SYN-WI-1001',
  status: 'VERIFICATION_COMPLETED',
  age_years: 28,
  age_months: null,
  gender: 'FEMALE',
  weight_kg: 62.5,
  temperature_c: 38.2,
  sbp_mmhg: 125,
  dbp_mmhg: 82,
  heart_rate_bpm: 84,
  respiratory_rate_bpm: 18,
  spo2_percent: 98,
  mrdt_status: 'CONFIRMED_POSITIVE',
  g6pd_status: 'REPORTED_UNKNOWN',
  chief_complaint: 'Fever and chills for 2 days',
  symptoms: ['fever', 'chills'],
  allergies: [{ allergen: 'Penicillin', state: 'CONFIRMED_OBJECTIVE', reaction: 'Hives' }],
  current_medications: [],
  referral_triggered: false,
  referral_urgency: null,
  referral_reason: null,
  referral_notes: null,
  pharmacist_notes: null,
  dispense_rationale: null,
  version: 1,
  created_at: '2026-11-12T01:00:00Z',
  updated_at: '2026-11-12T01:00:00Z',
  items: [
    {
      id: 'item-001',
      drug_name: 'Artemether-Lumefantrine',
      strength: '20/120mg',
      dosage_form: 'Tablet',
      dose_amount: 4,
      dose_unit: 'tabs',
      frequency: 'BID',
      duration_days: 3,
      route: 'Oral',
      legal_category: 'P',
    },
  ],
  findings: [],
};

const mockSevereRedFlagConsultation: CommunityConsultation = {
  ...mockCleanConsultation,
  id: 'c-test-002',
  consultation_number: 'CC-202611-0002',
  patient_identifier: 'SYN-WI-1002',
  age_years: 3,
  temperature_c: 39.5,
  referral_triggered: true,
  referral_urgency: 'EMERGENCY',
  referral_reason: 'Severe / Complicated Malaria Red Flag',
  referral_notes: '===========================================================\nGHANA HEALTH SERVICE / COMMUNITY PHARMACY EMERGENCY REFERRAL\n===========================================================',
  findings: [
    {
      id: 'f-001',
      rule_identifier: 'RF-MAL-SEV-01',
      category: 'RED_FLAG',
      severity: 'HIGH',
      title: 'Severe / Complicated Malaria Red Flag',
      description: 'Patient presents with fever and clinical signs of severe malaria (prostration, vomiting).',
      action_required: 'EMERGENCY REFERRAL: Withhold routine counter treatment. Pre-referral rectal artesunate: BLOCKED_PENDING_CLINICAL_APPROVAL.',
      is_red_flag: true,
      requires_referral: true,
    },
  ],
};

describe('PharmacyGuard Community Edition: CounterIntakeStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api.community, 'listConsultations').mockResolvedValue([mockCleanConsultation]);
    vi.spyOn(api.community, 'createConsultation').mockResolvedValue(mockCleanConsultation);
    vi.spyOn(api.community, 'transitionConsultation').mockResolvedValue({
      ...mockCleanConsultation,
      status: 'FINDINGS_REVIEWED',
    });
  });

  it('renders Counter Intake Studio with title, demographics, and diagnostic screening inputs', async () => {
    render(<CounterIntakeStudio />);

    expect(screen.getByText(/Community Counter Consultation Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Walk-In Patient Demographics & Vitals/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Point-of-Care Diagnostics & Epistemic Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Presenting Complaints & Red-Flag Triage/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Patient Allergies & Adverse Drug History/i)).toBeInTheDocument();
    expect(screen.getByText(/5\. Proposed Counter Regimen & Dispensing Items/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Recent Counter Consultations/i)).toBeInTheDocument();
      expect(screen.getByText('CC-202611-0001')).toBeInTheDocument();
    });
  });

  it('toggles symptoms chips when clicked', async () => {
    render(<CounterIntakeStudio />);

    const prostrationChip = screen.getByText(/Prostration \/ Lethargy/i);
    expect(prostrationChip).toBeInTheDocument();

    fireEvent.click(prostrationChip);
    // Becomes active with red-flag highlighting
    expect(prostrationChip).toHaveClass('bg-rose-950');
  });

  it('renders quick demo test scenario buttons and pre-fills clinical presentation on click', async () => {
    render(<CounterIntakeStudio />);

    const routineBtn = screen.getByRole('button', { name: /1\. Routine Care/i });
    const emergencyBtn = screen.getByRole('button', { name: /2\. Emergency Red Flag/i });
    expect(routineBtn).toBeInTheDocument();
    expect(emergencyBtn).toBeInTheDocument();

    fireEvent.click(emergencyBtn);
    expect(screen.getByDisplayValue(/High fever, repeated vomiting/i)).toBeInTheDocument();
  });

  it('adds and removes preset medications from the proposed regimen', async () => {
    render(<CounterIntakeStudio />);

    const paracetamolPreset = screen.getByRole('button', { name: /Paracetamol/i });
    fireEvent.click(paracetamolPreset);

    await waitFor(() => {
      expect(screen.getAllByText(/Paracetamol/i).length).toBeGreaterThan(0);
    });
  });

  it('submits walk-in consultation and displays verification findings and action bar', async () => {
    render(<CounterIntakeStudio />);

    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.community.createConsultation).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/No Critical Red Flags Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/Acknowledge & Review Findings/i)).toBeInTheDocument();
    });
  });

  it('renders Emergency Hospital Referral Banner when severe red flag is triggered', async () => {
    vi.spyOn(api.community, 'createConsultation').mockResolvedValueOnce(mockSevereRedFlagConsultation);

    render(<CounterIntakeStudio />);

    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/EMERGENCY HOSPITAL REFERRAL TRIGGERED/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Severe \/ Complicated Malaria Red Flag/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Pre-referral rectal artesunate: BLOCKED_PENDING_CLINICAL_APPROVAL/i).length).toBeGreaterThan(0);
    });
  });

  it('transitions consultation through lifecycle states when pharmacist signs off', async () => {
    render(<CounterIntakeStudio />);

    // Submit consultation
    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Acknowledge & Review Findings/i)).toBeInTheDocument();
    });

    // Click acknowledge
    const ackBtn = screen.getByRole('button', { name: /Acknowledge & Review Findings/i });
    fireEvent.click(ackBtn);

    await waitFor(() => {
      expect(api.community.transitionConsultation).toHaveBeenCalledWith('c-test-001', {
        target_state: 'FINDINGS_REVIEWED',
        dispense_rationale: undefined,
        pharmacist_notes: undefined,
      });
    });
  });

  it('hides clinical override button and displays safety invariant message when emergency referral is active', async () => {
    vi.spyOn(api.community, 'createConsultation').mockResolvedValueOnce({
      ...mockSevereRedFlagConsultation,
      status: 'FINDINGS_REVIEWED',
    });

    render(<CounterIntakeStudio />);

    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dispatch Emergency Referral/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Safety Invariant: Emergency referral cannot be overridden/i)
      ).toBeInTheDocument();
      // Ensure override button is NOT displayed
      expect(screen.queryByText(/Override Red Flag with Clinical Justification/i)).not.toBeInTheDocument();
    });
  });
});
