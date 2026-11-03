import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  History,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Info,
  Layers,
  FileText,
  RotateCcw,
  Download,
} from 'lucide-react';
import { StudentSubmissionResponse } from '../../types/api';
import { SeverityBadge } from '../common/SeverityBadge';
import { Button } from '../common/Button';
import { ClinicalReportModal } from './ClinicalReportModal';

export interface EvaluationResultsViewProps {
  submission: StudentSubmissionResponse;
  onBackToCatalog: () => void;
  onViewHistory: () => void;
  onRetakeCase?: (caseId: string) => void;
  className?: string;
}

export const EvaluationResultsView: React.FC<EvaluationResultsViewProps> = ({
  submission,
  onBackToCatalog,
  onViewHistory,
  onRetakeCase,
  className = '',
}) => {
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const { feedback } = submission;

  const score = submission.score_awarded;
  const isPassing = score >= 70;
  const isMastery = score >= 90;

  const getScoreTheme = () => {
    if (isMastery) {
      return {
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        ringColor: 'text-emerald-500',
        textColor: 'text-emerald-400',
        label: 'Clinical Mastery Achieved',
      };
    }
    if (isPassing) {
      return {
        badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        ringColor: 'text-amber-500',
        textColor: 'text-amber-400',
        label: 'Satisfactory Clinical Determination',
      };
    }
    return {
      badgeBg: 'bg-red-500/10 text-red-400 border-red-500/30',
      ringColor: 'text-red-500',
      textColor: 'text-red-400',
      label: 'Pedagogical Review Recommended',
    };
  };

  const theme = getScoreTheme();

  const getDeterminationStatusBadge = (status: string) => {
    switch (status) {
      case 'PREFERRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Preferred Determination (50 / 50 pts)
          </span>
        );
      case 'ACCEPTABLE_ALTERNATIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Acceptable Alternative ({feedback.determination_score} / 50 pts)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
            <XCircle className="w-3.5 h-3.5" />
            Unsupported / Unsafe Action (0 / 50 pts)
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="evaluation-results-view">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBackToCatalog} data-testid="results-back-button">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Case Catalog
          </Button>
          <Button variant="ghost" size="sm" onClick={onViewHistory} data-testid="results-history-button">
            <History className="w-4 h-4 mr-1.5 text-indigo-400" />
            Submission History
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReportModal(true)}
            data-testid="results-report-button"
            className="border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <Download className="w-4 h-4 mr-1.5 text-indigo-600 dark:text-indigo-400" />
            Download Clinical Report
          </Button>
          {onRetakeCase && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRetakeCase(submission.case_code || submission.case_id)}
              data-testid="results-retake-button"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Retake Case
            </Button>
          )}
          <span className="text-xs text-slate-500 font-mono">
            Attempt #{submission.attempt_number}
          </span>
        </div>
      </div>

      {/* Main Score & Case Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-800/40 p-6 sm:p-8 text-white shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {submission.case_code}
              </span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}>
                {theme.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {submission.case_title}
            </h1>
            <p className="text-xs text-slate-300">
              Evaluated for student <span className="font-semibold text-white">{submission.student_name}</span> on{' '}
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>

          {/* Big Score Display */}
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/80 rounded-2xl p-5 flex items-center gap-5 shrink-0 self-start md:self-auto min-w-[200px]">
            <div className="p-3.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Score</div>
              <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5 flex items-baseline gap-1" data-testid="overall-score">
                <span className={theme.textColor}>{score}</span>
                <span className="text-base text-slate-400 font-normal">/ 100</span>
              </div>
            </div>
          </div>
        </div>

        {/* 100-Point Rubric Breakdown Bar (50/30/20) */}
        <div className="pt-6 border-t border-indigo-800/30 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">1. Determination Accuracy</span>
              <span className="font-bold text-white" data-testid="score-determination">
                {feedback.determination_score} / 50 pts
              </span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ width: `${(feedback.determination_score / 50) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">2. Issue Identification</span>
              <span className="font-bold text-white" data-testid="score-issues">
                {feedback.issue_identification_score} / 30 pts
              </span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${(feedback.issue_identification_score / 30) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/50 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium">3. Clinical Reasoning</span>
              <span className="font-bold text-white" data-testid="score-reasoning">
                {feedback.reasoning_score} / 20 pts
              </span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all"
                style={{ width: `${(feedback.reasoning_score / 20) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3 Pillars In-Depth Review Section */}
      <div className="space-y-6">
        {/* Pillar 1: Determination Details */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Pillar 1: Determination Evaluation
            </h2>
            {getDeterminationStatusBadge(feedback.determination_status)}
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Your Submitted Action
                </div>
                <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {submission.submitted_determination}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Preferred Benchmark Action
                </div>
                <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {feedback.preferred_determination || feedback.expected_determination}
                </div>
              </div>
            </div>

            {feedback.acceptable_alternatives.length > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Acceptable Alternative Actions:
                </span>{' '}
                {feedback.acceptable_alternatives.join(', ')}
              </div>
            )}

            <div className="p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">
              <span className="font-semibold">Evaluator Commentary: </span>
              {feedback.determination_feedback}
            </div>
          </div>
        </div>

        {/* Pillar 2: Clinical Issue Identification */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              Pillar 2: Issue Category Identification
            </h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {feedback.issue_identification_score} / 30 Points
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Correctly Identified */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Correctly Identified Issues ({feedback.correctly_identified_issues.length})
              </div>
              {feedback.correctly_identified_issues.length > 0 ? (
                <div className="flex flex-wrap gap-2" data-testid="correctly-identified-issues">
                  {feedback.correctly_identified_issues.map((issue) => (
                    <span
                      key={issue}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {issue.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No expected issues were identified.</p>
              )}
            </div>

            {/* Missed Issues */}
            {feedback.missed_issues.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  Missed Clinical Issues ({feedback.missed_issues.length})
                </div>
                <div className="flex flex-wrap gap-2" data-testid="missed-issues">
                  {feedback.missed_issues.map((issue) => (
                    <span
                      key={issue}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {issue.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unconfirmed / Incorrect Selections */}
            {feedback.unconfirmed_issues && feedback.unconfirmed_issues.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <XCircle className="w-4 h-4" />
                  Unconfirmed / False-Positive Selections ({feedback.unconfirmed_issues.length})
                </div>
                <div className="flex flex-wrap gap-2" data-testid="unconfirmed-issues">
                  {feedback.unconfirmed_issues.map((issue) => (
                    <span
                      key={issue}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      {issue.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pillar 3: Clinical Reasoning Analysis */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              Pillar 3: Clinical Reasoning & Rubric Element Analysis
            </h2>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {feedback.reasoning_score} / 20 Points
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* Student's submitted reasoning */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Your Submitted Rationale
              </div>
              <blockquote className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border-l-4 border-indigo-500 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed italic">
                "{submission.submitted_reasoning}"
              </blockquote>
            </div>

            {/* Reasoning rubric elements matched */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {feedback.correctly_identified_reasoning_elements.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Articulated Clinical Elements:
                  </div>
                  <ul className="space-y-1">
                    {feedback.correctly_identified_reasoning_elements.map((elem, i) => (
                      <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{elem.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.missed_reasoning_elements.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Unarticulated Reasoning Elements:
                  </div>
                  <ul className="space-y-1">
                    {feedback.missed_reasoning_elements.map((elem, i) => (
                      <li key={i} className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{elem.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {feedback.reasoning_feedback && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Pedagogical Commentary:{' '}
                </span>
                {feedback.reasoning_feedback}
              </div>
            )}
          </div>
        </div>

        {/* Unlocked Expert Solution & Clinical Rationale */}
        <div className="bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-indigo-950/20 rounded-xl border border-indigo-200 dark:border-indigo-800/60 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Unlocked Expert Clinical Rationale & Solution
            </h2>
          </div>

          <div
            className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-line"
            data-testid="expert-clinical-rationale"
          >
            {feedback.clinical_rationale || submission.predefined_explanation}
          </div>

          {/* Key Learning Points */}
          {feedback.key_learning_points && feedback.key_learning_points.length > 0 && (
            <div className="pt-4 border-t border-indigo-100 dark:border-indigo-900/40 space-y-2">
              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                Key Clinical Takeaways
              </div>
              <ul className="space-y-1.5" data-testid="key-learning-points">
                {feedback.key_learning_points.map((pt, i) => (
                  <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Grounded Demonstration Reference Rules */}
        {feedback.expected_rules && feedback.expected_rules.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                Grounded Reference Rules Evaluated ({feedback.expected_rules.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800" data-testid="reference-rules-list">
              {feedback.expected_rules.map((rule) => (
                <div key={rule.rule_identifier} className="p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {rule.rule_identifier}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {rule.rule_name}
                      </span>
                    </div>
                    <SeverityBadge severity={rule.severity} size="sm" />
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {rule.description}
                  </p>

                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Clinical Guideline Evidence:{' '}
                    </span>
                    <span>{rule.clinical_evidence}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
          <span>
            {feedback.disclaimer ||
              'Advisory educational simulation prototype. Synthetic training benchmark only; not for clinical decision-making or autonomous patient care.'}
          </span>
        </div>
      </div>

      {/* Official Clinical Assessment Report Modal Preview */}
      {showReportModal && (
        <ClinicalReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          submission={submission}
        />
      )}
    </div>
  );
};

