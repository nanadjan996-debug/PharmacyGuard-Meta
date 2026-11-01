import React from 'react';
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

  return (
    <div
      aria-label="AI Clinical Explanation Section"
      className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-b from-indigo-50/40 to-white dark:from-indigo-950/20 dark:to-slate-900 p-5 shadow-xs space-y-4 transition-all"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span>Meta Muse Spark Open</span>
              <span className="text-[10px] font-mono font-normal normal-case px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Baseten Hosted Inference
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Advisory clinical explanation and findings synthesis. Non-authoritative decision support.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          {/* Status Badge */}
          {isLoading ? (
            <span
              data-testid="ai-status-badge"
              className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700 animate-pulse"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI Processing (14s max)...</span>
            </span>
          ) : status === 'available' ? (
            <span
              data-testid="ai-status-badge"
              className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>AI Explanation Available</span>
            </span>
          ) : status === 'timeout' ? (
            <span
              data-testid="ai-status-badge"
              className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>AI Timed Out (&gt;14s)</span>
            </span>
          ) : status === 'rejected' ? (
            <span
              data-testid="ai-status-badge"
              className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>AI Response Rejected</span>
            </span>
          ) : (
            <span
              data-testid="ai-status-badge"
              className="inline-flex items-center space-x-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Unavailable</span>
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            isLoading={isLoading}
            disabled={disabled}
            icon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
            onClick={onGenerate}
          >
            {explanation ? 'Refresh AI Analysis' : 'Explain with AI'}
          </Button>
        </div>
      </div>

      {/* Non-Authoritative Advisory Notice Banner */}
      <div
        role="note"
        className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/80 text-[11px] text-indigo-900 dark:text-indigo-300 flex items-start space-x-2"
      >
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-0.5">
          <p className="font-semibold">Non-Authoritative Clinical Decision Support</p>
          <p className="text-[10px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
            {explanation?.disclaimer ||
              'Meta Muse Spark Open interprets deterministic safety findings into clinical explanations. It has no authority to approve prescriptions, authorize dispensing, or alter rule severities.'}
          </p>
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
        <div className="p-6 text-center text-xs text-slate-500 italic bg-white/60 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
          <Bot className="w-8 h-8 text-slate-400 mx-auto" />
          <p>No AI explanation requested yet for this prescription.</p>
          <p className="text-[11px] text-slate-400">
            Click &ldquo;Explain with AI&rdquo; to generate natural-language clinical context using Meta Muse Spark Open.
          </p>
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

          {/* Finding-by-Finding Breakdown */}
          {explanation.finding_explanations.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Finding Interpretations ({explanation.finding_explanations.length})
              </h4>
              <div className="space-y-2">
                {explanation.finding_explanations.map((fe) => (
                  <div
                    key={fe.rule_identifier}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-1.5"
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
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {fe.clinical_explanation}
                    </p>
                  </div>
                ))}
              </div>
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
  );
};

