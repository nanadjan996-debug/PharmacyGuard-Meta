import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  GraduationCap,
  AlertTriangle,
  Send,
  RefreshCw,
  FileText,
  User,
  Pill,
  Target,
  ShieldAlert,
  Clock,
  Info,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  EducationalCaseDetailResponse,
  StudentSubmissionRequest,
  StudentSubmissionResponse,
} from '../../types/api';
import { Button } from '../common/Button';
import { SkeletonLoader } from '../common/SkeletonLoader';

export interface AssessmentStudioProps {
  caseId: string;
  onBackToList: () => void;
  onSubmitted: (response: StudentSubmissionResponse) => void;
  className?: string;
}

export const CLINICAL_ISSUE_OPTIONS: { id: string; label: string; description: string }[] = [
  {
    id: 'ALLERGY_CROSS_REACTIVITY',
    label: 'Allergy / Cross-Reactivity',
    description: 'Documented drug allergy, structural cross-reactivity, or severe IgE hypersensitivity history',
  },
  {
    id: 'DUPLICATE_THERAPY',
    label: 'Therapeutic Duplication',
    description: 'Concurrent multi-agent prescribing within the same pharmacological class without additive benefit',
  },
  {
    id: 'INDICATION',
    label: 'Missing / Unconfirmed Indication',
    description: 'Prescription lacks diagnostic justification or documented active clinical indication in patient record',
  },
  {
    id: 'DOSAGE',
    label: 'Dosage Limit / Renal Impairment',
    description: 'Dose exceeds recommended maximum limits or requires adjustment for renal clearance / organ impairment',
  },
  {
    id: 'DRUG_INTERACTION',
    label: 'Drug-Drug Interaction',
    description: 'Significant pharmacokinetic or pharmacodynamic interaction altering clearance or multiplying toxicity',
  },
];

export const DETERMINATION_LABELS: Record<string, { title: string; subtitle: string }> = {
  REJECT: {
    title: 'Reject Order',
    subtitle: 'Absolute contraindication, fatal toxicity risk, or severe safety violation requiring cancellation',
  },
  ESCALATE: {
    title: 'Escalate to Chief Pharmacist',
    subtitle: 'Complex therapeutic controversy or boundary case requiring supervisory intervention',
  },
  APPROVE_WITH_MONITORING: {
    title: 'Approve with Monitoring Requirements',
    subtitle: 'Dispensing is acceptable under mandatory therapeutic drug monitoring or laboratory surveillance',
  },
  OVERRIDE_WITH_RATIONALE: {
    title: 'Override Warning with Rationale',
    subtitle: 'Clinical benefit outweighs recognized advisory risk with documented justification',
  },
  APPROVE: {
    title: 'Approve & Authorize Order',
    subtitle: 'Order satisfies indication, dosage, and safety guidelines; authorized for dispensing',
  },
};

export const AssessmentStudio: React.FC<AssessmentStudioProps> = ({
  caseId,
  onBackToList,
  onSubmitted,
  className = '',
}) => {
  const [caseDetail, setCaseDetail] = useState<EducationalCaseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [selectedDetermination, setSelectedDetermination] = useState<string>('');
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [reasoning, setReasoning] = useState<string>('');

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.education.getCaseDetail(caseId);
      setCaseDetail(data);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Unable to retrieve case simulation details.';
      setLoadError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const toggleIssue = (issueId: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  const trimmedReasoning = reasoning.trim();
  const isReasoningValid = trimmedReasoning.length >= 10;
  const canSubmit = Boolean(selectedDetermination) && isReasoningValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !caseDetail) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: StudentSubmissionRequest = {
      determination: selectedDetermination,
      reasoning: trimmedReasoning,
      identified_issues: selectedIssues,
    };

    try {
      const response = await api.education.submitAssessment(caseDetail.case_code || caseDetail.id, payload);
      onSubmitted(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setSubmitError('Your session has expired. Please sign in again.');
        } else if (err.status === 403) {
          setSubmitError('Forbidden: only accounts with the Pharmacy Student role may submit assessments.');
        } else if (err.status === 422) {
          setSubmitError('Validation error: please ensure clinical reasoning contains at least 10 characters.');
        } else {
          setSubmitError(err.message || 'Assessment submission failed. Please try again.');
        }
      } else {
        setSubmitError('An unexpected network error occurred while submitting your assessment.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`} data-testid="assessment-studio-loading">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBackToList}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
        </div>
        <SkeletonLoader type="card" count={2} />
      </div>
    );
  }

  if (loadError || !caseDetail) {
    return (
      <div className={`space-y-6 ${className}`} data-testid="assessment-studio-error">
        <Button variant="ghost" size="sm" onClick={onBackToList}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Case Catalog
        </Button>
        <div
          role="alert"
          className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-center space-y-3"
        >
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
            Failed to Load Clinical Case
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 max-w-md mx-auto">
            {loadError || 'The requested clinical case could not be retrieved.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => fetchDetail()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="assessment-studio">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBackToList} data-testid="back-to-catalog-button">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Case Catalog
          </Button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {caseDetail.case_code}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {caseDetail.difficulty}
            </span>
          </div>
        </div>

        {caseDetail.attempts_count > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            <span>Prior attempts: {caseDetail.attempts_count} (New submission will be recorded)</span>
          </div>
        )}
      </div>

      {/* Case Title Banner */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-500 shrink-0" />
            {caseDetail.title}
          </h1>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md self-start md:self-auto">
            Category: {caseDetail.category.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Advisory Disclaimer */}
        <div className="p-3 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-300">
          <Info className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <span>
            {caseDetail.disclaimer ||
              'Advisory educational simulation prototype. Synthetic training benchmark only; not for clinical decision-making or autonomous patient care.'}
          </span>
        </div>
      </div>

      {/* Clinical Scenario & Order Context (2-Column Grid on Large Screens) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patient Clinical Profile */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
            <User className="w-4 h-4 text-indigo-500" />
            <span>Synthetic Patient Clinical Profile</span>
          </div>
          <div className="p-5 space-y-4 flex-1">
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed text-sm">
              {caseDetail.patient_summary}
            </div>
          </div>
        </div>

        {/* Prescription & Order Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 font-semibold text-sm text-slate-800 dark:text-slate-200">
            <Pill className="w-4 h-4 text-emerald-500" />
            <span>Prescription Order Under Review</span>
          </div>
          <div className="p-5 space-y-4 flex-1">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/60 text-sm font-mono text-slate-800 dark:text-slate-200">
              {caseDetail.prescription_summary}
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Clinical Presentation & Context
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {caseDetail.clinical_scenario}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Learning Objectives Callout */}
      {caseDetail.learning_objectives.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-500" />
            <span>Pedagogical Competencies Evaluated in This Case</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            {caseDetail.learning_objectives.map((obj, i) => (
              <li
                key={i}
                className="text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 flex items-start gap-2"
              >
                <span className="font-semibold text-indigo-500">{i + 1}.</span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assessment Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
        data-testid="student-assessment-form"
      >
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              Pharmacist Clinical Assessment & Recommendation
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Formulate your independent determination and clinical rationale based on pharmacology and guideline criteria.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Submit Error Alert */}
          {submitError && (
            <div
              role="alert"
              className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300 flex items-start gap-2.5"
              data-testid="submit-error-alert"
            >
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="space-y-1">
                <div className="font-semibold">Submission Incomplete</div>
                <div>{submitError}</div>
              </div>
            </div>
          )}

          {/* Section 1: Determination Selector */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white">
              1. Clinical Review Determination <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select the primary verification action warranted for this patient order:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="Clinical Determination">
              {caseDetail.available_determinations.map((detKey) => {
                const info = DETERMINATION_LABELS[detKey] || {
                  title: detKey.replace(/_/g, ' '),
                  subtitle: 'Clinical determination action',
                };
                const isSelected = selectedDetermination === detKey;

                return (
                  <button
                    key={detKey}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    data-testid={`determination-option-${detKey}`}
                    onClick={() => setSelectedDetermination(detKey)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                          {info.title}
                        </span>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {info.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Clinical Issue Category Multi-Select */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                2. Identified Clinical Issue Categories <span className="text-xs font-normal text-slate-400">(Multi-select all that apply)</span>
              </label>
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {selectedIssues.length} selected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Categorize the therapeutic concerns discovered during your clinical verification review:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CLINICAL_ISSUE_OPTIONS.map((cat) => {
                const isChecked = selectedIssues.includes(cat.id);
                return (
                  <label
                    key={cat.id}
                    data-testid={`issue-option-${cat.id}`}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                      isChecked
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleIssue(cat.id)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {cat.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {cat.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Clinical Reasoning Textarea */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="student-reasoning-input" className="block text-sm font-semibold text-slate-900 dark:text-white">
                3. Clinical Rationale & Recommendation <span className="text-red-500">*</span>
              </label>
              <div
                className={`text-xs font-mono font-medium ${
                  isReasoningValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                }`}
                data-testid="reasoning-character-counter"
              >
                {trimmedReasoning.length} characters (min 10)
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Provide thorough clinical documentation. Reference drug pharmacology, mechanism of conflict, patient risk factors, and recommended therapeutic alternatives or monitoring requirements.
            </p>

            <textarea
              id="student-reasoning-input"
              data-testid="student-reasoning-textarea"
              rows={5}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Example: Amoxicillin is an amino-penicillin that shares the beta-lactam core structure. Given the patient's documented history of severe IgE-mediated anaphylaxis requiring ICU admission, amoxicillin is absolutely contraindicated. Recommend rejecting this order and consulting the prescriber for an alternative non-beta-lactam antibiotic..."
              className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />

            {!isReasoningValid && trimmedReasoning.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Please write at least 10 non-whitespace characters to satisfy academic clinical documentation criteria.
              </p>
            )}
          </div>
        </div>

        {/* Footer Submission Bar */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            <span className="font-semibold">Academic Integrity Notice:</span> Submissions are evaluated against standard benchmark rubrics and permanently recorded in your student attempt ledger.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onBackToList}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              data-testid="submit-assessment-button"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Submit Clinical Assessment</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

