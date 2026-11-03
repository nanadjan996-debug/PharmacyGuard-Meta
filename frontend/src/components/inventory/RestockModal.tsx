import React, { useState } from 'react';
import { PackagePlus, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { InventoryItemResponse, InventoryTransactionResponse } from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface RestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItemResponse | null;
  onSuccess: (res: InventoryTransactionResponse) => void;
}

export const RestockModal: React.FC<RestockModalProps> = ({
  isOpen,
  onClose,
  item,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState<number | ''>(50);
  const [reason, setReason] = useState<string>('Standard distributor shipment receipt');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!item) return null;

  const numQuantity = Number(quantity);
  const isValidQuantity = numQuantity > 0 && Number.isInteger(numQuantity);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidQuantity) {
      setError('Please enter a valid positive whole number of units to receive.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.inventory.recordTransaction({
        medication_id: item.medication_id,
        transaction_type: 'RESTOCK',
        quantity: numQuantity,
        reason: reason.trim() || 'Shipment receipt',
      });

      onSuccess(res);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : err.message);
      } else {
        setError('Failed to record restock shipment.');
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
      title="Receive Formulary Stock (Restock Shipment)"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5" data-testid="restock-modal-form">
        {/* Medication Context Header */}
        <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.medication_id}</span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{item.generic_name}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">{item.brand_name} · {item.standard_strength} ({item.dosage_form})</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Current Stock</span>
              <span className="text-base font-mono font-bold text-slate-900 dark:text-slate-100">{item.quantity_on_hand}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400 ml-1">units</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2.5">
            <span>Location: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.location}</strong></span>
            <span>Threshold: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{item.reorder_threshold} units</strong></span>
          </div>
        </div>

        {/* Quantity Field */}
        <div>
          <label htmlFor="restock-quantity" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Received Units to Add to Inventory <span className="text-red-500">*</span>
          </label>
          <input
            id="restock-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs font-mono font-medium"
            placeholder="e.g. 50"
          />
          {isValidQuantity && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
              <span>New balance will be</span>
              <strong className="font-bold font-mono text-emerald-800 dark:text-emerald-300">{item.quantity_on_hand + numQuantity}</strong>
              <span>units.</span>
            </p>
          )}
        </div>

        {/* Reason / PO Tracking */}
        <div>
          <label htmlFor="restock-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Distributor Invoice / PO or Shipment Note
          </label>
          <input
            id="restock-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs"
            placeholder="e.g. McKesson PO-98124 receipt"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!isValidQuantity}>
            <PackagePlus className="w-4 h-4 mr-2" />
            Confirm Stock Receipt
          </Button>
        </div>
      </form>
    </Modal>
  );
};
