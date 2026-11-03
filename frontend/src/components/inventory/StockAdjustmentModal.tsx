import React, { useState } from 'react';
import {
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { InventoryItemResponse, InventoryTransactionResponse } from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItemResponse | null;
  onSuccess: (res: InventoryTransactionResponse) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [quantity, setQuantity] = useState<number | ''>(5);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!item) return null;

  const numQuantity = Number(quantity);
  const isValidQuantity = numQuantity > 0 && Number.isInteger(numQuantity);
  const trimmedReason = reason.trim();

  // Negative balance guard: backend will 422 if quantity_after < 0
  const projectedBalance = isValidQuantity
    ? direction === 'INCREASE'
      ? item.quantity_on_hand + numQuantity
      : item.quantity_on_hand - numQuantity
    : item.quantity_on_hand;

  const isNegative = projectedBalance < 0;
  const isReasonTooShort = trimmedReason.length < 3; // Backend field validator requirement

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidQuantity) {
      setError('Please specify a positive integer quantity for this adjustment.');
      return;
    }

    if (isNegative) {
      setError('Adjustment rejected: stock balance cannot fall below zero units.');
      return;
    }

    if (isReasonTooShort) {
      setError('Audited clinical justification must be at least 3 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.inventory.recordTransaction({
        medication_id: item.medication_id,
        transaction_type: 'ADJUSTMENT',
        direction,
        quantity: numQuantity,
        reason: trimmedReason,
      });

      onSuccess(res);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Permission Denied: Stock adjustments are restricted to Chief Pharmacists.');
        } else if (err.status === 422) {
          setError(typeof err.detail === 'string' ? err.detail : 'Validation error: Reason must be at least 3 characters and stock cannot be negative.');
        } else {
          setError(typeof err.detail === 'string' ? err.detail : err.message);
        }
      } else {
        setError('Failed to record stock discrepancy adjustment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Chief Stock Discrepancy Adjustment"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5" data-testid="stock-adjustment-form">
        {/* Chief Authorization Callout */}
        <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 shadow-2xs">
          <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold block text-indigo-950 dark:text-white mb-0.5">Restricted Supervisory Action</strong>
            Adjustments modify perpetual inventory counts for waste, cycle count corrections, or breakage. Every transaction is permanently audited in the ledger.
          </div>
        </div>

        {/* Medication Context */}
        <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.medication_id}</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{item.generic_name}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.brand_name} · {item.dosage_form}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Current Balance</span>
              <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">{item.quantity_on_hand}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">units</span>
            </div>
          </div>
        </div>

        {/* Adjustment Direction */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
            Adjustment Direction
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDirection('DECREASE')}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-2xs ${
                direction === 'DECREASE'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/60 ring-2 ring-rose-500/40 text-rose-900 dark:text-rose-200'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${direction === 'DECREASE' ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-bold block ${direction === 'DECREASE' ? 'text-rose-950 dark:text-white' : 'text-slate-900 dark:text-slate-200'}`}>Decrease (-)</span>
                <span className={`text-[11px] block mt-0.5 ${direction === 'DECREASE' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>Waste, breakage, expired</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDirection('INCREASE')}
              className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer shadow-2xs ${
                direction === 'INCREASE'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/60 ring-2 ring-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/50'
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${direction === 'INCREASE' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-bold block ${direction === 'INCREASE' ? 'text-emerald-950 dark:text-white' : 'text-slate-900 dark:text-slate-200'}`}>Increase (+)</span>
                <span className={`text-[11px] block mt-0.5 ${direction === 'INCREASE' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>Found stock, recount</span>
              </div>
            </button>
          </div>
        </div>

        {/* Quantity Field */}
        <div>
          <label htmlFor="adjust-quantity" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Adjustment Quantity (Units) <span className="text-red-500">*</span>
          </label>
          <input
            id="adjust-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs font-mono font-medium"
            placeholder="e.g. 5"
          />

          {/* Real-time Projected Balance Preview */}
          <div className="mt-2 text-xs flex justify-between items-center p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400 font-medium">Projected Balance:</span>
            <span
              className={`font-mono font-bold ${
                isNegative ? 'text-red-600 dark:text-red-400 animate-pulse font-extrabold' : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {item.quantity_on_hand} {direction === 'INCREASE' ? '+' : '-'} {numQuantity || 0} = {projectedBalance} units
            </span>
          </div>

          {isNegative && (
            <div className="mt-1.5 p-2.5 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>Negative Inventory Guard: Stock cannot fall below 0 units (current balance: {item.quantity_on_hand}).</span>
            </div>
          )}
        </div>

        {/* Mandatory Reason */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="adjust-reason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Discrepancy Justification / Clinical Audit Reason <span className="text-red-500">*</span>
            </label>
            <span className={`text-[11px] font-mono font-semibold ${isReasonTooShort ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {trimmedReason.length}/3 min chars
            </span>
          </div>
          <textarea
            id="adjust-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Dropped vial during preparation, verified discarded with second witness."
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs resize-none"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!isValidQuantity || isNegative || isReasonTooShort}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Commit Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
