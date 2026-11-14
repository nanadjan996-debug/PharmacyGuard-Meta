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

  it('renders Counter Intake Studio with title, demographics, complaints, and diagnostic screening inputs', async () => {
    render(<CounterIntakeStudio />);

    expect(screen.getByText(/Community Counter Consultation Studio/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Walk-In Patient Demographics & Vitals/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Presenting Complaints & Clinical Picture/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Point-of-Care Diagnostics & Rapid Tests/i)).toBeInTheDocument();
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
    const hypBtn = screen.getByRole('button', { name: /4\. Hypertensive Urgency/i });
    expect(routineBtn).toBeInTheDocument();
    expect(emergencyBtn).toBeInTheDocument();
    expect(hypBtn).toBeInTheDocument();

    fireEvent.click(emergencyBtn);
    expect(screen.getByDisplayValue(/High fever, repeated vomiting/i)).toBeInTheDocument();

    fireEvent.click(hypBtn);
    expect(screen.getByDisplayValue(/Severe throbbing occipital headache/i)).toBeInTheDocument();
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

  it('supports open-ended custom symptoms, comorbidities, home medications, and diagnostics', async () => {
    render(<CounterIntakeStudio />);

    // 1. Add custom symptom
    const customSymptomInput = screen.getByPlaceholderText(/hemoptysis, hematuria/i);
    fireEvent.change(customSymptomInput, { target: { value: 'dysphagia' } });
    const addSymptomBtn = screen.getByRole('button', { name: /Add Symptom/i });
    fireEvent.click(addSymptomBtn);

    expect(screen.getByText('dysphagia')).toBeInTheDocument();

    // 2. Add comorbidity from quick-picks and custom
    const htnChip = screen.getByText('Hypertension');
    fireEvent.click(htnChip);
    const customCondInput = screen.getByPlaceholderText(/Enter any medical condition/i);
    fireEvent.change(customCondInput, { target: { value: 'Post-appendectomy (2022)' } });
    const addCondBtn = screen.getByRole('button', { name: /Add Condition/i });
    fireEvent.click(addCondBtn);

    expect(screen.getByText('Post-appendectomy (2022)')).toBeInTheDocument();

    // 3. Add home medication
    const homeMedInput = screen.getByPlaceholderText(/Amlodipine 10mg daily/i);
    fireEvent.change(homeMedInput, { target: { value: 'Metformin 500mg BID' } });
    const addMedBtn = screen.getByRole('button', { name: /Add Medication/i });
    fireEvent.click(addMedBtn);

    expect(screen.getByText('Metformin 500mg BID')).toBeInTheDocument();

    // 4. Add custom rapid POC diagnostic
    const testNameInput = screen.getByPlaceholderText(/Test name \(e\.g\. Urine Dipstick/i);
    const testResultInput = screen.getByPlaceholderText(/Result \(e\.g\. Leukocytes 2\+/i);
    fireEvent.change(testNameInput, { target: { value: 'Urine Dipstick' } });
    fireEvent.change(testResultInput, { target: { value: 'Protein 2+, Leuks Neg' } });
    const addTestBtn = screen.getAllByRole('button', { name: /^Add$/i })[0];
    fireEvent.click(addTestBtn);

    expect(screen.getByText(/Urine Dipstick:/i)).toBeInTheDocument();
    expect(screen.getByText(/Protein 2\+, Leuks Neg/i)).toBeInTheDocument();

    // 5. Submit and verify open-ended payload was transmitted
    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.community.createConsultation).toHaveBeenCalledWith(
        expect.objectContaining({
          symptoms: expect.arrayContaining(['dysphagia']),
          medical_history: expect.arrayContaining(['Hypertension', 'Post-appendectomy (2022)']),
          current_medications: expect.arrayContaining(['Metformin 500mg BID']),
          diagnostic_tests: expect.arrayContaining([
            expect.objectContaining({
              test_name: 'Urine Dipstick',
              result: 'Protein 2+, Leuks Neg',
            }),
          ]),
        })
      );
    });
  }, 15000);

  it('allows pharmacists to propose custom medications with full clinical specifications', async () => {
    render(<CounterIntakeStudio />);

    // Toggle custom medication form
    const toggleFormBtn = screen.getByRole('button', { name: /\+ Custom Medication Form/i });
    fireEvent.click(toggleFormBtn);

    expect(screen.getByText(/Enter Custom Dispensing Regimen/i)).toBeInTheDocument();

    // Fill form
    const drugInput = screen.getByPlaceholderText(/Ciprofloxacin, Metronidazole/i);
    const strengthInput = screen.getByPlaceholderText(/500mg, 10mg\/5mL/i);
    fireEvent.change(drugInput, { target: { value: 'Ciprofloxacin' } });
    fireEvent.change(strengthInput, { target: { value: '500mg' } });

    const addRegimenBtn = screen.getByRole('button', { name: /Add to Proposed Regimen/i });
    fireEvent.click(addRegimenBtn);

    // Verify item is added to proposed regimen list
    expect(screen.getByText('Ciprofloxacin')).toBeInTheDocument();
    expect(screen.getByText(/500mg • Tablet/i)).toBeInTheDocument();
  }, 15000);

  it('renders clinical practice boundary notice and evaluated rule transparency upon non-red-flag evaluation', async () => {
    vi.spyOn(api.community, 'createConsultation').mockResolvedValueOnce({
      ...mockCleanConsultation,
      evaluated_rules_count: 5,
      uncovered_clinical_areas: ['Dysphagia (no configured triage rule)'],
    });

    render(<CounterIntakeStudio />);

    const submitBtn = screen.getByRole('button', { name: /Execute Red-Flag Triage/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/No Critical Red Flags Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/Clinical Scope & Practice Boundary Notice/i)).toBeInTheDocument();
      expect(screen.getByText(/Evaluated Protocols \(5\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Recorded Elements Outside Triage Rule Set:/i)).toBeInTheDocument();
      expect(screen.getByText(/Dysphagia \(no configured triage rule\)/i)).toBeInTheDocument();
      expect(screen.getByText(/ABSENCE OF AN AUTOMATED ALERT DOES NOT CONSTITUTE A FINDING OF CLINICAL SAFETY/i)).toBeInTheDocument();
    });
  }, 15000);
});
