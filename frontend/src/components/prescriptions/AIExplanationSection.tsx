import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldAlert,
  Info,
  RefreshCw,
  ListChecks,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AIExplanationResponse } from '../../types/api';
import { Button } from '../common/Button';
import { SeverityBadge } from '../common/SeverityBadge';

interface AIExplanationSectionProps {
  explanation: AIExplanationResponse | null;
  isLoading: boolean;
  onGenerate: () => void;
  disabled?: boolean;
}

export const AIExplanationSection: React.FC<AIExplanationSectionProps> = ({
  explanation,
  isLoading,
  onGenerate,
  disabled = false,
}) => {
  const status = explanation?.ai_status;
  const [showCleanFindings, setShowCleanFindings] = useState(false);

  const isBedrock =
    Boolean(
      explanation?.model_name?.includes('claude') ||
      explanation?.model_name?.includes('bedrock') ||
      explanation?.model_name?.includes('anthropic')
    );
  const modelDisplayName = isBedrock ? 'Claude Sonnet 4.6' : (explanation?.model_name || 'Meta Muse Spark Open');
  const providerDisplayName = isBedrock ? 'Amazon Bedrock' : 'Baseten Inference';

  const alertFindings =
    explanation?.finding_explanations.filter(
      (fe) => fe.severity === 'HIGH' || fe.severity === 'WARNING' || fe.severity === 'MEDIUM'
    ) || [];

  const cleanFindings =
    explanation?.finding_explanations.filter(
      (fe) => fe.severity !== 'HIGH' && fe.severity !== 'WARNING' && fe.severity !== 'MEDIUM'
    ) || [];

  return (
    <div
      aria-label="AI Clinical Explanation Section"
      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all"
    >
      {/* Header bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-50/50 via-white to-indigo-50/30 dark:from-slate-850 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-sky-600 text-white shadow-2xs shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex items-center flex-wrap gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {modelDisplayName}
                </h3>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0 whitespace-nowrap">
                  {providerDisplayName}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <div className="shrink-0 whitespace-nowrap">
              {isLoading ? (
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-700 animate-pulse whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>AI Processing (14s max)...</span>
                </span>
              ) : status === 'available' ? (
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>AI Explanation Available</span>
                </span>
              ) : status === 'timeout' ? (
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 whitespace-nowrap"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>AI Timed Out (&gt;14s)</span>
                </span>
              ) : status === 'rejected' ? (
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 whitespace-nowrap"
                >
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>AI Response Rejected</span>
                </span>
              ) : status === 'unavailable' ? (
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 whitespace-nowrap"
                >
                  <Bot className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-slate-400" />
                  <span>AI Unavailable</span>
                </span>
              ) : (
                /* Initial unanalyzed state (explanation is null or not requested yet) */
                <span
                  data-testid="ai-status-badge"
                  className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>AI Ready on Demand</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              Advisory clinical explanation and findings synthesis. Non-authoritative decision support.
            </p>
            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                isLoading={isLoading}
                disabled={disabled}
                icon={<Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />}
                onClick={onGenerate}
                className="whitespace-nowrap font-semibold shadow-2xs"
              >
                {explanation ? 'Refresh AI Analysis' : 'Explain with AI'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Non-Authoritative Advisory Notice Banner */}
        <div
          role="note"
          className="p-3 bg-sky-50/60 dark:bg-sky-950/40 rounded-xl border border-sky-100 dark:border-sky-800/80 text-[11px] text-sky-900 dark:text-sky-300 flex items-start space-x-2"
        >
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <p className="font-semibold">Non-Authoritative Clinical Decision Support</p>
            <p className="text-[10px] text-sky-800 dark:text-sky-400 leading-relaxed">
              {explanation?.disclaimer ||
                'Meta Muse Spark Open interprets deterministic safety findings into clinical explanations. It has no authority to approve prescriptions, authorize dispensing, or alter rule severities.'}
            </p>
          </div>
        </div>

        {/* Patient Confidentiality & Zero-PHI Privacy Guardrail */}
        <div
          role="note"
          aria-label="Patient Privacy & Zero-PHI Guardrail"
          className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] text-emerald-900 dark:text-emerald-300 flex items-start space-x-2"
        >
          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="font-semibold">Patient Confidentiality Guardrail:</span>{' '}
            <span className="text-[10.5px] text-emerald-800 dark:text-emerald-400">
              Zero-PHI payload. Patient names, MRNs, and direct identifiers are strictly excluded from AI inference. {providerDisplayName} receives only de-identified clinical parameters.
            </span>
          </div>
        </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-8 text-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            Contacting Baseten inference service (meta-models/muse-spark-open)...
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            Deterministic findings remain authoritative. Timeout capped at 14.0 seconds.
          </p>
        </div>
      ) : !explanation ? (
        <div className="p-6 text-center rounded-xl bg-gradient-to-b from-sky-50/40 via-white to-slate-50/60 dark:from-slate-800/40 dark:to-slate-900/40 border border-sky-100 dark:border-slate-800 space-y-2 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto shadow-2xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Meta Muse Spark Open Ready
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              No AI explanation requested yet for this prescription. Click{' '}
              <strong className="text-slate-900 dark:text-white font-semibold">
                &ldquo;Explain with AI&rdquo;
              </strong>{' '}
              above to generate natural-language clinical context, mechanistic pharmacology explanations, and cross-reactivity synthesis.
            </p>
          </div>
        </div>
      ) : status === 'timeout' ? (
        <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 text-xs font-bold">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>AI Inference Request Timed Out</span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {explanation.summary}
          </p>
          <p className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
            Detail: {explanation.status_detail || 'Inference exceeded 14.0s timeout limit.'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
            <strong>Fallback active:</strong> Review the deterministic safety findings above. Human pharmacist workflow is unaffected.
          </p>
        </div>
      ) : status === 'rejected' ? (
        <div className="p-4 bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-red-900 dark:text-red-200 text-xs font-bold">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>AI Output Rejected by Safety Bounds</span>
          </div>
          <p className="text-xs text-red-800 dark:text-red-300">
            {explanation.summary}
          </p>
          <p className="text-[11px] font-mono text-red-700 dark:text-red-400">
            Rejection Reason: {explanation.status_detail || 'Model output violated schema or safety constraints.'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
            <strong>Safety guarantee:</strong> Unvalidated model output was discarded to preserve clinical integrity.
          </p>
        </div>
      ) : status === 'unavailable' ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-slate-500" />
            <span>AI Explanation Service Unavailable</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {explanation.summary}
          </p>
          {explanation.status_detail && (
            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Provider Status: {explanation.status_detail}
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-400 pt-1">
            Deterministic rule engine checks remain fully authoritative and available.
          </p>
        </div>
      ) : (
        /* Status === 'available' */
        <div className="space-y-5">
          {/* Executive Clinical Summary */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-900/50 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center space-x-1.5">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>Executive Clinical Synthesis</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Model: {explanation.model_name || 'meta-models/muse-spark-open'}
              </span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
              {explanation.summary}
            </p>
          </div>

          {/* Clinical Context */}
          {explanation.clinical_context && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wide">
                Patient & Encounter Clinical Context
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {explanation.clinical_context}
              </p>
            </div>
          )}

          {/* Finding-by-Finding Breakdown (Prioritized to combat Alert Fatigue) */}
          {explanation.finding_explanations.length > 0 && (
            <div className="space-y-3">
              {/* Active Clinical Alert Findings (HIGH / WARNING) */}
              {alertFindings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Actionable Clinical Alerts ({alertFindings.length})</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">Pharmacist Review Required</span>
                  </div>
                  <div className="space-y-2">
                    {alertFindings.map((fe) => (
                      <div
                        key={fe.rule_identifier}
                        className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 shadow-2xs space-y-1.5"
                      >
                        <div className="flex items-center space-x-2">
                          <SeverityBadge severity={fe.severity as any} size="sm" />
                          <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {fe.rule_identifier}
                          </span>
                          {fe.category && (
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {fe.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                          {fe.clinical_explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Routine Checks (Grouped / Collapsed to eliminate cognitive clutter) */}
              {cleanFindings.length > 0 && (
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowCleanFindings(!showCleanFindings)}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer shadow-2xs"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{cleanFindings.length} Routine Safety Checks Verified Clean (No Conflicts)</span>
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      {showCleanFindings ? 'Hide' : 'Show Details'}
                      {showCleanFindings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </span>
                  </button>

                  {showCleanFindings && (
                    <div className="mt-2 space-y-2 pl-3 border-l-2 border-emerald-500/40">
                      {cleanFindings.map((fe) => (
                        <div
                          key={fe.rule_identifier}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <SeverityBadge severity={fe.severity as any} size="sm" />
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {fe.rule_identifier}
                            </span>
                            {fe.category && (
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                {fe.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {fe.clinical_explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Uncertainties & Review Considerations 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Uncertainties */}
            {explanation.uncertainties.length > 0 && (
              <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5 uppercase tracking-wide">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Clinical Uncertainties & Missing Data</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  {explanation.uncertainties.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Review Considerations */}
            {explanation.review_considerations.length > 0 && (
              <div className="p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center space-x-1.5 uppercase tracking-wide">
                  <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Review Considerations for Pharmacist</span>
                </span>
                <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800 dark:text-indigo-300/90 leading-relaxed">
                  {explanation.review_considerations.map((rc, i) => (
                    <li key={i}>{rc}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

