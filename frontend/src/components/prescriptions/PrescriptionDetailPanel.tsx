import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  User as UserIcon,
  Stethoscope,
  Pill,
  AlertCircle,
  History,
  Lock,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { PrescriptionDetailResponse, AIExplanationResponse } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { Button } from '../common/Button';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { ReviewActionModal } from './ReviewActionModal';
import { AIExplanationSection } from './AIExplanationSection';

export interface PrescriptionDetailPanelProps {
  prescriptionId: string;
  onBack: () => void;
  onActionComplete?: () => void;
}

export const PrescriptionDetailPanel: React.FC<PrescriptionDetailPanelProps> = ({
  prescriptionId,
  onBack,
  onActionComplete,
}) => {
  const [prescription, setPrescription] = useState<PrescriptionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Verification state
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // AI Explanation state
  const [aiExplanation, setAiExplanation] = useState<AIExplanationResponse | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Review modal state
  const [modalAction, setModalAction] = useState<'ACCEPT' | 'OVERRIDE' | 'ESCALATE' | null>(() => {
    if (typeof window !== 'undefined') {
      const act = new URLSearchParams(window.location.search).get('action');
      if (act === 'ACCEPT' || act === 'OVERRIDE' || act === 'ESCALATE') return act;
    }
    return null;
  });

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.prescriptions.getDetail(prescriptionId);
      setPrescription(data);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to retrieve prescription detail.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [prescriptionId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleRunVerification = async () => {
    if (!prescription) return;
    setIsVerifying(true);
    setVerifyMessage(null);
    setError(null);
    try {
      const result = await api.prescriptions.verify(prescription.id);
      setVerifyMessage(
        `Verification completed: ${result.summary.total_findings} findings evaluated (Max severity: ${result.summary.max_severity}).`
      );
      if (result.ai_explanation) {
        setAiExplanation(result.ai_explanation);
      }
      // Reload fresh detail record
      await fetchDetail();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Verification engine run failed.';
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRunAiExplanation = async () => {
    if (!prescription) return;
    setIsGeneratingAi(true);
    setError(null);
    try {
      const res = await api.prescriptions.getAiExplanation(prescription.id);
      setAiExplanation(res);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'AI explanation service request failed.';
      setError(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  if (isLoading && !prescription) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Queue
          </Button>
          <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <SkeletonLoader type="card" count={3} />
      </div>
    );
  }

  if (error && !prescription) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-xs text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600 dark:text-red-400 mx-auto" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Failed to Load Prescription
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
        <div className="flex items-center justify-center space-x-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to Queue
          </Button>
          <Button variant="primary" size="sm" onClick={fetchDetail}>
            Retry Load
          </Button>
        </div>
      </div>
    );
  }

  if (!prescription) return null;

  const isPending = prescription.status === 'pending';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden space-y-6">
      {/* Top Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={onBack}
            >
              Back
            </Button>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  {prescription.prescription_number}
                </h2>
                <StatusBadge status={prescription.status} />
                {prescription.scenario_key && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                    {prescription.scenario_key}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Submitted on {new Date(prescription.created_at).toLocaleString()} · Internal ID: <span className="font-mono text-[11px]">{prescription.id}</span>
              </p>
            </div>
          </div>

          {/* Action Decision Buttons (if pending) */}
          <div className="flex items-center space-x-2">
            {isPending ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={() => setModalAction('ACCEPT')}
                >
                  Accept
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<AlertTriangle className="w-4 h-4" />}
                  onClick={() => setModalAction('OVERRIDE')}
                >
                  Override
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  onClick={() => setModalAction('ESCALATE')}
                >
                  Escalate
                </Button>
              </>
            ) : (
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Workflow Finalized ({prescription.status})</span>
              </div>
            )}
          </div>
        </div>

        {/* Verification Success Toast / Notification */}
        {verifyMessage && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{verifyMessage}</span>
          </div>
        )}

        {/* Verification / Action Error Notification */}
        {error && (
          <div role="alert" className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-800 dark:text-red-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6 space-y-6">
        {/* Patient Demographics & Prescriber Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Patient Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="flex items-center space-x-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              <span>Patient Demographics</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Full Name</span>
                <span className="font-semibold text-slate-900 dark:text-white">{prescription.patient_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Medical Record # (MRN)</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">{prescription.patient_mrn}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500">Date of Birth / Gender</span>
                <span className="text-slate-700 dark:text-slate-300">{prescription.patient_dob} · {prescription.patient_gender}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Weight & Height</span>
                <span className="text-slate-700 dark:text-slate-300">{prescription.patient_weight_kg} kg · {prescription.patient_height_cm} cm</span>
              </div>
            </div>
          </div>

          {/* Prescriber & Clinical Notes Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                <span>Prescribing Clinician & Notes</span>
              </div>
              <div className="space-y-1 text-xs mb-3">
                <p className="font-semibold text-slate-900 dark:text-white">{prescription.prescriber_name}</p>
                <p className="text-slate-500 text-[11px]">{prescription.prescriber_department}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Clinical Context & Indication:
              </span>
              <p className="text-slate-600 dark:text-slate-400 italic leading-relaxed">
                {prescription.clinical_notes || 'No clinical notes provided by prescriber.'}
              </p>
            </div>
          </div>
        </div>

        {/* Ordered Medication Items Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Pill className="w-4 h-4 text-emerald-600" />
              <span>Prescribed Medication Line Items ({prescription.items.length})</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
              <thead className="bg-slate-50/40 dark:bg-slate-800/20 text-[11px] font-semibold text-slate-500 uppercase select-none">
                <tr>
                  <th scope="col" className="py-2.5 pl-4 pr-3">Medication</th>
                  <th scope="col" className="py-2.5 px-3">Class</th>
                  <th scope="col" className="py-2.5 px-3">Dose & Frequency</th>
                  <th scope="col" className="py-2.5 px-3">Route</th>
                  <th scope="col" className="py-2.5 px-3">Quantity & Duration</th>
                  <th scope="col" className="py-2.5 pr-4 pl-3">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {prescription.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white">{item.generic_name}</span>
                        <span className="text-[11px] text-slate-400">Brand: {item.brand_name} ({item.medication_id})</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {item.drug_class}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {item.dose_amount} {item.dose_unit}
                      </span>
                      <span className="block text-[11px] text-slate-500">{item.frequency}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {item.route}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                      {item.quantity_prescribed} units ({item.duration_days} days)
                    </td>
                    <td className="py-3 pr-4 pl-3 text-slate-600 dark:text-slate-400 text-xs italic max-w-xs">
                      {item.instructions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Verification Findings Section */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Deterministic Verification Findings ({prescription.findings.length})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic rule engine evaluation across drug interactions, allergies, dose limits, and inventory deficits.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              isLoading={isVerifying}
              icon={<Play className="w-3.5 h-3.5 text-emerald-600" />}
              onClick={handleRunVerification}
            >
              Re-Run Verification
            </Button>
          </div>

          {/* Engine findings disclaimer banner */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            <strong>Advisory Engine:</strong> Findings are generated by a deterministic rule engine based on documented clinical scenarios and synthetic references. Clinical decision support only; does not independently authorize dispensing.
          </div>

          {/* Findings List */}
          {prescription.findings.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 italic">
              No verification findings recorded for this prescription. Click "Re-Run Verification" to trigger engine analysis.
            </div>
          ) : (
            <div className="space-y-3">
              {prescription.findings.map((finding) => (
                <div
                  key={finding.id}
                  className={`p-4 rounded-xl border transition-all ${
                    finding.severity === 'HIGH'
                      ? 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/60'
                      : finding.severity === 'MODERATE'
                      ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60'
                      : 'bg-slate-50/50 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700/60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <SeverityBadge severity={finding.severity} size="sm" />
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {finding.rule_identifier}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                        {finding.category}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-slate-500">
                        Status: <strong className="text-slate-800 dark:text-slate-200">{finding.status}</strong>
                      </span>
                      {finding.human_review_required && (
                        <span className="text-[10px] font-semibold text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950 px-2 py-0.5 rounded">
                          Review Required
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans mt-1">
                    {finding.evidence}
                  </p>

                  <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Source: {finding.rule_source}</span>
                    <span>Finding UUID: {finding.id.slice(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: AI Clinical Explanation (Meta Muse Spark Open via Baseten) */}
        <AIExplanationSection
          explanation={aiExplanation}
          isLoading={isGeneratingAi}
          onGenerate={handleRunAiExplanation}
          disabled={isVerifying}
        />

        {/* Pharmacist Review History & Escalation Records */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <History className="w-4 h-4 text-emerald-600" />
            <span>Audit Trail & Historical Decisions</span>
          </div>

          {/* Escalations */}
          {prescription.escalations && prescription.escalations.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Chief Pharmacist Escalation Logs
              </span>
              {prescription.escalations.map((esc) => (
                <div
                  key={esc.id}
                  className="p-3.5 rounded-lg bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-orange-900 dark:text-orange-200">
                      Escalated by {esc.escalated_by_name}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(esc.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300">
                    <strong>Reason:</strong> {esc.escalation_reason}
                  </p>
                  {esc.resolved_at ? (
                    <div className="mt-2 pt-2 border-t border-orange-200/80 dark:border-orange-800/80">
                      <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        Resolved as {esc.resolution_action} by {esc.resolved_by_name} on{' '}
                        {new Date(esc.resolved_at).toLocaleString()}
                      </p>
                      {esc.resolution_notes && (
                        <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                          <strong>Chief Notes:</strong> {esc.resolution_notes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded mt-1">
                      Awaiting Chief Pharmacist Resolution
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pharmacist Reviews */}
          {prescription.reviews && prescription.reviews.length > 0 ? (
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Pharmacist Review Decisions ({prescription.reviews.length})
              </span>
              {prescription.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white">{rev.reviewer_name}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {rev.reviewer_role}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        [{rev.action}]
                      </span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {new Date(rev.created_at).toLocaleString()}
                    </span>
                  </div>

                  {rev.override_rationale && (
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded text-slate-800 dark:text-slate-200">
                      <strong>Override Rationale:</strong> {rev.override_rationale}
                    </div>
                  )}

                  {rev.notes && (
                    <p className="text-slate-600 dark:text-slate-400">
                      <strong>Notes:</strong> {rev.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No formal review decisions finalized yet.</p>
          )}
        </div>
      </div>

      {/* Review Action Modal */}
      {modalAction && (
        <ReviewActionModal
          isOpen={true}
          onClose={() => setModalAction(null)}
          prescription={prescription}
          initialAction={modalAction}
          onSuccess={() => {
            fetchDetail();
            if (onActionComplete) {
              onActionComplete();
            }
          }}
        />
      )}
    </div>
  );
};
