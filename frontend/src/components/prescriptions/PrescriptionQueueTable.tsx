import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { PrescriptionQueueItemResponse } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { Button } from '../common/Button';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';

export interface PrescriptionQueueTableProps {
  onSelectPrescription: (prescriptionId: string) => void;
  selectedPrescriptionId?: string | null;
  refreshTrigger?: number;
}

export const PrescriptionQueueTable: React.FC<PrescriptionQueueTableProps> = ({
  onSelectPrescription,
  selectedPrescriptionId,
  refreshTrigger = 0,
}) => {
  const [queue, setQueue] = useState<PrescriptionQueueItemResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [highSeverityOnly, setHighSeverityOnly] = useState<boolean>(false);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.prescriptions.listQueue();
      setQueue(data);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load prescription verification queue.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue, refreshTrigger]);

  // Client-side filtering across supported fields
  const filteredQueue = useMemo(() => {
    return queue.filter((item) => {
      // 1. Status filter
      if (statusFilter !== 'ALL' && item.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      // 2. High severity filter
      if (highSeverityOnly && !item.has_high_severity_finding) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRx = item.prescription_number.toLowerCase().includes(query);
        const matchesPatient = item.patient_name.toLowerCase().includes(query);
        const matchesMrn = item.patient_mrn.toLowerCase().includes(query);
        const matchesPrescriber = item.prescriber_name.toLowerCase().includes(query);
        const matchesDept = item.prescriber_department.toLowerCase().includes(query);
        const matchesScenario = item.scenario_key ? item.scenario_key.toLowerCase().includes(query) : false;

        if (!matchesRx && !matchesPatient && !matchesMrn && !matchesPrescriber && !matchesDept && !matchesScenario) {
          return false;
        }
      }

      return true;
    });
  }, [queue, statusFilter, highSeverityOnly, searchQuery]);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
      {/* Table Header & Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Clinical Prescription Queue
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                {filteredQueue.length} {filteredQueue.length === 1 ? 'order' : 'orders'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live hospital orders pending pharmacist verification, interaction checking, and clinical review.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              isLoading={isLoading}
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={fetchQueue}
            >
              Refresh Queue
            </Button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          {/* Search box */}
          <div className="sm:col-span-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RX #, patient, MRN, prescriber..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter dropdown */}
          <div className="sm:col-span-3">
            <div className="relative">
              <select
                aria-label="Filter queue by prescription status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-1.5 pl-3 pr-8 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              >
                <option value="ALL">All Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="reviewed">Accepted</option>
                <option value="overridden">Overridden</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* High severity quick filter pill */}
          <div className="sm:col-span-3 flex items-center">
            <button
              type="button"
              onClick={() => setHighSeverityOnly(!highSeverityOnly)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 border transition-all select-none ${
                highSeverityOnly
                  ? 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${highSeverityOnly ? 'bg-red-600 animate-pulse' : 'bg-slate-300'}`} />
              <span className="truncate">High Severity Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-6 m-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
            Unable to Retrieve Prescription Queue
          </h3>
          <p className="text-xs text-red-700 dark:text-red-400 max-w-md mx-auto">{error}</p>
          <Button variant="danger" size="sm" onClick={fetchQueue}>
            Retry Request
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && queue.length === 0 && (
        <div className="p-6">
          <SkeletonLoader type="table" count={5} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredQueue.length === 0 && (
        <EmptyState
          title="No Prescriptions Found"
          description={
            searchQuery || statusFilter !== 'ALL' || highSeverityOnly
              ? 'No prescription orders match the active filter criteria. Try resetting your search or filters.'
              : 'The prescription verification queue is currently empty.'
          }
          action={
            searchQuery || statusFilter !== 'ALL' || highSeverityOnly
              ? {
                  label: 'Reset Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setHighSeverityOnly(false);
                  },
                }
              : undefined
          }
          className="m-4"
        />
      )}

      {/* Responsive Queue Table */}
      {!isLoading && !error && filteredQueue.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
              <tr>
                <th scope="col" className="py-3 pl-4 sm:pl-6 pr-3">Prescription & Scenario</th>
                <th scope="col" className="py-3 px-3">Patient Information</th>
                <th scope="col" className="py-3 px-3 hidden md:table-cell">Prescriber</th>
                <th scope="col" className="py-3 px-3">Safety Findings</th>
                <th scope="col" className="py-3 px-3">Status</th>
                <th scope="col" className="py-3 px-3 hidden lg:table-cell">Submitted</th>
                <th scope="col" className="py-3 pr-4 sm:pr-6 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {filteredQueue.map((item) => {
                const isSelected = selectedPrescriptionId === item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onSelectPrescription(item.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Prescription Number & Scenario */}
                    <td className="py-3 pl-4 sm:pl-6 pr-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {item.prescription_number}
                        </span>
                        {item.scenario_key && (
                          <span className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            {item.scenario_key}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Patient Name & MRN */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.patient_name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          MRN: {item.patient_mrn}
                        </span>
                      </div>
                    </td>

                    {/* Prescriber */}
                    <td className="py-3 px-3 hidden md:table-cell">
                      <div className="flex flex-col">
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {item.prescriber_name}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate max-w-xs">
                          {item.prescriber_department}
                        </span>
                      </div>
                    </td>

                    {/* Safety Findings & Severity */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {item.has_high_severity_finding ? (
                          <SeverityBadge severity="HIGH" size="sm" />
                        ) : item.findings_count > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span>{item.findings_count} findings</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None logged</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge status={item.status} size="sm" />
                    </td>

                    {/* Submitted time */}
                    <td className="py-3 px-3 hidden lg:table-cell whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    {/* Action Button */}
                    <td className="py-3 pr-4 sm:pr-6 pl-3 text-right whitespace-nowrap">
                      <Button
                        variant={isSelected ? 'primary' : 'outline'}
                        size="xs"
                        icon={<ChevronRight className="w-3.5 h-3.5" />}
                        iconPosition="right"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPrescription(item.id);
                        }}
                      >
                        {item.status === 'pending' ? 'Review' : 'Inspect'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
