import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  Search,
  RefreshCw,
  AlertTriangle,
  Award,
  Eye,
  ArrowLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import {
  StudentSubmissionListItem,
  StudentSubmissionResponse,
} from '../../types/api';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';

export interface StudentSubmissionHistoryProps {
  onSelectCase?: (caseId: string) => void;
  onBackToCatalog?: () => void;
  className?: string;
}

export const StudentSubmissionHistory: React.FC<StudentSubmissionHistoryProps> = ({
  onSelectCase,
  onBackToCatalog,
  className = '',
}) => {
  const [submissions, setSubmissions] = useState<StudentSubmissionListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Inspection modal state
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [inspectionData, setInspectionData] = useState<StudentSubmissionResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.education.listSubmissions();
      // Sort chronologically descending (latest first)
      const sorted = [...data].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      );
      setSubmissions(sorted);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load student submission history.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Inspect submission detail
  const handleInspect = async (id: string) => {
    setSelectedSubmissionId(id);
    setIsLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await api.education.getSubmissionDetail(id);
      setInspectionData(detail);
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to retrieve detailed submission feedback.';
      setDetailError(msg);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedSubmissionId(null);
    setInspectionData(null);
    setDetailError(null);
  };

  const filteredSubmissions = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase();
    return submissions.filter(
      (s) =>
        s.case_code.toLowerCase().includes(q) ||
        s.case_title.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.submitted_determination.toLowerCase().includes(q)
    );
  }, [submissions, searchQuery]);

  const stats = useMemo(() => {
    const total = submissions.length;
    if (total === 0) return { total: 0, avgScore: 0, highScoring: 0 };
    const avgScore = Math.round(submissions.reduce((acc, s) => acc + s.score_awarded, 0) / total);
    const highScoring = submissions.filter((s) => s.score_awarded >= 80).length;
    return { total, avgScore, highScoring };
  }, [submissions]);

  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
          <Award className="w-3.5 h-3.5" />
          {score} / 100
        </span>
      );
    }
    if (score >= 70) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
          {score} / 100
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-800 border border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
        {score} / 100
      </span>
    );
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="student-submission-history">
      {/* Header & Academic Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBackToCatalog && (
              <Button variant="ghost" size="sm" onClick={onBackToCatalog} className="mr-1">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Case Catalog
              </Button>
            )}
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              Academic Submission History & Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Immutable longitudinal record of your clinical simulation attempts and deterministic rubric evaluations.
          </p>
        </div>

        {/* Quick History Stats */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-center min-w-[70px]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Attempts</div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-center min-w-[70px]">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Mean Score</div>
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{stats.avgScore}%</div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by case code, scenario title, or determination..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Search submissions"
          />
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchSubmissions()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div data-testid="history-loading" className="space-y-4">
          <SkeletonLoader type="table" count={5} />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          role="alert"
          className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-center space-y-3"
          data-testid="history-error"
        >
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
            Unable to Load Submission History
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 max-w-md mx-auto">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchSubmissions()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredSubmissions.length === 0 && (
        <EmptyState
          icon={<History className="w-6 h-6" />}
          title={searchQuery ? 'No Submissions Match Search' : 'No Submissions Recorded Yet'}
          description={
            searchQuery
              ? 'Try modifying your search term to locate past clinical attempts.'
              : 'Complete a clinical case assessment in the Case Catalog to populate your academic evaluation history.'
          }
          action={
            onBackToCatalog
              ? {
                  label: 'Browse Case Catalog',
                  onClick: onBackToCatalog,
                }
              : undefined
          }
          className="my-6"
        />
      )}

      {/* Chronological Submissions Table */}
      {!isLoading && !error && filteredSubmissions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="submissions-table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Case Code & Title</th>
                  <th className="py-3.5 px-4 hidden sm:table-cell">Tier</th>
                  <th className="py-3.5 px-4">Submitted Determination</th>
                  <th className="py-3.5 px-4">Score</th>
                  <th className="py-3.5 px-4 hidden md:table-cell">Attempt</th>
                  <th className="py-3.5 px-4 hidden lg:table-cell">Submitted At</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredSubmissions.map((sub) => (
                  <tr
                    key={sub.id}
                    data-testid={`submission-row-${sub.id}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Case Code & Title */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {sub.case_code}
                          </span>
                          {onSelectCase ? (
                            <button
                              type="button"
                              onClick={() => onSelectCase(sub.case_code || sub.case_id)}
                              className="font-medium text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 text-left line-clamp-1 transition-colors"
                            >
                              {sub.case_title}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-900 dark:text-white line-clamp-1">
                              {sub.case_title}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {sub.category.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </td>

                    {/* Difficulty */}
                    <td className="py-3.5 px-4 hidden sm:table-cell">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {sub.difficulty}
                      </span>
                    </td>

                    {/* Submitted Determination */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {sub.submitted_determination}
                      </span>
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4">
                      {getScoreBadge(sub.score_awarded)}
                    </td>

                    {/* Attempt Number */}
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
                        #{sub.attempt_number}
                      </span>
                    </td>

                    {/* Submitted At */}
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(sub.submitted_at).toLocaleString()}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInspect(sub.id)}
                        data-testid={`inspect-submission-btn-${sub.id}`}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Inspect Feedback
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submission Detail Inspection Modal */}
      <Modal
        isOpen={Boolean(selectedSubmissionId)}
        onClose={handleCloseModal}
        title={inspectionData ? `${inspectionData.case_code}: Evaluation Feedback` : 'Submission Feedback'}
        subtitle={
          inspectionData
            ? `Attempt #${inspectionData.attempt_number} evaluated for ${inspectionData.student_name}`
            : undefined
        }
        maxWidth="2xl"
      >
        {isLoadingDetail && (
          <div className="py-12 space-y-4" data-testid="inspection-modal-loading">
            <SkeletonLoader type="card" count={2} />
          </div>
        )}

        {detailError && (
          <div role="alert" className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-300">
            {detailError}
          </div>
        )}

        {inspectionData && !isLoadingDetail && (
          <div className="space-y-6" data-testid="inspection-modal-content">
            {/* Top Score Banner in Modal */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-xl text-white flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Evaluation Result</div>
                <div className="text-base font-bold text-white mt-0.5">{inspectionData.case_title}</div>
                <div className="text-xs text-indigo-300 mt-1">
                  Submitted: {new Date(inspectionData.submitted_at).toLocaleString()}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-slate-400 font-medium">Total Score</div>
                <div className="text-2xl font-black text-emerald-400" data-testid="modal-total-score">
                  {inspectionData.score_awarded} / 100
                </div>
              </div>
            </div>

            {/* Rubric Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Determination</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {inspectionData.feedback.determination_score} / 50 pts
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {inspectionData.submitted_determination}
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Issue Identification</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {inspectionData.feedback.issue_identification_score} / 30 pts
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {inspectionData.feedback.correctly_identified_issues.length} matched
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Reasoning Elements</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {inspectionData.feedback.reasoning_score} / 20 pts
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {inspectionData.feedback.correctly_identified_reasoning_elements.length} matched
                </div>
              </div>
            </div>

            {/* Submitted Reasoning */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Submitted Student Reasoning
              </div>
              <blockquote className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-l-4 border-indigo-500 text-xs text-slate-700 dark:text-slate-300 italic whitespace-pre-line leading-relaxed">
                "{inspectionData.submitted_reasoning}"
              </blockquote>
            </div>

            {/* Expert Clinical Rationale */}
            <div className="space-y-2 p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Expert Clinical Solution
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {inspectionData.feedback.clinical_rationale || inspectionData.predefined_explanation}
              </p>
            </div>

            {/* Key Learning Points */}
            {inspectionData.feedback.key_learning_points && inspectionData.feedback.key_learning_points.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Key Learning Takeaways
                </div>
                <ul className="space-y-1">
                  {inspectionData.feedback.key_learning_points.map((pt, i) => (
                    <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

