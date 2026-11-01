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
        <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl flex items-start gap-2.5 text-xs text-indigo-300">
          <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-indigo-200">Restricted Supervisory Action</span>
            Adjustments modify perpetual inventory counts for waste, cycle count corrections, or breakage. Every transaction is permanently audited.
          </div>
        </div>

        {/* Medication Context */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono text-indigo-400 font-semibold">{item.medication_id}</span>
              <h4 className="text-sm font-semibold text-white">{item.generic_name}</h4>
              <p className="text-xs text-slate-400">{item.brand_name} · {item.dosage_form}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Current Balance</span>
              <span className="text-base font-mono font-bold text-slate-200">{item.quantity_on_hand}</span> units
            </div>
          </div>
        </div>

        {/* Adjustment Direction */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Adjustment Direction
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDirection('DECREASE')}
              className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                direction === 'DECREASE'
                  ? 'bg-rose-950/40 border-rose-500/60 ring-1 ring-rose-500/40 text-rose-300'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
              <div>
                <span className="text-xs font-bold block text-white">Decrease (-)</span>
                <span className="text-[11px] text-slate-400">Waste, breakage, expired</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDirection('INCREASE')}
              className={`p-3 rounded-xl border text-left flex items-center gap-3 transition ${
                direction === 'INCREASE'
                  ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-bold block text-white">Increase (+)</span>
                <span className="text-[11px] text-slate-400">Found stock, recount</span>
              </div>
            </button>
          </div>
        </div>

        {/* Quantity Field */}
        <div>
          <label htmlFor="adjust-quantity" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Adjustment Quantity (Units) <span className="text-rose-400">*</span>
          </label>
          <input
            id="adjust-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="e.g. 5"
          />

          {/* Real-time Projected Balance Preview */}
          <div className="mt-2 text-xs flex justify-between items-center p-2 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400">Projected Balance:</span>
            <span
              className={`font-mono font-bold ${
                isNegative ? 'text-rose-400 animate-pulse' : 'text-slate-200'
              }`}
            >
              {item.quantity_on_hand} {direction === 'INCREASE' ? '+' : '-'} {numQuantity || 0} = {projectedBalance} units
            </span>
          </div>

          {isNegative && (
            <div className="mt-1.5 p-2 bg-rose-950/80 border border-rose-800 rounded text-[11px] text-rose-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Negative Inventory Guard: Stock cannot fall below 0 units (current balance: {item.quantity_on_hand}).</span>
            </div>
          )}
        </div>

        {/* Mandatory Reason */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="adjust-reason" className="text-xs font-semibold text-slate-300">
              Discrepancy Justification / Clinical Audit Reason <span className="text-rose-400">*</span>
            </label>
            <span className={`text-[11px] font-mono ${isReasonTooShort ? 'text-amber-400' : 'text-slate-400'}`}>
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
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
