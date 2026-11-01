import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ChiefOversightDashboard } from './ChiefOversightDashboard';
import { EscalationQueueTable } from './EscalationQueueTable';
import { EscalationResolutionModal } from './EscalationResolutionModal';
import { ChiefOversightWorkspace } from './ChiefOversightWorkspace';
import { InventoryTable } from '../inventory/InventoryTable';
import { RestockModal } from '../inventory/RestockModal';
import { StockAdjustmentModal } from '../inventory/StockAdjustmentModal';
import { AuditAndOverrideLedger } from './AuditAndOverrideLedger';
import { api, ApiError } from '../../services/api';
import { AuthProvider } from '../../context/AuthContext';
import {
  ChiefOversightDashboardResponse,
  EscalationQueueItemResponse,
  EscalationResolutionResponse,
  InventoryItemResponse,
  InventoryItemDetailResponse,
  InventoryTransactionResponse,
  OverrideLedgerItem,
  AuditLogItem,
} from '../../types/api';

// ---------------------------------------------------------------------------
// Mock Fixtures
// ---------------------------------------------------------------------------

const mockDashboardData: ChiefOversightDashboardResponse = {
  inventory_summary: {
    total_items: 8,
    total_units_on_hand: 1907,
    low_stock_count: 1,
    out_of_stock_count: 0,
    adequate_stock_count: 7,
    total_inventory_value_cents: 228840,
    disclaimer: 'Formulary simulation summary',
  },
  inventory_exceptions: [
    {
      inventory_item_id: 'inv-synth-cef',
      medication_id: 'MED-CEF-500',
      generic_name: 'Cefdinir',
      brand_name: 'Omnicef',
      location: 'Central Pharmacy - Refrigerator 2',
      quantity_on_hand: 12,
      reorder_threshold: 25,
      deficit: 13,
      stock_status: 'LOW_STOCK',
      severity: 'MODERATE',
    },
  ],
  workflow_counts: {
    pending: 3,
    reviewed: 2,
    overridden: 1,
    escalated: 1,
    resolved: 1,
  },
  pending_escalations_count: 1,
  total_overrides_count: 1,
  recent_audit_events: [
    {
      id: 'audit-001',
      timestamp: '2026-11-01T02:00:00Z',
      actor_username: 'chief_demo',
      actor_role: 'chief_pharmacist',
      action: 'LOGIN_SUCCESS',
      entity_type: 'User',
      entity_id: 'usr-chief-001',
      details: { client: 'clinical-workstation' },
      ip_address: '127.0.0.1',
    },
  ],
  disclaimer: 'Antigravity Hospital Pharmacy Simulation',
};

const mockEscalations: EscalationQueueItemResponse[] = [
  {
    escalation_id: 'esc-001',
    prescription_id: 'rx-synth-003',
    prescription_number: 'RX-2026-0003',
    patient_id: 'pat-synth-003',
    patient_name: 'Margaret Chen',
    patient_mrn: 'SYNTH-MRN-003',
    prescriber_name: 'Dr. Gregory Hayes, MD',
    prescriber_department: 'Infectious Disease Unit',
    escalated_by_id: 'usr-staff-001',
    escalated_by_name: 'staff_demo',
    escalation_reason: 'Severe penicillin anaphylaxis cross-reactivity warning with cephalosporin',
    scenario_key: 'SCENARIO_3_CROSS_ALLERGY',
    created_at: '2026-11-01T01:15:00Z',
    findings_count: 2,
    has_high_severity_finding: true,
  },
];

const mockInventoryList: InventoryItemResponse[] = [
  {
    id: 'inv-item-001',
    medication_id: 'MED-AMOX-500',
    generic_name: 'Amoxicillin',
    brand_name: 'Amoxil',
    drug_class: 'Aminopenicillin',
    dosage_form: 'Oral Capsule',
    standard_strength: '500mg',
    location: 'Central Pharmacy - Carousel A-04',
    quantity_on_hand: 180,
    reorder_threshold: 50,
    stock_status: 'IN_STOCK',
    is_low_stock: false,
    lot_number: 'LOT-AMX-2026A',
    expiration_date: '2027-06-30',
    unit_cost_cents: 45,
    last_updated: '2026-10-31T08:00:00Z',
  },
  {
    id: 'inv-item-002',
    medication_id: 'MED-CEF-500',
    generic_name: 'Cefdinir',
    brand_name: 'Omnicef',
    drug_class: 'Third-Generation Cephalosporin',
    dosage_form: 'Oral Capsule',
    standard_strength: '300mg',
    location: 'Central Pharmacy - Refrigerator 2',
    quantity_on_hand: 12,
    reorder_threshold: 25,
    stock_status: 'LOW_STOCK',
    is_low_stock: true,
    lot_number: 'LOT-CEF-2026B',
    expiration_date: '2026-12-31',
    unit_cost_cents: 120,
    last_updated: '2026-10-31T09:00:00Z',
  },
];

const mockInventoryDetail: InventoryItemDetailResponse = {
  ...mockInventoryList[1],
  transactions: [
    {
      id: 'tx-001',
      inventory_item_id: 'inv-item-002',
      transaction_type: 'RESTOCK',
      quantity_delta: 20,
      quantity_after: 32,
      reason: 'Distributor delivery PO-8891',
      actor_id: 'usr-staff-001',
      actor_username: 'staff_demo',
      created_at: '2026-10-25T14:00:00Z',
    },
    {
      id: 'tx-002',
      inventory_item_id: 'inv-item-002',
      transaction_type: 'ADJUSTMENT',
      quantity_delta: -20,
      quantity_after: 12,
      reason: 'Dispensed for inpatient order',
      actor_id: 'usr-chief-001',
      actor_username: 'chief_demo',
      created_at: '2026-10-28T10:00:00Z',
    },
  ],
};

const mockOverridesList: OverrideLedgerItem[] = [
  {
    review_id: 'rev-001',
    prescription_id: 'rx-synth-002',
    prescription_number: 'RX-2026-0002',
    patient_name: 'Arthur Pendelton',
    reviewer_id: 'usr-staff-001',
    reviewer_name: 'staff_demo',
    action: 'OVERRIDE',
    override_rationale: 'Benefit of ketorolac outweighs short-term GI risk with PPI co-administration.',
    notes: 'Informed patient regarding GI warning signs.',
    findings_snapshotted: 1,
    created_at: '2026-10-31T15:30:00Z',
  },
];

const mockAuditList: AuditLogItem[] = [
  {
    id: 'aud-001',
    timestamp: '2026-11-01T02:30:00Z',
    actor_id: 'usr-chief-001',
    actor_username: 'chief_demo',
    actor_role: 'chief_pharmacist',
    action: 'ESCALATION_RESOLVED',
    entity_type: 'Prescription',
    entity_id: 'rx-synth-003',
    details: { action: 'APPROVED_BY_CHIEF', rationale: 'Verified safe with MD' },
    ip_address: '127.0.0.1',
  },
];

// Helper to wrap components in AuthProvider
const renderWithAuth = (ui: React.ReactElement) => {
  return render(<AuthProvider>{ui}</AuthProvider>);
};

describe('PharmacyGuard Stage 3: Chief Pharmacist Oversight & Workstation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('pharmacyguard_access_token', 'mock_chief_token');

    // Default mock implementations
    vi.spyOn(api.auth, 'me').mockResolvedValue({
      id: 'usr-chief-001',
      username: 'chief_demo',
      email: 'chief@pharmacyguard.hospital',
      full_name: 'Dr. Marcus Vance, PharmD',
      roles: ['chief_pharmacist'],
      is_active: true,
    });

    vi.spyOn(api.oversight, 'getDashboard').mockResolvedValue(mockDashboardData);
    vi.spyOn(api.oversight, 'getEscalations').mockResolvedValue(mockEscalations);
    vi.spyOn(api.inventory, 'list').mockResolvedValue(mockInventoryList);
    vi.spyOn(api.inventory, 'getSummary').mockResolvedValue(mockDashboardData.inventory_summary);
    vi.spyOn(api.inventory, 'getItemDetail').mockResolvedValue(mockInventoryDetail);
    vi.spyOn(api.oversight, 'getOverrideLedger').mockResolvedValue(mockOverridesList);
    vi.spyOn(api.oversight, 'getAuditLog').mockResolvedValue(mockAuditList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Executive Dashboard Tests
  // -------------------------------------------------------------------------
  describe('Chief Oversight Dashboard', () => {
    it('renders executive dashboard with inventory valuation, counters, and exceptions', async () => {
      const handleNavigate = vi.fn();
      renderWithAuth(<ChiefOversightDashboard onNavigateTab={handleNavigate} />);

      // Wait for loading to finish and content to render
      await waitFor(() => {
        expect(screen.getByText(/Executive Oversight & Pharmacy Operational Health/i)).toBeInTheDocument();
      });

      // Metric Cards
      expect(screen.getByText('$2,288.40')).toBeInTheDocument();
      expect(screen.getByText('1,907')).toBeInTheDocument();
      expect(screen.getByText('Cefdinir')).toBeInTheDocument();
      expect(screen.getByText('MED-CEF-500')).toBeInTheDocument();
      expect(screen.getByText('-13')).toBeInTheDocument();

      // Workflow Counts
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('Staff Reviewed')).toBeInTheDocument();
      expect(screen.getByText('Chief Resolved')).toBeInTheDocument();

      // Recent Audit Log
      expect(screen.getByText('LOGIN_SUCCESS')).toBeInTheDocument();
    });

    it('navigates to tabs when clicking shortcut buttons in metric cards', async () => {
      const handleNavigate = vi.fn();
      renderWithAuth(<ChiefOversightDashboard onNavigateTab={handleNavigate} />);

      await waitFor(() => {
        expect(screen.getByText(/Executive Oversight & Pharmacy Operational Health/i)).toBeInTheDocument();
      });

      // Click "Manage" on inventory valuation card
      const manageBtn = screen.getByRole('button', { name: /manage/i });
      fireEvent.click(manageBtn);
      expect(handleNavigate).toHaveBeenCalledWith('inventory');

      // Click "Resolve Cases" on escalations card
      const resolveCasesBtn = screen.getByRole('button', { name: /resolve cases/i });
      fireEvent.click(resolveCasesBtn);
      expect(handleNavigate).toHaveBeenCalledWith('escalations');
    });

    it('handles dashboard API failure gracefully with retry option', async () => {
      vi.spyOn(api.oversight, 'getDashboard').mockRejectedValueOnce(
        new ApiError(500, 'Internal Server Error', 'Database connection timeout')
      );

      renderWithAuth(<ChiefOversightDashboard onNavigateTab={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/Oversight Metrics Unavailable/i)).toBeInTheDocument();
        expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
      });

      // Verify retry button exists
      expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Escalation Queue & Resolution Workstation Tests
  // -------------------------------------------------------------------------
  describe('Escalations Queue & Resolution', () => {
    it('renders escalated prescriptions with clinical details and HIGH severity badge', async () => {
      renderWithAuth(<EscalationQueueTable onInspectPrescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('RX-2026-0003')).toBeInTheDocument();
        expect(screen.getByText('Margaret Chen')).toBeInTheDocument();
        expect(screen.getByText(/Severe penicillin anaphylaxis/i)).toBeInTheDocument();
      });

      // HIGH severity badge
      expect(screen.getAllByText(/HIGH/i).length).toBeGreaterThan(0);
      // Action button
      expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
    });

    it('filters escalations queue by search query', async () => {
      renderWithAuth(<EscalationQueueTable onInspectPrescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('RX-2026-0003')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search by rx#/i);
      fireEvent.change(searchInput, { target: { value: 'NONEXISTENT_RX' } });

      expect(screen.queryByText('RX-2026-0003')).not.toBeInTheDocument();
      expect(screen.getByText(/no escalations found/i)).toBeInTheDocument();
    });

    it('enforces minimum 5-character resolution notes in EscalationResolutionModal', async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithAuth(
        <EscalationResolutionModal
          isOpen={true}
          onClose={handleClose}
          escalation={mockEscalations[0]}
          onSuccess={handleSuccess}
        />
      );

      expect(screen.getByText(/Chief Pharmacist Escalation Determination/i)).toBeInTheDocument();

      // Submit button should be disabled when notes are < 5 characters
      const submitBtn = screen.getByRole('button', { name: /submit determination/i });
      expect(submitBtn).toBeDisabled();

      const notesTextarea = screen.getByLabelText(/clinical determination/i);
      // Type 4 characters -> still disabled
      fireEvent.change(notesTextarea, { target: { value: 'Test' } });
      expect(submitBtn).toBeDisabled();

      // Type >= 5 characters -> enabled
      fireEvent.change(notesTextarea, {
        target: { value: 'Verified with allergy consultant: confirmed tolerated in 2024.' },
      });
      expect(submitBtn).not.toBeDisabled();
    });

    it('submits APPROVED_BY_CHIEF successfully and notifies parent', async () => {
      const mockResolutionResponse: EscalationResolutionResponse = {
        status: 'success',
        prescription_id: 'rx-synth-003',
        prescription_number: 'RX-2026-0003',
        escalation_id: 'esc-001',
        resolution_action: 'APPROVED_BY_CHIEF',
        prescription_status: 'reviewed',
        resolved_at: '2026-11-01T02:30:00Z',
        resolved_by: 'chief_demo',
        disclaimer: 'Clinical simulation determination',
      };

      const resolveSpy = vi
        .spyOn(api.oversight, 'resolveEscalation')
        .mockResolvedValueOnce(mockResolutionResponse);

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithAuth(
        <EscalationResolutionModal
          isOpen={true}
          onClose={handleClose}
          escalation={mockEscalations[0]}
          onSuccess={handleSuccess}
        />
      );

      const notesTextarea = screen.getByLabelText(/clinical determination/i);
      fireEvent.change(notesTextarea, {
        target: { value: 'Approved under chief supervision following chart verification.' },
      });

      const submitBtn = screen.getByRole('button', { name: /submit determination/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(resolveSpy).toHaveBeenCalledWith('rx-synth-003', {
          resolution_action: 'APPROVED_BY_CHIEF',
          resolution_notes: 'Approved under chief supervision following chart verification.',
        });
        expect(handleSuccess).toHaveBeenCalledWith(mockResolutionResponse);
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('handles HTTP 409 Conflict (already resolved) without falsely claiming success', async () => {
      vi.spyOn(api.oversight, 'resolveEscalation').mockRejectedValueOnce(
        new ApiError(409, 'Conflict', 'This escalation has already been resolved.')
      );

      renderWithAuth(
        <EscalationResolutionModal
          isOpen={true}
          onClose={vi.fn()}
          escalation={mockEscalations[0]}
          onSuccess={vi.fn()}
        />
      );

      const notesTextarea = screen.getByLabelText(/clinical determination/i);
      fireEvent.change(notesTextarea, {
        target: { value: 'Valid clinical explanation of supervisory approval.' },
      });

      const submitBtn = screen.getByRole('button', { name: /submit determination/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/this escalation has already been resolved/i)
        ).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Central Inventory Management Tests
  // -------------------------------------------------------------------------
  describe('Central Inventory Workstation', () => {
    it('renders formulary items with balances, thresholds, and status badges', async () => {
      renderWithAuth(<InventoryTable />);

      await waitFor(() => {
        expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
        expect(screen.getByText('Cefdinir')).toBeInTheDocument();
      });

      expect(screen.getByText('180')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getAllByText(/In Stock/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Low Stock/i).length).toBeGreaterThan(0);
    });

    it('filters inventory items by stock status pill', async () => {
      renderWithAuth(<InventoryTable />);

      await waitFor(() => {
        expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
        expect(screen.getByText('Cefdinir')).toBeInTheDocument();
      });

      // Filter by Low Stock
      const lowStockFilter = screen.getByRole('button', { name: /low stock/i });
      fireEvent.click(lowStockFilter);

      // Cefdinir is low stock, Amoxicillin is in stock
      expect(screen.getByText('Cefdinir')).toBeInTheDocument();
      expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
    });

    it('opens inventory detail modal and displays transaction ledger', async () => {
      renderWithAuth(<InventoryTable />);

      await waitFor(() => {
        expect(screen.getByText('Cefdinir')).toBeInTheDocument();
      });

      // Click eye icon to view details
      const viewButtons = screen.getAllByTitle(/view perpetual audit history/i);
      fireEvent.click(viewButtons[1]); // Second item is Cefdinir

      await waitFor(() => {
        expect(screen.getByText(/Cefdinir — Perpetual Inventory Detail/i)).toBeInTheDocument();
        expect(screen.getByText(/Perpetual Transaction Ledger/i)).toBeInTheDocument();
        expect(screen.getByText('Distributor delivery PO-8891')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Stock Mutation & Safety Guards Tests
  // -------------------------------------------------------------------------
  describe('Stock Restock & Discrepancy Adjustments', () => {
    it('records a restock shipment receipt successfully', async () => {
      const mockRestockResponse: InventoryTransactionResponse = {
        status: 'success',
        transaction_id: 'tx-new-001',
        inventory_item_id: 'inv-item-001',
        medication_id: 'MED-AMOX-500',
        transaction_type: 'RESTOCK',
        quantity_delta: 50,
        quantity_before: 180,
        quantity_after: 230,
        reason: 'McKesson delivery PO-9912',
        created_at: '2026-11-01T02:40:00Z',
        actor_username: 'chief_demo',
        disclaimer: 'Formulary simulation transaction',
      };

      const recordSpy = vi
        .spyOn(api.inventory, 'recordTransaction')
        .mockResolvedValueOnce(mockRestockResponse);

      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      renderWithAuth(
        <RestockModal
          isOpen={true}
          onClose={handleClose}
          item={mockInventoryList[0]}
          onSuccess={handleSuccess}
        />
      );

      const quantityInput = screen.getByLabelText(/received units/i);
      fireEvent.change(quantityInput, { target: { value: '50' } });

      const reasonInput = screen.getByLabelText(/distributor invoice/i);
      fireEvent.change(reasonInput, { target: { value: 'McKesson delivery PO-9912' } });

      const submitBtn = screen.getByRole('button', { name: /confirm stock receipt/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(recordSpy).toHaveBeenCalledWith({
          medication_id: 'MED-AMOX-500',
          transaction_type: 'RESTOCK',
          quantity: 50,
          reason: 'McKesson delivery PO-9912',
        });
        expect(handleSuccess).toHaveBeenCalledWith(mockRestockResponse);
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('blocks stock adjustment when reason is shorter than 3 characters', async () => {
      renderWithAuth(
        <StockAdjustmentModal
          isOpen={true}
          onClose={vi.fn()}
          item={mockInventoryList[1]} // Cefdinir (quantity: 12)
          onSuccess={vi.fn()}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /commit adjustment/i });
      expect(submitBtn).toBeDisabled();

      const reasonInput = screen.getByLabelText(/discrepancy justification/i);
      // Type 2 characters
      fireEvent.change(reasonInput, { target: { value: 'Ok' } });
      expect(submitBtn).toBeDisabled();

      // Type >= 3 characters
      fireEvent.change(reasonInput, { target: { value: 'Broken vial on floor' } });
      expect(submitBtn).not.toBeDisabled();
    });

    it('blocks stock adjustment when decrement would cause negative inventory', async () => {
      renderWithAuth(
        <StockAdjustmentModal
          isOpen={true}
          onClose={vi.fn()}
          item={mockInventoryList[1]} // Cefdinir has 12 units on hand
          onSuccess={vi.fn()}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /commit adjustment/i });
      const reasonInput = screen.getByLabelText(/discrepancy justification/i);
      fireEvent.change(reasonInput, { target: { value: 'Discarded damaged supply' } });

      // Request a decrement of 20 units (current is 12, so 12 - 20 = -8)
      const quantityInput = screen.getByLabelText(/adjustment quantity/i);
      fireEvent.change(quantityInput, { target: { value: '20' } });

      // Guard should trigger: warning message displayed and submit button disabled
      expect(
        screen.getByText(/negative inventory guard: stock cannot fall below 0 units/i)
      ).toBeInTheDocument();
      expect(submitBtn).toBeDisabled();

      // Fix quantity to 5 (12 - 5 = 7 >= 0)
      fireEvent.change(quantityInput, { target: { value: '5' } });
      expect(
        screen.queryByText(/negative inventory guard: stock cannot fall below 0 units/i)
      ).not.toBeInTheDocument();
      expect(submitBtn).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Audit Log & Override Ledger Tests
  // -------------------------------------------------------------------------
  describe('Audit Log & Override Ledger View', () => {
    it('renders clinical overrides with justification rationales and system audit events', async () => {
      renderWithAuth(<AuditAndOverrideLedger />);

      await waitFor(() => {
        expect(screen.getByText('RX-2026-0002')).toBeInTheDocument();
        expect(
          screen.getByText(/Benefit of ketorolac outweighs short-term GI risk/i)
        ).toBeInTheDocument();
      });

      // Switch to System Audit Stream tab
      const auditTabBtn = screen.getByRole('button', { name: /system audit stream/i });
      fireEvent.click(auditTabBtn);

      await waitFor(() => {
        expect(screen.getByText('ESCALATION_RESOLVED')).toBeInTheDocument();
        expect(screen.getByText('chief_demo')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 6. Chief Oversight Workspace Navigation Shell Tests
  // -------------------------------------------------------------------------
  describe('Chief Oversight Workspace Shell', () => {
    it('mounts all tabs and switches views cleanly', async () => {
      renderWithAuth(<ChiefOversightWorkspace initialTab="overview" />);

      // Starts on Executive Dashboard
      await waitFor(() => {
        expect(screen.getByText(/Executive Oversight & Pharmacy Operational Health/i)).toBeInTheDocument();
      });

      // Click "Escalations Workstation" tab
      const escalationsTab = screen.getByRole('button', { name: /escalations workstation/i });
      fireEvent.click(escalationsTab);

      await waitFor(() => {
        expect(screen.getByText(/Chief Pharmacist Escalation Workstation/i)).toBeInTheDocument();
      });

      // Click "Central Inventory" tab
      const inventoryTab = screen.getByRole('button', { name: /central inventory/i });
      fireEvent.click(inventoryTab);

      await waitFor(() => {
        expect(screen.getByText(/Central Pharmacy Perpetual Inventory/i)).toBeInTheDocument();
      });

      // Click "Audit & Override Ledger" tab
      const auditTab = screen.getByRole('button', { name: /audit & override ledger/i });
      fireEvent.click(auditTab);

      await waitFor(() => {
        expect(screen.getByText(/Compliance, Safety Overrides & System Audit Ledger/i)).toBeInTheDocument();
      });
    });
  });
});
