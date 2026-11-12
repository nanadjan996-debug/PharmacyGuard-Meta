import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../App';
import { api, ApiError } from '../services/api';
import {
  UserProfileResponse,
  PrescriptionQueueItemResponse,
  PrescriptionDetailResponse,
  EscalationQueueItemResponse,
  ChiefOversightDashboardResponse,
  InventoryItemResponse,
  InventoryItemDetailResponse,
} from '../types/api';

// Actor profiles
const mockStaffUser: UserProfileResponse = {
  id: 'usr-staff-001',
  username: 'pharmacist_demo',
  email: 'staff.mercer@pharmacyguard.internal',
  full_name: 'Dr. Alex Mercer, PharmD',
  is_active: true,
  roles: ['staff_pharmacist'],
};

const mockChiefUser: UserProfileResponse = {
  id: 'usr-chief-001',
  username: 'chief_demo',
  email: 'sarah.lin@pharmacyguard.internal',
  full_name: 'Dr. Sarah Lin, PharmD, BCPS',
  is_active: true,
  roles: ['chief_pharmacist', 'staff_pharmacist'],
};

const mockStudentUser: UserProfileResponse = {
  id: 'usr-student-001',
  username: 'student_demo',
  email: 'jordan.taylor@pharmacyguard.internal',
  full_name: 'Jordan Taylor',
  is_active: true,
  roles: ['pharmacy_student'],
};

// Fixtures
const mockPrescriptionQueueItem: PrescriptionQueueItemResponse = {
  id: 'rx-test-001',
  prescription_number: 'RX-2026-9001',
  patient_id: 'pat-001',
  patient_name: 'Eleanor Vance',
  patient_mrn: 'MRN-7741',
  prescriber_name: 'Dr. Robert Thorne',
  prescriber_department: 'Cardiology',
  status: 'pending',
  scenario_key: 'WARFARIN_AMIODARONE',
  created_at: '2026-11-01T08:00:00Z',
  findings_count: 1,
  has_high_severity_finding: true,
};

const mockPrescriptionDetail: PrescriptionDetailResponse = {
  id: 'rx-test-001',
  prescription_number: 'RX-2026-9001',
  patient_id: 'pat-001',
  patient_name: 'Eleanor Vance',
  patient_mrn: 'MRN-7741',
  patient_dob: '1958-04-12',
  patient_gender: 'Female',
  patient_weight_kg: 68.0,
  patient_height_cm: 165.0,
  prescriber_name: 'Dr. Robert Thorne',
  prescriber_department: 'Cardiology',
  status: 'pending',
  scenario_key: 'WARFARIN_AMIODARONE',
  clinical_notes: 'Routine maintenance following valve replacement.',
  created_at: '2026-11-01T08:00:00Z',
  items: [
    {
      id: 'item-001',
      medication_id: 'MED-WAR-001',
      generic_name: 'Warfarin Sodium',
      brand_name: 'Coumadin',
      drug_class: 'Anticoagulant',
      dose_amount: 5.0,
      dose_unit: 'mg',
      frequency: 'Once daily',
      route: 'Oral',
      duration_days: 30,
      quantity_prescribed: 30,
      instructions: 'Take 1 tablet by mouth daily in evening',
    },
  ],
  findings: [
    {
      id: 'f-001',
      rule_identifier: 'RULE-INT-WAR-01',
      category: 'INTERACTION',
      severity: 'HIGH',
      status: 'pending',
      evidence: 'Concurrent Amiodarone severely potentiates Warfarin anticoagulant effect.',
      rule_source: 'Deterministic Clinical Interaction Monograph',
      human_review_required: true,
    },
  ],
  reviews: [],
  escalations: [],
};

const mockEscalationItem: EscalationQueueItemResponse = {
  escalation_id: 'esc-test-001',
  prescription_id: 'rx-test-001',
  prescription_number: 'RX-2026-9001',
  patient_id: 'pat-001',
  patient_name: 'Eleanor Vance',
  patient_mrn: 'MRN-7741',
  prescriber_name: 'Dr. Robert Thorne',
  prescriber_department: 'Cardiology',
  escalated_by_id: 'usr-staff-001',
  escalated_by_name: 'Dr. Alex Mercer',
  escalation_reason: 'Complex interaction requiring supervisory dosage guidance',
  scenario_key: 'WARFARIN_AMIODARONE',
  created_at: '2026-11-01T08:15:00Z',
  findings_count: 1,
  has_high_severity_finding: true,
};

const mockChiefDashboard: ChiefOversightDashboardResponse = {
  inventory_summary: {
    total_items: 12,
    total_units_on_hand: 2400,
    low_stock_count: 1,
    out_of_stock_count: 0,
    adequate_stock_count: 11,
    total_inventory_value_cents: 890000,
    disclaimer: 'Prototype inventory valuation.',
  },
  inventory_exceptions: [],
  workflow_counts: {
    pending: 1,
    reviewed: 4,
    escalated: 1,
  },
  pending_escalations_count: 1,
  total_overrides_count: 2,
  recent_audit_events: [],
  disclaimer: 'Advisory Chief Oversight Prototype.',
};

const mockInventoryItem: InventoryItemResponse = {
  id: 'inv-item-001',
  medication_id: 'MED-WAR-001',
  generic_name: 'Warfarin Sodium',
  brand_name: 'Coumadin',
  drug_class: 'Anticoagulant',
  dosage_form: 'Tablet',
  standard_strength: '5 mg',
  location: 'Cabinet B-04',
  quantity_on_hand: 150,
  reorder_threshold: 50,
  stock_status: 'IN_STOCK',
  is_low_stock: false,
  lot_number: 'LOT-WAR-99',
  expiration_date: '2027-12-31',
  unit_cost_cents: 45,
  last_updated: '2026-11-01T08:00:00Z',
};

const mockInventoryDetail: InventoryItemDetailResponse = {
  ...mockInventoryItem,
  transactions: [
    {
      id: 'txn-001',
      inventory_item_id: 'inv-item-001',
      transaction_type: 'RESTOCK',
      quantity_delta: 50,
      quantity_after: 150,
      reason: 'Routine stock delivery receipt',
      actor_id: 'usr-staff-001',
      actor_username: 'pharmacist_demo',
      created_at: '2026-11-01T08:00:00Z',
    },
  ],
};

describe('PharmacyGuard Stage 5: System Hardening & Cross-Role E2E Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Cross-Role Operational Workflow (Staff -> Review/Override -> Chief Escalation)
  // =========================================================================
  describe('Operational Prescription Review & Escalation Resolution', () => {
    it('executes complete Staff review with mandatory rationale enforcement on high-severity findings', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'valid-staff-token');
      vi.spyOn(api.auth, 'me').mockResolvedValue(mockStaffUser);
      vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValue([mockPrescriptionQueueItem]);
      vi.spyOn(api.prescriptions, 'getDetail').mockResolvedValue(mockPrescriptionDetail);
      const reviewSpy = vi.spyOn(api.prescriptions, 'submitReview').mockResolvedValueOnce({
        status: 'success',
        prescription_id: 'rx-test-001',
        prescription_number: 'RX-2026-9001',
        action: 'OVERRIDE',
        new_status: 'overridden',
        review_id: 'rev-test-001',
        findings_snapshotted: 1,
        disclaimer: 'Clinical decision support prototype.',
        created_at: '2026-11-01T08:30:00Z',
      });

      render(<App />);

      // Wait for staff queue to load
      await waitFor(() => {
        expect(screen.getByText('RX-2026-9001')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Click Review on the prescription
      fireEvent.click(screen.getByRole('button', { name: /Review/i }));

      // Detail panel opens
      await waitFor(() => {
        expect(screen.getByText('Warfarin Sodium')).toBeInTheDocument();
        expect(screen.getByText('HIGH SEVERITY')).toBeInTheDocument();
      });

      // Open Override modal
      fireEvent.click(screen.getByRole('button', { name: /^Override$/i }));

      // Check modal opens
      expect(screen.getByText(/Submit Pharmacist Decision: RX-2026-9001/i)).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: /Confirm OVERRIDE/i });

      // Attempting to submit without rationale is blocked
      fireEvent.click(confirmBtn);
      expect(screen.getByText(/Override rationale is mandatory when accepting or overriding a prescription with high-priority clinical findings/i)).toBeInTheDocument();
      expect(reviewSpy).not.toHaveBeenCalled();

      // Enter valid clinical rationale
      const rationaleInput = screen.getByLabelText(/Written Clinical Rationale/i);
      fireEvent.change(rationaleInput, {
        target: { value: 'Patient INR is monitored weekly at anticoagulation clinic; dose adjusted accordingly.' },
      });

      // Submit override
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(reviewSpy).toHaveBeenCalledWith('rx-test-001', {
          action: 'OVERRIDE',
          override_rationale: 'Patient INR is monitored weekly at anticoagulation clinic; dose adjusted accordingly.',
          notes: undefined,
        });
      });
    }, 15000);

    it('Chief Pharmacist handles HTTP 409 Conflict when escalation was already resolved', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'valid-chief-token');
      window.history.pushState({}, '', '/?workspace=chief&tab=escalations');
      vi.spyOn(api.auth, 'me').mockResolvedValue(mockChiefUser);
      vi.spyOn(api.oversight, 'getDashboard').mockResolvedValue(mockChiefDashboard);
      vi.spyOn(api.oversight, 'getEscalations').mockResolvedValue([mockEscalationItem]);
      vi.spyOn(api.oversight, 'resolveEscalation').mockRejectedValueOnce(
        new ApiError(409, 'Conflict: Escalation has already been resolved by another administrator.')
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('RX-2026-9001')).toBeInTheDocument();
      }, { timeout: 10000 });

      // Click Resolve button in queue table
      const resolveBtn = screen.getByRole('button', { name: /^Resolve$/i });
      fireEvent.click(resolveBtn);

      // Modal opens
      await waitFor(() => {
        expect(screen.getByText(/Chief Pharmacist Escalation Determination/i)).toBeInTheDocument();
      });

      // Enter resolution notes (>= 5 chars)
      const notesInput = screen.getByLabelText(/Clinical Determination & Supervisory Rationale Notes/i);
      fireEvent.change(notesInput, {
        target: { value: 'Approved under strict laboratory surveillance' },
      });

      // Submit determination
      const submitBtn = screen.getByRole('button', { name: /Submit Determination/i });
      fireEvent.click(submitBtn);

      // Error banner displays 409 conflict explanation
      await waitFor(() => {
        expect(
          screen.getByText(/This escalation has already been resolved or the prescription status has changed/i)
        ).toBeInTheDocument();
      });
    }, 15000);
  });

  // =========================================================================
  // 2. Security Boundaries & Cross-Role Negative Access
  // =========================================================================
  describe('Security Boundaries & RBAC Hardening', () => {
    it('strictly denies Pharmacy Student access to operational Chief oversight', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'student-token');
      window.history.pushState({}, '', '/?workspace=chief');
      vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStudentUser);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
        expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
      });
    });

    it('strictly denies Staff Pharmacist access to Chief oversight workspace', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'staff-token');
      window.history.pushState({}, '', '/?workspace=chief');
      vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      });
    });

    it('strictly denies Chief Pharmacist access to Pharmacy Student workspace', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'chief-token');
      window.history.pushState({}, '', '/?workspace=student');
      vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockChiefUser);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 3. Central Inventory Management & Discrepancy Auditing
  // =========================================================================
  describe('Inventory Hardening & Adjustment Controls', () => {
    it('allows Chief Pharmacist to record stock adjustment with non-empty audited reason', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'chief-token');
      window.history.pushState({}, '', '/?workspace=chief&tab=inventory');
      vi.spyOn(api.auth, 'me').mockResolvedValue(mockChiefUser);
      vi.spyOn(api.oversight, 'getDashboard').mockResolvedValue(mockChiefDashboard);
      vi.spyOn(api.inventory, 'list').mockResolvedValue([mockInventoryItem]);
      vi.spyOn(api.inventory, 'getSummary').mockResolvedValue(mockChiefDashboard.inventory_summary);
      vi.spyOn(api.inventory, 'getItemDetail').mockResolvedValue(mockInventoryDetail);
      const adjustSpy = vi.spyOn(api.inventory, 'recordTransaction').mockResolvedValueOnce({
        status: 'success',
        transaction_id: 'txn-adj-001',
        inventory_item_id: 'inv-item-001',
        medication_id: 'MED-WAR-001',
        transaction_type: 'ADJUSTMENT',
        quantity_delta: -5,
        quantity_before: 150,
        quantity_after: 145,
        reason: 'Physical cycle count shrinkage correction',
        created_at: '2026-11-01T08:45:00Z',
        actor_username: 'chief_demo',
        disclaimer: 'Inventory audit prototype.',
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Warfarin Sodium')).toBeInTheDocument();
      });

      // Click Adjust button in inventory table
      const adjustBtn = screen.getByRole('button', { name: /Adjust/i });
      fireEvent.click(adjustBtn);

      await waitFor(() => {
        expect(screen.getByText(/Commit Adjustment/i)).toBeInTheDocument();
      });

      // Enter quantity and reason
      const qtyInput = screen.getByLabelText(/Adjustment Quantity/i);
      fireEvent.change(qtyInput, { target: { value: '5' } });

      const reasonInput = screen.getByLabelText(/Discrepancy Justification/i);
      fireEvent.change(reasonInput, { target: { value: 'Physical cycle count shrinkage correction' } });

      // Click Commit Adjustment
      const commitBtn = screen.getByRole('button', { name: /Commit Adjustment/i });
      fireEvent.click(commitBtn);

      await waitFor(() => {
        expect(adjustSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            medication_id: 'MED-WAR-001',
            transaction_type: 'ADJUSTMENT',
            quantity: 5,
            direction: 'DECREASE',
            reason: 'Physical cycle count shrinkage correction',
          })
        );
      });
    }, 15000);
  });

  // =========================================================================
  // 4. Session Eviction & Error Recovery
  // =========================================================================
  describe('Reliability & Error Handling', () => {
    it('evicts session when token validation returns HTTP 401 Unauthorized', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'expired-token');
      vi.spyOn(api.auth, 'me').mockRejectedValueOnce(
        new ApiError(401, 'Unauthorized: Access token has expired or is invalid.')
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/Workstation Username/i)).toBeInTheDocument();
      });

      expect(localStorage.getItem('pharmacyguard_access_token')).toBeNull();
    });

    it('evicts active session and redirects to LoginView when api.notifyUnauthorized() triggers', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'valid-staff-token');
      vi.spyOn(api.auth, 'me').mockResolvedValue(mockStaffUser);
      vi.spyOn(api.prescriptions, 'listQueue').mockResolvedValue([mockPrescriptionQueueItem]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('RX-2026-9001')).toBeInTheDocument();
      }, { timeout: 10000 });

      act(() => {
        api.notifyUnauthorized();
      });

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
        expect(screen.getByText(/Your session has expired or authentication failed/i)).toBeInTheDocument();
      });

      expect(localStorage.getItem('pharmacyguard_access_token')).toBeNull();
    });

    it('handles network failure with retry option without crashing', async () => {
      localStorage.setItem('pharmacyguard_access_token', 'valid-staff-token');
      vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);
      const listSpy = vi
        .spyOn(api.prescriptions, 'listQueue')
        .mockRejectedValueOnce(new ApiError(500, 'Internal Server Error'))
        .mockResolvedValueOnce([mockPrescriptionQueueItem]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to Retrieve Prescription Queue/i)).toBeInTheDocument();
      });

      // Click Retry Request
      fireEvent.click(screen.getByRole('button', { name: /Retry Request/i }));

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledTimes(2);
        expect(screen.getByText('RX-2026-9001')).toBeInTheDocument();
      });
    });
  });
});
