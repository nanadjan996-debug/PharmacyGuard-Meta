import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Boxes,
  Search,
  RefreshCw,
  PackagePlus,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Eye,
  MapPin,
  TrendingDown,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  InventoryItemResponse,
  InventorySummaryResponse,
  InventoryTransactionResponse,
} from '../../types/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';
import { RestockModal } from './RestockModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { InventoryDetailModal } from './InventoryDetailModal';

interface InventoryTableProps {
  initialMedicationIdForRestock?: string | null;
  onClearInitialMedication?: () => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  initialMedicationIdForRestock,
  onClearInitialMedication,
}) => {
  const { hasRole } = useAuth();
  const isChief = hasRole('chief_pharmacist');

  const [items, setItems] = useState<InventoryItemResponse[]>([]);
  const [summary, setSummary] = useState<InventorySummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('all');

  // Modals state
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<string | null>(null);
  const [selectedItemForRestock, setSelectedItemForRestock] = useState<InventoryItemResponse | null>(null);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItemResponse | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const fetchInventory = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [itemsRes, summaryRes] = await Promise.all([
        api.inventory.list(),
        api.inventory.getSummary(),
      ]);
      setItems(itemsRes);
      setSummary(summaryRes);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setError('Failed to load central pharmacy inventory.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Handle auto-open restock modal if navigated from dashboard exception banner
  useEffect(() => {
    if (initialMedicationIdForRestock && items.length > 0) {
      const match = items.find((i) => i.medication_id === initialMedicationIdForRestock);
      if (match) {
        setSelectedItemForRestock(match);
      }
      if (onClearInitialMedication) {
        onClearInitialMedication();
      }
    }
  }, [initialMedicationIdForRestock, items, onClearInitialMedication]);

  const handleRestockSuccess = (res: InventoryTransactionResponse) => {
    setBannerMessage(
      `Restock recorded: added ${res.quantity_delta} units to ${res.medication_id}. New balance: ${res.quantity_after} units.`
    );
    fetchInventory(true);
  };

  const handleAdjustSuccess = (res: InventoryTransactionResponse) => {
    const deltaStr = res.quantity_delta > 0 ? `+${res.quantity_delta}` : `${res.quantity_delta}`;
    setBannerMessage(
      `Adjustment recorded: ${deltaStr} units on ${res.medication_id}. New balance: ${res.quantity_after} units.`
    );
    fetchInventory(true);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.stock_status !== statusFilter) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.generic_name.toLowerCase().includes(q) ||
        item.brand_name.toLowerCase().includes(q) ||
        item.medication_id.toLowerCase().includes(q) ||
        item.drug_class.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [items, statusFilter, searchQuery]);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6" data-testid="central-inventory-workstation">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/40 dark:from-slate-850 dark:to-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Central Pharmacy Perpetual Inventory
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-1">
            Real-time formulary stock counts, vault locations, threshold replenishment, and auditable discrepancy ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchInventory(true)}
            isLoading={isRefreshing}
            className="shadow-2xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Balances
          </Button>
        </div>
      </div>

      {/* Summary Chips */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">Formulary Items</span>
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{summary.total_items}</span>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">Total Physical Units</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {summary.total_units_on_hand.toLocaleString()}
            </span>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">Inventory Valuation</span>
            <span className="text-2xl font-bold font-mono text-sky-700 dark:text-sky-400">
              {formatCurrency(summary.total_inventory_value_cents)}
            </span>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider block mb-1">Stock Exceptions</span>
            <span className={`text-2xl font-bold font-mono ${
              summary.low_stock_count + summary.out_of_stock_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {summary.low_stock_count + summary.out_of_stock_count}
            </span>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {bannerMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{bannerMessage}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search and Status Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by drug name, brand, MED ID, class, or vault location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="text-xs font-semibold"
          >
            All Stock
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'IN_STOCK' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('IN_STOCK')}
            className="text-xs font-semibold"
          >
            In Stock
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'LOW_STOCK' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('LOW_STOCK')}
            className="text-xs flex items-center gap-1 font-semibold"
          >
            <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            Low Stock
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'OUT_OF_STOCK' ? 'primary' : 'outline'}
            onClick={() => setStatusFilter('OUT_OF_STOCK')}
            className="text-xs flex items-center gap-1 font-semibold"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Out of Stock
          </Button>

          {(searchQuery || statusFilter !== 'all') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <SkeletonLoader type="table" count={6} />
      ) : error ? (
        <div className="p-8 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/40 rounded-xl text-center space-y-4 shadow-2xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Error Loading Inventory</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">{error}</p>
          <Button onClick={() => fetchInventory()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="No Formulary Items Match"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'No medications found matching your current search or stock status filters.'
              : 'No formulary items registered in the central inventory database.'
          }
          action={
            searchQuery || statusFilter !== 'all'
              ? {
                  label: 'Reset Filters',
                  onClick: () => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Medication</th>
                  <th className="px-4 py-3">Form & Class</th>
                  <th className="px-4 py-3">Vault Location</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Threshold</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    {/* Medication */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {item.generic_name}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {item.brand_name} · <span className="font-mono text-slate-500 dark:text-slate-400 font-semibold">{item.medication_id}</span>
                      </div>
                    </td>

                    {/* Form & Class */}
                    <td className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{item.dosage_form} · {item.standard_strength}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">{item.drug_class}</div>
                    </td>

                    {/* Vault Location */}
                    <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        {item.location}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">Lot: {item.lot_number}</div>
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-sm">
                      <span className={item.quantity_on_hand <= item.reorder_threshold ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}>
                        {item.quantity_on_hand}
                      </span>
                    </td>

                    {/* Reorder Threshold */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {item.reorder_threshold}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={item.stock_status} />
                    </td>

                    {/* Unit Cost */}
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {formatCurrency(item.unit_cost_cents)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedItemForDetail(item.medication_id)}
                          className="text-xs p-1.5"
                          title="View Perpetual Audit History"
                        >
                          <Eye className="w-4 h-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedItemForRestock(item)}
                          className="text-xs py-1 px-2.5 font-semibold"
                        >
                          <PackagePlus className="w-3.5 h-3.5 mr-1" />
                          Restock
                        </Button>
                        {isChief && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedItemForAdjust(item)}
                            className="text-xs py-1 px-2.5 font-semibold"
                            title="Supervisory Stock Adjustment"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                            Adjust
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <RestockModal
        isOpen={selectedItemForRestock !== null}
        onClose={() => setSelectedItemForRestock(null)}
        item={selectedItemForRestock}
        onSuccess={handleRestockSuccess}
      />

      {/* Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={selectedItemForAdjust !== null}
        onClose={() => setSelectedItemForAdjust(null)}
        item={selectedItemForAdjust}
        onSuccess={handleAdjustSuccess}
      />

      {/* Detail Modal */}
      <InventoryDetailModal
        isOpen={selectedItemForDetail !== null}
        onClose={() => setSelectedItemForDetail(null)}
        medicationId={selectedItemForDetail}
        onOpenRestock={(it) => setSelectedItemForRestock(it)}
        onOpenAdjust={(it) => setSelectedItemForAdjust(it)}
        isChief={isChief}
      />
    </div>
  );
};
