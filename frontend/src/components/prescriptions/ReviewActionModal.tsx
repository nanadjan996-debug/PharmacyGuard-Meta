import React, { useState } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { PrescriptionDetailResponse, ReviewActionRequest, ReviewActionResponse } from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export interface ReviewActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: PrescriptionDetailResponse;
  initialAction?: 'ACCEPT' | 'OVERRIDE' | 'ESCALATE';
  onSuccess: (response: ReviewActionResponse) => void;
}

export const ReviewActionModal: React.FC<ReviewActionModalProps> = ({
  isOpen,
  onClose,
  prescription,
  initialAction = 'ACCEPT',
  onSuccess,
}) => {
  const [action, setAction] = useState<'ACCEPT' | 'OVERRIDE' | 'ESCALATE'>(initialAction);
  const [rationale, setRationale] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if any active unreviewed finding has HIGH severity
  const hasHighSeverityFinding = prescription.findings.some(
    (f) => f.severity === 'HIGH'
  );

  // Backend contract: ACCEPT or OVERRIDE strictly requires non-empty rationale IF active unreviewed HIGH finding exists
  const isRationaleRequired =
    (action === 'ACCEPT' || action === 'OVERRIDE') && hasHighSeverityFinding;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedRationale = rationale.trim();
    const trimmedNotes = notes.trim();

    // Client-side verification strictly aligning with backend validation rules
    if (isRationaleRequired && !trimmedRationale) {
      setError(
        'Override rationale is mandatory when accepting or overriding a prescription with high-priority clinical findings.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ReviewActionRequest = {
        action,
        override_rationale: trimmedRationale || undefined,
        notes: trimmedNotes || undefined,
      };

      const res = await api.prescriptions.submitReview(prescription.id, payload);
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? typeof err.detail === 'string'
            ? err.detail
            : err.message
          : 'Failed to submit pharmacist review decision.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Pharmacist Decision: ${prescription.prescription_number}`}
      subtitle={`Patient: ${prescription.patient_name} (MRN: ${prescription.patient_mrn})`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Error notification banner */}
        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Decision Submission Error</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Action Selector Segmented Control */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Review Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setError(null);
                setAction('ACCEPT');
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                action === 'ACCEPT'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-200'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>ACCEPT</span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                Authorize prescription for dispensing.
              </p>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setError(null);
                setAction('OVERRIDE');
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                action === 'OVERRIDE'
                  ? 'bg-purple-50 text-purple-900 border-purple-500 ring-2 ring-purple-500/20 dark:bg-purple-950/50 dark:text-purple-200'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                <span>OVERRIDE</span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                Override active safety findings with rationale.
              </p>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setError(null);
                setAction('ESCALATE');
              }}
              className={`p-3 rounded-lg border text-left transition-all ${
                action === 'ESCALATE'
                  ? 'bg-orange-50 text-orange-900 border-orange-500 ring-2 ring-orange-500/20 dark:bg-orange-950/50 dark:text-orange-200'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1 font-semibold text-xs">
                <ArrowUpRight className="w-4 h-4 text-orange-600 shrink-0" />
                <span>ESCALATE</span>
              </div>
              <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                Refer to Chief Pharmacist for supervisory review.
              </p>
            </button>
          </div>
        </div>

        {/* High Severity Warning Notice */}
        {hasHighSeverityFinding && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>ACTIVE HIGH-SEVERITY FINDINGS DETECTED</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              This prescription contains active HIGH-severity findings. Per clinical safety policy and backend enforcement, accepting or overriding this order strictly mandates a non-empty written clinical rationale.
            </p>
          </div>
        )}

        {/* Clinical Override / Approval Rationale Input */}
        {(action === 'OVERRIDE' || (action === 'ACCEPT' && hasHighSeverityFinding)) && (
          <div>
            <label
              htmlFor="override-rationale"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
            >
              Written Clinical Rationale{' '}
              {isRationaleRequired ? (
                <span className="text-red-600">*</span>
              ) : (
                <span className="text-slate-400 font-normal">(Optional)</span>
              )}
            </label>
            <textarea
              id="override-rationale"
              rows={3}
              value={rationale}
              onChange={(e) => {
                setError(null);
                setRationale(e.target.value);
              }}
              disabled={isSubmitting}
              placeholder={
                isRationaleRequired
                  ? 'Mandatory: Document clinical rationale explaining why dispensing is safe despite high-severity findings...'
                  : 'Optional: Document clinical rationale explaining reasons for overriding safety checks...'
              }
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Recorded in permanent review audit history. Client-side whitespace will be trimmed before transmission.
            </p>
          </div>
        )}

        {/* Notes / Escalation Clarification Input */}
        <div>
          <label
            htmlFor="review-notes"
            className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1"
          >
            {action === 'ESCALATE' ? 'Clarification / Escalation Reason' : 'Internal Clinical Notes (Optional)'}
          </label>
          <textarea
            id="review-notes"
            rows={2}
            value={notes}
            onChange={(e) => {
              setError(null);
              setNotes(e.target.value);
            }}
            disabled={isSubmitting}
            placeholder={
              action === 'ESCALATE'
                ? 'Specify reason for escalation or prescriber clarification needed (backend fallback applied if blank)...'
                : 'Optional notes for pharmacy records...'
            }
            className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-2.5">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={action === 'ACCEPT' ? 'primary' : action === 'OVERRIDE' ? 'danger' : 'secondary'}
            size="sm"
            isLoading={isSubmitting}
          >
            Confirm {action}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
