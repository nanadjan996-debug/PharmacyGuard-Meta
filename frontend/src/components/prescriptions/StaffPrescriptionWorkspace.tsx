import React, { useState, useEffect } from 'react';
import { PrescriptionQueueTable } from './PrescriptionQueueTable';
import { PrescriptionDetailPanel } from './PrescriptionDetailPanel';

export interface StaffPrescriptionWorkspaceProps {
  initialPrescriptionId?: string | null;
}

export const StaffPrescriptionWorkspace: React.FC<StaffPrescriptionWorkspaceProps> = ({
  initialPrescriptionId = null,
}) => {
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(() => {
    if (initialPrescriptionId) return initialPrescriptionId;
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('rx');
    }
    return null;
  });

  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Sync selected prescription to URL query parameter (?rx=...)
  const handleSelectPrescription = (id: string) => {
    setSelectedPrescriptionId(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('rx', id);
      window.history.pushState({}, '', url.toString());
    }
  };

  const handleBackToQueue = () => {
    setSelectedPrescriptionId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('rx');
      window.history.pushState({}, '', url.toString());
    }
  };

  // Sync on popstate
  useEffect(() => {
    const handlePopState = () => {
      const rxParam = new URLSearchParams(window.location.search).get('rx');
      setSelectedPrescriptionId(rxParam);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleActionComplete = () => {
    // Increment trigger to refresh queue in background
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {selectedPrescriptionId ? (
        <PrescriptionDetailPanel
          prescriptionId={selectedPrescriptionId}
          onBack={handleBackToQueue}
          onActionComplete={handleActionComplete}
        />
      ) : (
        <PrescriptionQueueTable
          onSelectPrescription={handleSelectPrescription}
          selectedPrescriptionId={selectedPrescriptionId}
          refreshTrigger={refreshTrigger}
        />
      )}
    </div>
  );
};
