import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  User,
  AlertCircle,
  FileCheck2,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { OverrideLedgerItem, AuditLogItem } from '../../types/api';
import { Button } from '../common/Button';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';

export const AuditAndOverrideLedger: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'overrides' | 'audit'>('overrides');

  // Override Ledger State
  const [overrides, setOverrides] = useState<OverrideLedgerItem[]>([]);
  const [isOverridesLoading, setIsOverridesLoading] = useState<boolean>(true);
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [overrideSearch, setOverrideSearch] = useState<string>('');

  // Audit Log State
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState<boolean>(true);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchOverrides = useCallback(async () => {
    setIsOverridesLoading(true);
    setOverridesError(null);
    try {
      const data = await api.oversight.getOverrideLedger();
      setOverrides(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setOverridesError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setOverridesError('Failed to load clinical override ledger.');
      }
    } finally {
      setIsOverridesLoading(false);
    }
  }, []);

  const fetchAuditLog = useCallback(async () => {
    setIsAuditLoading(true);
    setAuditError(null);
    try {
      const data = await api.oversight.getAuditLog(100);
      setAuditEvents(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setAuditError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setAuditError('Failed to load system audit event log.');
      }
    } finally {
      setIsAuditLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    await Promise.all([fetchOverrides(), fetchAuditLog()]);
    if (isRefresh) setIsRefreshing(false);
  }, [fetchOverrides, fetchAuditLog]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const toggleExpand = (id: string) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDateTime = (isoString?: string | null): string => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  // Filtered Overrides
  const filteredOverrides = useMemo(() => {
    if (!overrideSearch.trim()) return overrides;
    const q = overrideSearch.toLowerCase().trim();
    return overrides.filter(
      (o) =>
        o.prescription_number.toLowerCase().includes(q) ||
        o.patient_name.toLowerCase().includes(q) ||
        o.reviewer_name.toLowerCase().includes(q) ||
        (o.override_rationale && o.override_rationale.toLowerCase().includes(q))
    );
  }, [overrides, overrideSearch]);

  // Filtered Audit Events
  const filteredAuditEvents = useMemo(() => {
    if (!auditSearch.trim()) return auditEvents;
    const q = auditSearch.toLowerCase().trim();
    return auditEvents.filter(
      (e) =>
        (e.action && e.action.toLowerCase().includes(q)) ||
        (e.actor_username && e.actor_username.toLowerCase().includes(q)) ||
        (e.actor_role && e.actor_role.toLowerCase().includes(q)) ||
        (e.entity_type && e.entity_type.toLowerCase().includes(q)) ||
        (e.entity_id && e.entity_id.toLowerCase().includes(q))
    );
  }, [auditEvents, auditSearch]);

  return (
    <div className="space-y-6" data-testid="audit-override-ledger-view">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            Compliance, Safety Overrides & System Audit Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable supervisory records of clinical safety overrides, justification rationales, and security events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchAll(true)}
            isLoading={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Records
          </Button>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-800 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveSubTab('overrides')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition ${
            activeSubTab === 'overrides'
              ? 'border-purple-500 text-purple-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Clinical Override Ledger
          <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full font-mono text-slate-300">
            {overrides.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition ${
            activeSubTab === 'audit'
              ? 'border-indigo-500 text-indigo-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          System Audit Stream
          <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full font-mono text-slate-300">
            {auditEvents.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Clinical Override Ledger */}
      {activeSubTab === 'overrides' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search overrides by patient, Rx#, reviewer..."
              value={overrideSearch}
              onChange={(e) => setOverrideSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {isOverridesLoading ? (
            <SkeletonLoader type="table" count={5} />
          ) : overridesError ? (
            <div className="p-8 bg-slate-900 border border-rose-900/40 rounded-xl text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Error Loading Override Ledger</h4>
              <p className="text-xs text-slate-400">{overridesError}</p>
              <Button size="sm" variant="outline" onClick={fetchOverrides}>
                Retry
              </Button>
            </div>
          ) : filteredOverrides.length === 0 ? (
            <EmptyState
              title="No Clinical Overrides Found"
              description={
                overrideSearch
                  ? 'No override records match your search criteria.'
                  : 'No staff pharmacist safety overrides have been recorded in the database.'
              }
              action={
                overrideSearch
                  ? {
                      label: 'Clear Search',
                      onClick: () => setOverrideSearch(''),
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
                      <th className="px-4 py-3">Reviewer</th>
                      <th className="px-4 py-3">Safety Action</th>
                      <th className="px-4 py-3">Documented Clinical Override Rationale</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredOverrides.map((ovr) => (
                      <tr key={ovr.review_id} className="hover:bg-slate-800/40 transition">
                        {/* Rx & Patient */}
                        <td className="px-4 py-3.5">
                          <div className="font-mono text-xs font-semibold text-indigo-400">
                            {ovr.prescription_number}
                          </div>
                          <div className="font-medium text-white text-sm mt-0.5">
                            {ovr.patient_name}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Snapshotted: {ovr.findings_snapshotted} findings
                          </span>
                        </td>

                        {/* Reviewer */}
                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          <div className="font-medium text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {ovr.reviewer_name}
                          </div>
                          <span className="text-slate-500 text-[11px]">Pharmacist</span>
                        </td>

                        {/* Action Badge */}
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-800/50">
                            {ovr.action}
                          </span>
                        </td>

                        {/* Override Rationale Box */}
                        <td className="px-4 py-3.5 max-w-md">
                          <div className="p-2.5 bg-purple-950/20 border border-purple-900/40 rounded-lg text-xs space-y-1">
                            <div className="font-semibold text-purple-300 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Clinical Justification:
                            </div>
                            <p className="text-slate-200 whitespace-pre-wrap">
                              {ovr.override_rationale || '—'}
                            </p>
                            {ovr.notes && (
                              <p className="text-slate-400 text-[11px] border-t border-purple-900/30 pt-1 mt-1">
                                Additional Notes: {ovr.notes}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                          {formatDateTime(ovr.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: System Audit Stream */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit events by action, actor, role, or entity..."
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {isAuditLoading ? (
            <SkeletonLoader type="table" count={6} />
          ) : auditError ? (
            <div className="p-8 bg-slate-900 border border-rose-900/40 rounded-xl text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Error Loading Audit Log</h4>
              <p className="text-xs text-slate-400">{auditError}</p>
              <Button size="sm" variant="outline" onClick={fetchAuditLog}>
                Retry
              </Button>
            </div>
          ) : filteredAuditEvents.length === 0 ? (
            <EmptyState
              title="No Audit Events Found"
              description={
                auditSearch
                  ? 'No system audit events match your search term.'
                  : 'No security or audit events recorded in the system yet.'
              }
              action={
                auditSearch
                  ? {
                      label: 'Clear Search',
                      onClick: () => setAuditSearch(''),
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
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor & Role</th>
                      <th className="px-4 py-3">Action Event</th>
                      <th className="px-4 py-3">Target Entity</th>
                      <th className="px-4 py-3">Client IP</th>
                      <th className="px-4 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs font-mono">
                    {filteredAuditEvents.map((evt) => {
                      const isExpanded = expandedEventIds.has(evt.id);
                      return (
                        <React.Fragment key={evt.id}>
                          <tr className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {formatDateTime(evt.timestamp)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-slate-200 font-medium">
                                {evt.actor_username || 'SYSTEM'}
                              </span>
                              {evt.actor_role && (
                                <span className="ml-1.5 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-sans">
                                  {evt.actor_role}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-indigo-400 font-semibold">{evt.action}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-400">
                              <span className="text-slate-300">{evt.entity_type}</span>:{' '}
                              {evt.entity_id ? `${evt.entity_id.substring(0, 8)}...` : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{evt.ip_address || '—'}</td>
                            <td className="px-4 py-3 text-right">
                              {evt.details ? (
                                <button
                                  onClick={() => toggleExpand(evt.id)}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 font-sans inline-flex items-center gap-1"
                                >
                                  {isExpanded ? 'Hide' : 'Inspect'}
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && evt.details && (
                            <tr className="bg-slate-950/80">
                              <td colSpan={6} className="px-6 py-3 border-t border-slate-800">
                                <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto bg-slate-900 p-3 rounded-lg border border-slate-800">
                                  {JSON.stringify(evt.details, null, 2)}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
