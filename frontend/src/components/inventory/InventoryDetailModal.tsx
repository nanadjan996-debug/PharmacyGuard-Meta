import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  PackagePlus,
  SlidersHorizontal,
  Clock,
  AlertCircle,
  Layers,
  MapPin,
  DollarSign,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  InventoryItemDetailResponse,
  InventoryItemResponse,
} from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonLoader } from '../common/SkeletonLoader';

interface InventoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicationId: string | null;
  onOpenRestock: (item: InventoryItemResponse) => void;
  onOpenAdjust: (item: InventoryItemResponse) => void;
  isChief: boolean;
}

export const InventoryDetailModal: React.FC<InventoryDetailModalProps> = ({
  isOpen,
  onClose,
  medicationId,
  onOpenRestock,
  onOpenAdjust,
  isChief,
}) => {
  const [itemDetail, setItemDetail] = useState<InventoryItemDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.inventory.getItemDetail(id);
      setItemDetail(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setError('Failed to load medication inventory details and transaction history.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && medicationId) {
      fetchDetail(medicationId);
    } else {
      setItemDetail(null);
      setError(null);
    }
  }, [isOpen, medicationId, fetchDetail]);

  const formatCurrency = (cents: number): string => {
    return `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={itemDetail ? `${itemDetail.generic_name} — Perpetual Inventory Detail` : 'Formulary Item Detail'}
      maxWidth="xl"
    >
      {isLoading ? (
        <div className="space-y-4 py-4" data-testid="inventory-detail-loading">
          <SkeletonLoader type="card" count={2} />
          <SkeletonLoader type="table" count={3} />
        </div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-rose-900/40 rounded-xl text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h4 className="text-base font-semibold text-white">Item Data Unavailable</h4>
          <p className="text-xs text-slate-400">{error}</p>
          <Button size="sm" variant="outline" onClick={() => medicationId && fetchDetail(medicationId)}>
            Retry
          </Button>
        </div>
      ) : itemDetail ? (
        <div className="space-y-6" data-testid="inventory-detail-content">
          {/* Item Clinical & Storage Metadata */}
          <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {itemDetail.medication_id}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {itemDetail.generic_name}{' '}
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-normal">({itemDetail.brand_name})</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  {itemDetail.drug_class} · {itemDetail.standard_strength} ({itemDetail.dosage_form})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={itemDetail.stock_status} />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium mb-1">
                  <Boxes className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  On Hand
                </span>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                  {itemDetail.quantity_on_hand}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">units</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium mb-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  Reorder Threshold
                </span>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-300">
                  {itemDetail.reorder_threshold}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">units (baseline)</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Unit Acquisition
                </span>
                <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(itemDetail.unit_cost_cents)}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">per unit</span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium mb-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Vault Location
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate block">
                  {itemDetail.location}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono block">Lot: {itemDetail.lot_number}</span>
              </div>
            </div>
          </div>

          {/* Chronological Inventory Transaction History */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Perpetual Transaction Ledger
                </h4>
              </div>
              <span className="text-xs bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2.5 py-0.5 rounded-full font-mono font-medium">
                {itemDetail.transactions?.length || 0} events
              </span>
            </div>

            {!itemDetail.transactions || itemDetail.transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2 opacity-60" />
                No inventory receipts or adjustments recorded for this formulary item yet.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950/70 text-[11px] uppercase font-semibold text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-2">Timestamp</th>
                      <th className="px-4 py-2">Transaction Type</th>
                      <th className="px-4 py-2 text-right">Delta</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2">Audited Justification</th>
                      <th className="px-4 py-2">Audited Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                    {itemDetail.transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="px-4 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                              tx.transaction_type === 'RESTOCK'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-400 dark:border-emerald-800/50'
                                : 'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/70 dark:text-purple-400 dark:border-purple-800/50'
                            }`}
                          >
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold whitespace-nowrap">
                          {tx.quantity_delta > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{tx.quantity_delta}</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400">{tx.quantity_delta}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-slate-200">
                          {tx.quantity_after}
                        </td>
                        <td className="px-4 py-2 font-sans text-slate-600 dark:text-slate-400 max-w-xs truncate font-medium">
                          {tx.reason || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-semibold">
                          {tx.actor_username || 'SYSTEM'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500">
              Perpetual ledger updates atomically on every approved dispensing and shipment receipt.
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onOpenRestock(itemDetail);
                }}
              >
                <PackagePlus className="w-4 h-4 mr-1.5" />
                Receive Stock
              </Button>
              {isChief && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    onOpenAdjust(itemDetail);
                  }}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-1.5" />
                  Adjust Discrepancy
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
