import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PrescriptionScannerStudio } from './PrescriptionScannerStudio';
import { api } from '../../services/api';
import { CommunityPrescriptionScan } from '../../types/community';

const mockScan: CommunityPrescriptionScan = {
  id: 'scan-001',
  scan_number: 'CRX-20261112-0001',
  patient_identifier: 'SYN-RX-001',
  original_filename: 'ghana_prescription_ridge.jpg',
  content_type: 'image/jpeg',
  file_size_bytes: 10240,
  image_data_base64: 'data:image/jpeg;base64,sample',
  extracted_raw_text: 'Amoxicillin/Clavulanic Acid 625mg tabs 1 tab BID for 7 days',
  overall_confidence: 0.91,
  low_confidence_flag: false,
  status: 'PENDING_REVIEW',
  pharmacist_confirmed_by: null,
  pharmacist_confirmed_at: null,
  pharmacist_review_notes: null,
  is_synthetic: true,
  created_at: '2026-11-12T02:00:00Z',
  updated_at: '2026-11-12T02:00:00Z',
  items: [
    {
      id: 'item-001',
      scan_id: 'scan-001',
      item_index: 1,
      ocr_drug_name: 'Amoxicillin/Clavulanic Acid',
      ocr_strength: '625mg',
      ocr_dosage_form: 'Tablet',
      ocr_dose_amount: 1.0,
      ocr_dose_unit: 'mg',
      ocr_route: 'Oral',
      ocr_frequency: 'BID',
      ocr_duration_days: 7,
      confidence_drug_name: 0.95,
      confidence_strength: 0.92,
      confidence_dosage_form: 0.94,
      confidence_dose: 0.89,
      confidence_route: 0.95,
      confidence_frequency: 0.90,
      confidence_duration: 0.88,
      confirmed_drug_name: 'Amoxicillin/Clavulanic Acid',
      confirmed_strength: '625mg',
      confirmed_dosage_form: 'Tablet',
      confirmed_dose_amount: 1.0,
      confirmed_dose_unit: 'mg',
      confirmed_route: 'Oral',
      confirmed_frequency: 'BID',
      confirmed_duration_days: 7,
      confirmed_instructions: 'Take 1 tab orally BID for 7 days',
      legal_category: 'POM',
      is_pharmacist_confirmed: false,
    },
  ],
};

describe('PharmacyGuard Workflow B: PrescriptionScannerStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api.community, 'listPrescriptions').mockResolvedValue([mockScan]);
    vi.spyOn(api.community, 'uploadPrescription').mockResolvedValue(mockScan);
    vi.spyOn(api.community, 'confirmPrescriptionGate').mockResolvedValue({
      ...mockScan,
      status: 'HUMAN_CONFIRMED',
      pharmacist_confirmed_by: 'pharmacist_demo',
      items: [
        {
          ...mockScan.items[0],
          is_pharmacist_confirmed: true,
        },
      ],
    });
    vi.spyOn(api.community, 'dispensePrescription').mockResolvedValue({
      ...mockScan,
      status: 'DISPENSED',
    });
  });

  it('renders Prescription Scanner Studio with title, image viewer canvas, and 7-field confirmation gate', async () => {
    render(<PrescriptionScannerStudio />);

    expect(
      screen.getByText(/Prescription Scanner & 7-Field Human Confirmation Gate/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Upload Prescription Slip/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Prescription Slip Visual/i)).toBeInTheDocument();
      expect(screen.getByText(/Mandatory 7-Field Human Confirmation Gate/i)).toBeInTheDocument();
      expect(screen.getByText('CRX-20261112-0001')).toBeInTheDocument();
    });
  });

  it('renders all 7 core fields and confidence badges for medication item', async () => {
    render(<PrescriptionScannerStudio />);

    await waitFor(() => {
      expect(screen.getByText(/1\. Drug Name \*/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. Strength \*/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. Formulation \*/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. Dose \*/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. Route \*/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. Frequency \*/i)).toBeInTheDocument();
      expect(screen.getByText(/7\. Duration \(Days\) \*/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm & Lock 7-Field Gate/i)).toBeInTheDocument();
    });
  });

  it('confirms 7-field human gate and locks prescription for dispensing', async () => {
    render(<PrescriptionScannerStudio />);

    await waitFor(() => {
      expect(screen.getByText(/Confirm & Lock 7-Field Gate/i)).toBeInTheDocument();
    });

    const lockBtn = screen.getByRole('button', { name: /Confirm & Lock 7-Field Gate/i });
    fireEvent.click(lockBtn);

    await waitFor(() => {
      expect(api.community.confirmPrescriptionGate).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/7-Field Human Confirmation Gate locked successfully/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Record Dispensing & Complete/i)).toBeInTheDocument();
    });
  });

  it('dispenses prescription when human gate is confirmed', async () => {
    vi.spyOn(api.community, 'listPrescriptions').mockResolvedValueOnce([
      {
        ...mockScan,
        status: 'HUMAN_CONFIRMED',
        pharmacist_confirmed_by: 'pharmacist_demo',
      },
    ]);

    render(<PrescriptionScannerStudio />);

    await waitFor(() => {
      expect(screen.getByText(/Record Dispensing & Complete/i)).toBeInTheDocument();
    });

    const dispenseBtn = screen.getByRole('button', { name: /Record Dispensing & Complete/i });
    fireEvent.click(dispenseBtn);

    await waitFor(() => {
      expect(api.community.dispensePrescription).toHaveBeenCalledWith('scan-001');
      expect(screen.getByText(/Prescription marked as DISPENSED/i)).toBeInTheDocument();
    });
  });

  it('loads sample prescription preset when button clicked', async () => {
    render(<PrescriptionScannerStudio />);

    const sampleBtn = screen.getByRole('button', { name: /\+ Hospital OPD Slip/i });
    fireEvent.click(sampleBtn);

    await waitFor(() => {
      expect(api.community.uploadPrescription).toHaveBeenCalledTimes(1);
    });
  });

  it('renders patient metadata banner distinctly from the 7 clinical fields', async () => {
    vi.spyOn(api.community, 'listPrescriptions').mockResolvedValueOnce([
      {
        ...mockScan,
        patient_name: 'Ama Mensah',
        patient_age: '32y',
        prescription_date: '2026-11-13',
      },
    ]);

    render(<PrescriptionScannerStudio />);

    await waitFor(() => {
      expect(screen.getByText(/Prescription Header Information \(Patient & Date Context\)/i)).toBeInTheDocument();
      expect(screen.getByText('Ama Mensah')).toBeInTheDocument();
      expect(screen.getByText('32y')).toBeInTheDocument();
      expect(screen.getByText('2026-11-13')).toBeInTheDocument();
    });
  });

  it('blocks 7-field confirmation when dose amount is missing and requires manual entry', async () => {
    const unconfirmedScanWithMissingDose: CommunityPrescriptionScan = {
      ...mockScan,
      items: [
        {
          ...mockScan.items[0],
          ocr_dose_amount: null,
          confidence_dose: 0.0,
          confirmed_dose_amount: null,
        },
      ],
    };
    vi.spyOn(api.community, 'listPrescriptions').mockResolvedValueOnce([unconfirmedScanWithMissingDose]);

    render(<PrescriptionScannerStudio />);

    await waitFor(() => {
      expect(screen.getByText(/Confirm & Lock 7-Field Gate/i)).toBeInTheDocument();
    });

    const lockBtn = screen.getByRole('button', { name: /Confirm & Lock 7-Field Gate/i });
    fireEvent.click(lockBtn);

    await waitFor(() => {
      expect(screen.getByText(/Validation Gate Blocked: Medication Item #1/i)).toBeInTheDocument();
      expect(screen.getByText(/missing required clinical fields: 4\. Dose Amount/i)).toBeInTheDocument();
      expect(api.community.confirmPrescriptionGate).not.toHaveBeenCalled();
    });
  });
});

