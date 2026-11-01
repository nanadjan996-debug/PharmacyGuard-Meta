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
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-mono text-indigo-400 font-semibold">{item.medication_id}</span>
              <h4 className="text-sm font-semibold text-white">{item.generic_name}</h4>
              <p className="text-xs text-slate-400">{item.brand_name} · {item.standard_strength} ({item.dosage_form})</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Current Stock</span>
              <span className="text-base font-mono font-bold text-slate-200">{item.quantity_on_hand}</span> units
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Location: <strong className="text-slate-300">{item.location}</strong></span>
            <span>Threshold: <strong className="text-slate-300">{item.reorder_threshold}</strong></span>
          </div>
        </div>

        {/* Quantity Field */}
        <div>
          <label htmlFor="restock-quantity" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Received Units to Add to Inventory <span className="text-rose-400">*</span>
          </label>
          <input
            id="restock-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
            disabled={isSubmitting}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="e.g. 50"
          />
          {isValidQuantity && (
            <p className="text-xs text-emerald-400 mt-1">
              New balance will be <strong>{item.quantity_on_hand + numQuantity}</strong> units.
            </p>
          )}
        </div>

        {/* Reason / PO Tracking */}
        <div>
          <label htmlFor="restock-reason" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Distributor Invoice / PO or Shipment Note
          </label>
          <input
            id="restock-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="e.g. McKesson PO-98124 receipt"
          />
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
