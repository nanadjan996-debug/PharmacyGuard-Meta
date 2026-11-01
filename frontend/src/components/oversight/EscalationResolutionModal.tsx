import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  EscalationQueueItemResponse,
  EscalationResolutionRequest,
  EscalationResolutionResponse,
} from '../../types/api';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { SeverityBadge } from '../common/SeverityBadge';

interface EscalationResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  escalation: EscalationQueueItemResponse | null;
  onSuccess: (response: EscalationResolutionResponse) => void;
}

export const EscalationResolutionModal: React.FC<EscalationResolutionModalProps> = ({
  isOpen,
  onClose,
  escalation,
  onSuccess,
}) => {
  const [action, setAction] = useState<
    'APPROVED_BY_CHIEF' | 'APPROVED_AFTER_CLARIFICATION' | 'REJECTED_RETURNED_TO_PRESCRIBER'
  >('APPROVED_BY_CHIEF');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!escalation) return null;

  const trimmedNotes = notes.trim();
  const isHighSeverity = escalation.has_high_severity_finding;
  const isApproving = action === 'APPROVED_BY_CHIEF' || action === 'APPROVED_AFTER_CLARIFICATION';

  // Validation rules matching backend contract:
  // 1. len(trimmedNotes) >= 5 non-whitespace characters (backend Pydantic field_validator)
  // 2. High severity finding approvals mandate documented clinical rationale
  const isNotesTooShort = trimmedNotes.length < 5;
  const isHighSeverityRationaleMissing = isHighSeverity && isApproving && trimmedNotes.length < 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNotesTooShort) {
      setError('Resolution notes must be at least 5 characters.');
      return;
    }

    if (isHighSeverityRationaleMissing) {
      setError('Clinical justification is strictly required when approving an escalated case with HIGH-severity findings.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: EscalationResolutionRequest = {
        resolution_action: action,
        resolution_notes: trimmedNotes,
      };

      // Backend route takes prescription_id: POST /oversight/escalations/{prescription_id}/resolve
      const res = await api.oversight.resolveEscalation(escalation.prescription_id, payload);
      onSuccess(res);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('This escalation has already been resolved or the prescription status has changed.');
        } else if (err.status === 422) {
          setError(typeof err.detail === 'string' ? err.detail : 'Validation error: Resolution notes must be at least 5 characters.');
        } else {
          setError(typeof err.detail === 'string' ? err.detail : err.message);
        }
      } else {
        setError('Failed to resolve escalation. Please try again.');
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
      title="Chief Pharmacist Escalation Determination"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6" data-testid="escalation-resolution-form">
        {/* Prescription & Escalation Context Box */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-xs font-mono text-indigo-400 font-semibold">
                {escalation.prescription_number}
              </span>
              <h4 className="text-sm font-semibold text-white mt-0.5">
                {escalation.patient_name} <span className="text-xs text-slate-400 font-normal">MRN: {escalation.patient_mrn}</span>
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {isHighSeverity && <SeverityBadge severity="HIGH" />}
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                {escalation.findings_count} finding{escalation.findings_count === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
            <div>
              <span className="text-slate-500 block">Prescribing Clinician</span>
              <span className="text-slate-200 font-medium">{escalation.prescriber_name}</span> ({escalation.prescriber_department})
            </div>
            <div>
              <span className="text-slate-500 block">Escalated By</span>
              <span className="text-slate-200 font-medium">{escalation.escalated_by_name}</span>
            </div>
          </div>

          {/* Escalation Reason Cited by Staff */}
          <div className="p-3 bg-amber-950/30 border border-amber-900/40 rounded-lg">
            <span className="text-xs font-semibold text-amber-400 block mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Staff Pharmacist Escalation Reason:
            </span>
            <p className="text-xs text-amber-200/90 whitespace-pre-wrap">{escalation.escalation_reason}</p>
          </div>
        </div>

        {/* High Severity Mandatory Warning */}
        {isHighSeverity && (
          <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-rose-200">High-Severity Findings Present</span>
              Approving this prescription requires supervisory clinical rationale. Your determination and notes will be permanently logged in the compliance audit trail.
            </div>
          </div>
        )}

        {/* Action Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Supervisory Determination Action
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* APPROVED_BY_CHIEF */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                action === 'APPROVED_BY_CHIEF'
                  ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution_action"
                value="APPROVED_BY_CHIEF"
                checked={action === 'APPROVED_BY_CHIEF'}
                onChange={() => setAction('APPROVED_BY_CHIEF')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Accept & Clear Clinical Hold (Approved by Chief)
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authorize prescription dispensing under Chief Pharmacist authority, overriding staff escalation holds.
                </p>
              </div>
            </label>

            {/* APPROVED_AFTER_CLARIFICATION */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                action === 'APPROVED_AFTER_CLARIFICATION'
                  ? 'bg-blue-950/30 border-blue-500/60 ring-1 ring-blue-500/40'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution_action"
                value="APPROVED_AFTER_CLARIFICATION"
                checked={action === 'APPROVED_AFTER_CLARIFICATION'}
                onChange={() => setAction('APPROVED_AFTER_CLARIFICATION')}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-blue-400" />
                  Approve After Prescriber Clarification
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Prescriber was consulted directly and confirmed dosing, clinical justification, or therapeutic strategy.
                </p>
              </div>
            </label>

            {/* REJECTED_RETURNED_TO_PRESCRIBER */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                action === 'REJECTED_RETURNED_TO_PRESCRIBER'
                  ? 'bg-rose-950/30 border-rose-500/60 ring-1 ring-rose-500/40'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <input
                type="radio"
                name="resolution_action"
                value="REJECTED_RETURNED_TO_PRESCRIBER"
                checked={action === 'REJECTED_RETURNED_TO_PRESCRIBER'}
                onChange={() => setAction('REJECTED_RETURNED_TO_PRESCRIBER')}
                className="mt-1 text-rose-600 focus:ring-rose-500"
              />
              <div>
                <span className="text-sm font-semibold text-white flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Reject & Return to Prescriber
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Refuse dispensing and cancel order. Returns prescription to clinic with clinical findings for re-authoring.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Resolution Notes Textarea */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="resolution-notes" className="text-xs font-semibold text-slate-300">
              Clinical Determination & Supervisory Rationale Notes <span className="text-rose-400">*</span>
            </label>
            <span className={`text-[11px] font-mono ${trimmedNotes.length < 5 ? 'text-amber-400' : 'text-slate-400'}`}>
              {trimmedNotes.length}/5 min chars
            </span>
          </div>
          <textarea
            id="resolution-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            placeholder={
              isApproving && isHighSeverity
                ? 'Document specific clinical justification, physician discussion notes, lab values, or risk mitigation strategy...'
                : 'Document determination details, communication with clinical team, or basis for decision...'
            }
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Backend requires at least 5 non-whitespace characters. Notes are saved permanently to the compliance audit log.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={action === 'REJECTED_RETURNED_TO_PRESCRIBER' ? 'danger' : 'primary'}
            isLoading={isSubmitting}
            disabled={isNotesTooShort || isHighSeverityRationaleMissing}
          >
            Submit Determination
          </Button>
        </div>
      </form>
    </Modal>
  );
};
