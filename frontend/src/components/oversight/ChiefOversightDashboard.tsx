import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  AlertTriangle,
  FileCheck2,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { ChiefOversightDashboardResponse } from '../../types/api';
import { Button } from '../common/Button';
import { SeverityBadge } from '../common/SeverityBadge';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface ChiefOversightDashboardProps {
  onNavigateTab: (tab: 'overview' | 'escalations' | 'inventory' | 'audit') => void;
  onSelectMedicationForRestock?: (medicationId: string) => void;
}

export const ChiefOversightDashboard: React.FC<ChiefOversightDashboardProps> = ({
  onNavigateTab,
  onSelectMedicationForRestock,
}) => {
  const [data, setData] = useState<ChiefOversightDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await api.oversight.getDashboard();
      setData(response);
      setLastRefreshed(new Date());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setError('Failed to load executive oversight dashboard.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDateTime = (isoString?: string | unknown): string => {
    if (!isoString || typeof isoString !== 'string') return '—';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return String(isoString);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="oversight-loading-state">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonLoader type="card" count={4} />
        </div>
        <SkeletonLoader type="table" count={5} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="p-8 bg-white dark:bg-slate-900 border border-red-200 dark:border-rose-900/40 rounded-2xl text-center space-y-4 shadow-2xs"
        data-testid="oversight-error-state"
      >
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Oversight Metrics Unavailable</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">{error || 'Unable to load executive metrics.'}</p>
        <Button onClick={() => fetchDashboard()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const {
    inventory_summary: invSummary,
    inventory_exceptions: invExceptions,
    workflow_counts: wfCounts,
    pending_escalations_count,
    total_overrides_count,
    recent_audit_events,
  } = data;

  const totalExceptions = (invSummary?.low_stock_count || 0) + (invSummary?.out_of_stock_count || 0);

  return (
    <div className="space-y-6" data-testid="chief-oversight-dashboard">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            Executive Oversight & Pharmacy Operational Health
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time aggregate data across clinical verification workflows, central stock balances, and compliance ledgers.
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5" />
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchDashboard(true)}
            isLoading={isRefreshing}
            aria-label="Refresh oversight metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Inventory Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inventory Valuation</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 font-mono">
                {formatCurrency(invSummary?.total_inventory_value_cents || 0)}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{(invSummary?.total_units_on_hand || 0).toLocaleString()}</span> total units on hand
              </p>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">{invSummary?.total_items || 0} formulary medications</span>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-sky-600 hover:text-sky-700 dark:text-sky-400 font-medium flex items-center gap-1"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Stock Exceptions Alert */}
        <div className={`border rounded-2xl p-5 shadow-2xs transition ${
          totalExceptions > 0 ? 'border-amber-200/80 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/10' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stock Exceptions</p>
              <h3 className={`text-2xl font-bold mt-1.5 font-mono ${totalExceptions > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-200'}`}>
                {totalExceptions}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {invSummary?.out_of_stock_count || 0} out of stock · {invSummary?.low_stock_count || 0} below reorder
              </p>
            </div>
            <div className={`p-3 rounded-xl border ${
              totalExceptions > 0
                ? 'bg-amber-100/70 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800/50 dark:text-amber-400'
                : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800/60 dark:border-slate-700/50 dark:text-slate-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">{invSummary?.adequate_stock_count || 0} adequate stock</span>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-amber-600 hover:text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1"
            >
              Review Deficits <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Pending Escalations */}
        <div className={`border rounded-2xl p-5 shadow-2xs transition ${
          pending_escalations_count > 0 ? 'border-orange-200/80 bg-orange-50/30 dark:border-orange-900/60 dark:bg-orange-950/10' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
        }`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Escalations</p>
              <h3 className={`text-2xl font-bold mt-1.5 font-mono ${pending_escalations_count > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-slate-200'}`}>
                {pending_escalations_count}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Awaiting Chief Pharmacist determination</p>
            </div>
            <div className={`p-3 rounded-xl border ${
              pending_escalations_count > 0
                ? 'bg-orange-100/70 border-orange-200 text-orange-700 dark:bg-orange-950/60 dark:border-orange-800/50 dark:text-orange-400'
                : 'bg-slate-100 border-slate-200 text-slate-500 dark:bg-slate-800/60 dark:border-slate-700/50 dark:text-slate-400'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">High priority clinical holds</span>
            <button
              onClick={() => onNavigateTab('escalations')}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 font-medium flex items-center gap-1"
            >
              Resolve Cases <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Clinical Overrides */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Overrides</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5 font-mono">
                {total_overrides_count}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Staff clinical override rationales recorded</p>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800/40 rounded-xl text-purple-600 dark:text-purple-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Compliance & audit tracked</span>
            <button
              onClick={() => onNavigateTab('audit')}
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-medium flex items-center gap-1"
            >
              View Ledger <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Inventory Exceptions Alert Box */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Active Formulary Stock Exceptions</h3>
            <span className="text-xs bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
              {invExceptions.length} requiring action
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigateTab('inventory')}
            className="text-xs"
          >
            Open Central Inventory
            <ExternalLink className="w-3 h-3 ml-1.5" />
          </Button>
        </div>

        {invExceptions.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            <Boxes className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            All formulary medications are currently operating above configured safety thresholds.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-xs uppercase font-semibold text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Medication</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3 text-right">Deficit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                {invExceptions.map((ex) => (
                  <tr key={ex.inventory_item_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{ex.generic_name}</div>
                      <div className="text-xs text-slate-400">{ex.brand_name} · <span className="font-mono text-slate-400">{ex.medication_id}</span></div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{ex.location}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {ex.quantity_on_hand}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                      {ex.reorder_threshold}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{ex.deficit}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ex.stock_status} />
                    </td>
                    <td className="px-4 py-3">
                      <SeverityBadge severity={ex.severity as any} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onSelectMedicationForRestock && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSelectMedicationForRestock(ex.medication_id)}
                          className="text-xs py-1 px-2.5"
                        >
                          Restock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prescription Workflow Pipeline Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          Clinical Verification Workflow Distribution
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Pending Review</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">{wfCounts?.pending ?? 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Staff Reviewed</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{wfCounts?.reviewed ?? 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Overridden</span>
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">{wfCounts?.overridden ?? 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Escalated</span>
            <span className="text-xl font-bold text-orange-600 dark:text-orange-400 font-mono">{wfCounts?.escalated ?? 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Chief Resolved</span>
            <span className="text-xl font-bold text-sky-600 dark:text-sky-400 font-mono">{wfCounts?.resolved ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Recent System Audit Events */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Security & Compliance Audit Log</h3>
            <span className="text-xs bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-medium">
              Latest {recent_audit_events.length} events
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigateTab('audit')}
            className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            Full Audit Stream <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {recent_audit_events.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-sm">
            No audit records registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800">
              <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-xs uppercase font-semibold text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Actor</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Entity</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs font-mono bg-white dark:bg-slate-900">
                {recent_audit_events.map((evt, idx) => (
                  <tr key={String(evt.id || idx)} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(evt.timestamp)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-slate-900 dark:text-slate-200 font-medium">{String(evt.actor_username || 'SYSTEM')}</span>
                      {Boolean(evt.actor_role) && (
                        <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {String(evt.actor_role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-sky-700 dark:text-sky-300 font-semibold">{String(evt.action || 'EVENT')}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {String(evt.entity_type || '—')}: {String(evt.entity_id || '—').substring(0, 8)}...
                    </td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs truncate font-sans">
                      {evt.details ? JSON.stringify(evt.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
