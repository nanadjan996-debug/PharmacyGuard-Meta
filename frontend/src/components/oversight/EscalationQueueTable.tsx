import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Building,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { EscalationQueueItemResponse, EscalationResolutionResponse } from '../../types/api';
import { Button } from '../common/Button';
import { SeverityBadge } from '../common/SeverityBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';
import { EscalationResolutionModal } from './EscalationResolutionModal';

interface EscalationQueueTableProps {
  onInspectPrescription?: (prescriptionId: string) => void;
}

export const EscalationQueueTable: React.FC<EscalationQueueTableProps> = ({
  onInspectPrescription,
}) => {
  const [escalations, setEscalations] = useState<EscalationQueueItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterHighSeverityOnly, setFilterHighSeverityOnly] = useState<boolean>(false);

  // Resolution modal state
  const [activeItem, setActiveItem] = useState<EscalationQueueItemResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchEscalations = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await api.oversight.getEscalations();
      setEscalations(response);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setError('Failed to fetch pending escalations queue.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  const handleOpenResolveModal = (item: EscalationQueueItemResponse) => {
    setActiveItem(item);
    setIsModalOpen(true);
  };

  const handleResolutionSuccess = (res: EscalationResolutionResponse) => {
    setSuccessBanner(
      `Prescription ${res.prescription_number} successfully resolved via ${res.resolution_action.replace(/_/g, ' ')}.`
    );
    fetchEscalations(true);
  };

  // Filtered escalations
  const filteredEscalations = useMemo(() => {
    return escalations.filter((item) => {
      if (filterHighSeverityOnly && !item.has_high_severity_finding) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      return (
        item.prescription_number.toLowerCase().includes(q) ||
        item.patient_name.toLowerCase().includes(q) ||
        item.patient_mrn.toLowerCase().includes(q) ||
        item.prescriber_name.toLowerCase().includes(q) ||
        item.escalated_by_name.toLowerCase().includes(q) ||
        (item.scenario_key && item.scenario_key.toLowerCase().includes(q)) ||
        item.escalation_reason.toLowerCase().includes(q)
      );
    });
  }, [escalations, searchQuery, filterHighSeverityOnly]);

  const formatDateTime = (isoString?: string): string => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6" data-testid="escalations-workstation">
      {/* Workstation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-orange-400" />
            Chief Pharmacist Escalation Workstation
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Clinical holds requiring administrative determination, safety override approval, or prescriber consultation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchEscalations(true)}
            isLoading={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Controls Bar: Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Rx#, patient name, MRN, clinician..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            size="sm"
            variant={filterHighSeverityOnly ? 'primary' : 'outline'}
            onClick={() => setFilterHighSeverityOnly(!filterHighSeverityOnly)}
            className="text-xs flex items-center gap-1.5"
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${filterHighSeverityOnly ? 'text-white' : 'text-amber-400'}`} />
            High Severity Only
            {filterHighSeverityOnly && <span className="ml-1 font-bold">✓</span>}
          </Button>
          {(searchQuery || filterHighSeverityOnly) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                setFilterHighSeverityOnly(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>

      {/* Queue Table */}
      {isLoading ? (
        <SkeletonLoader type="table" count={5} />
      ) : error ? (
        <div className="p-8 bg-slate-900 border border-rose-900/40 rounded-xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">Error Loading Escalations</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">{error}</p>
          <Button onClick={() => fetchEscalations()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : filteredEscalations.length === 0 ? (
        <EmptyState
          title="No Escalations Found"
          description={
            searchQuery || filterHighSeverityOnly
              ? 'No pending escalations match your search and filter criteria.'
              : 'There are currently no clinical holds or escalated prescriptions requiring Chief Pharmacist determination.'
          }
          action={
            searchQuery || filterHighSeverityOnly
              ? {
                  label: 'Clear Search & Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setFilterHighSeverityOnly(false);
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Prescription & Patient</th>
                  <th className="px-4 py-3">Prescribing Clinician</th>
                  <th className="px-4 py-3">Escalating Pharmacist</th>
                  <th className="px-4 py-3">Escalation Reason</th>
                  <th className="px-4 py-3 text-center">Safety Findings</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredEscalations.map((item) => (
                  <tr key={item.escalation_id} className="hover:bg-slate-800/40 transition">
                    {/* Prescription & Patient */}
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-xs font-semibold text-indigo-400">
                        {item.prescription_number}
                      </div>
                      <div className="font-medium text-white text-sm mt-0.5">
                        {item.patient_name}
                      </div>
                      <div className="text-xs text-slate-400">MRN: {item.patient_mrn}</div>
                      {item.scenario_key && (
                        <span className="inline-block mt-1 text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          {item.scenario_key}
                        </span>
                      )}
                    </td>

                    {/* Prescriber */}
                    <td className="px-4 py-3.5 text-xs">
                      <div className="text-slate-200 font-medium flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {item.prescriber_name}
                      </div>
                      <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {item.prescriber_department}
                      </div>
                    </td>

                    {/* Escalating Pharmacist */}
                    <td className="px-4 py-3.5 text-xs text-slate-300">
                      <div className="font-medium">{item.escalated_by_name}</div>
                      <div className="text-slate-500 text-[11px]">Staff Pharmacist</div>
                    </td>

                    {/* Reason */}
                    <td className="px-4 py-3.5 max-w-xs text-xs text-slate-300">
                      <p className="line-clamp-2 text-amber-300/90 bg-amber-950/20 p-2 rounded border border-amber-900/30">
                        {item.escalation_reason}
                      </p>
                    </td>

                    {/* Findings & Severity */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {item.has_high_severity_finding ? (
                          <SeverityBadge severity="HIGH" />
                        ) : (
                          <span className="text-xs text-slate-400">Standard</span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {item.findings_count} finding{item.findings_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    </td>

                    {/* Submission Time */}
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatDateTime(item.created_at)}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {onInspectPrescription && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onInspectPrescription(item.prescription_id)}
                            className="text-xs p-1.5"
                            title="Inspect Clinical Order Details"
                          >
                            <FileText className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleOpenResolveModal(item)}
                          className="text-xs"
                        >
                          Resolve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution Modal */}
      <EscalationResolutionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveItem(null);
        }}
        escalation={activeItem}
        onSuccess={handleResolutionSuccess}
      />
    </div>
  );
};
