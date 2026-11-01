import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShieldAlert,
  Boxes,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { ChiefOversightDashboard } from './ChiefOversightDashboard';
import { EscalationQueueTable } from './EscalationQueueTable';
import { InventoryTable } from '../inventory/InventoryTable';
import { AuditAndOverrideLedger } from './AuditAndOverrideLedger';
import { PrescriptionDetailPanel } from '../prescriptions/PrescriptionDetailPanel';
import { Button } from '../common/Button';

export type ChiefOversightTab = 'overview' | 'escalations' | 'inventory' | 'audit';

export interface ChiefOversightWorkspaceProps {
  initialTab?: ChiefOversightTab;
}

export const ChiefOversightWorkspace: React.FC<ChiefOversightWorkspaceProps> = ({
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<ChiefOversightTab>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab') as ChiefOversightTab;
      if (tabParam && ['overview', 'escalations', 'inventory', 'audit'].includes(tabParam)) {
        return tabParam;
      }
    }
    return initialTab;
  });

  const [inspectedPrescriptionId, setInspectedPrescriptionId] = useState<string | null>(null);
  const [restockMedicationId, setRestockMedicationId] = useState<string | null>(null);

  const handleTabChange = (tab: ChiefOversightTab) => {
    setActiveTab(tab);
    setInspectedPrescriptionId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      url.searchParams.delete('rx');
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleSelectMedicationForRestock = (medicationId: string) => {
    setRestockMedicationId(medicationId);
    handleTabChange('inventory');
  };

  const handleInspectPrescription = (prescriptionId: string) => {
    setInspectedPrescriptionId(prescriptionId);
  };

  const handleBackFromInspection = () => {
    setInspectedPrescriptionId(null);
  };

  // Sync with browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const tabParam = new URLSearchParams(window.location.search).get('tab') as ChiefOversightTab;
      if (tabParam && ['overview', 'escalations', 'inventory', 'audit'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="space-y-6" data-testid="chief-oversight-workspace">
      {/* If a prescription is currently being inspected in clinical detail view */}
      {inspectedPrescriptionId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackFromInspection}
              className="text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Return to Escalation Queue
            </Button>
            <span className="text-xs text-indigo-400 font-mono">
              Chief Pharmacist Clinical Inspection View
            </span>
          </div>
          <PrescriptionDetailPanel
            prescriptionId={inspectedPrescriptionId}
            onBack={handleBackFromInspection}
          />
        </div>
      ) : (
        <>
          {/* Chief Workspace Main Tab Bar */}
          <div className="flex border-b border-slate-800 gap-2 sm:gap-6 overflow-x-auto pb-1 text-sm font-medium">
            <button
              onClick={() => handleTabChange('overview')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Executive Dashboard
            </button>

            <button
              onClick={() => handleTabChange('escalations')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === 'escalations'
                  ? 'border-orange-500 text-orange-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Escalations Workstation
            </button>

            <button
              onClick={() => handleTabChange('inventory')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === 'inventory'
                  ? 'border-emerald-500 text-emerald-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Boxes className="w-4 h-4" />
              Central Inventory
            </button>

            <button
              onClick={() => handleTabChange('audit')}
              className={`pb-3 px-2 border-b-2 flex items-center gap-2 whitespace-nowrap transition ${
                activeTab === 'audit'
                  ? 'border-purple-500 text-purple-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Audit & Override Ledger
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="pt-2">
            {activeTab === 'overview' && (
              <ChiefOversightDashboard
                onNavigateTab={handleTabChange}
                onSelectMedicationForRestock={handleSelectMedicationForRestock}
              />
            )}

            {activeTab === 'escalations' && (
              <EscalationQueueTable
                onInspectPrescription={handleInspectPrescription}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryTable
                initialMedicationIdForRestock={restockMedicationId}
                onClearInitialMedication={() => setRestockMedicationId(null)}
              />
            )}

            {activeTab === 'audit' && <AuditAndOverrideLedger />}
          </div>
        </>
      )}
    </div>
  );
};
