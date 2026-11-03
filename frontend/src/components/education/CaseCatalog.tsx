import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Target,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../../services/api';
import { EducationalCaseListItem } from '../../types/api';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';

export interface CaseCatalogProps {
  onSelectCase: (caseId: string) => void;
  className?: string;
}

export type DifficultyFilter = 'ALL' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type CompletionFilter = 'ALL' | 'COMPLETED' | 'NOT_ATTEMPTED';

export const CaseCatalog: React.FC<CaseCatalogProps> = ({
  onSelectCase,
  className = '',
}) => {
  const [cases, setCases] = useState<EducationalCaseListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('ALL');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.education.listCases();
      setCases(data);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError ? err.message : 'Unable to load educational simulation catalog.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Client-side filtering
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // 1. Difficulty filter
      if (difficultyFilter !== 'ALL' && c.difficulty.toUpperCase() !== difficultyFilter) {
        return false;
      }
      // 2. Completion filter
      if (completionFilter !== 'ALL' && c.completion_status.toUpperCase() !== completionFilter) {
        return false;
      }
      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = c.case_code.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesCategory = c.category.toLowerCase().includes(q);
        const matchesObj = c.learning_objectives.some((obj) => obj.toLowerCase().includes(q));
        if (!matchesCode && !matchesTitle && !matchesCategory && !matchesObj) {
          return false;
        }
      }
      return true;
    });
  }, [cases, difficultyFilter, completionFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = cases.length;
    const completed = cases.filter((c) => c.is_completed).length;
    const bestScores = cases.map((c) => c.best_score).filter((s): s is number => s !== null);
    const avgScore = bestScores.length > 0
      ? Math.round(bestScores.reduce((a, b) => a + b, 0) / bestScores.length)
      : null;
    return { total, completed, avgScore };
  }, [cases]);

  const getDifficultyBadge = (difficulty: string) => {
    const normalized = difficulty.toUpperCase();
    switch (normalized) {
      case 'BEGINNER':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
            Beginner
          </span>
        );
      case 'INTERMEDIATE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
            Intermediate
          </span>
        );
      case 'ADVANCED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
            Advanced
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            {difficulty}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="student-case-catalog">
      {/* Educational Banner & Progress Overview */}
      <div className="bg-gradient-to-r from-indigo-900/90 via-slate-900 to-indigo-950 p-6 rounded-2xl border border-indigo-800/40 shadow-sm text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium border border-indigo-400/30">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Inpatient & Regional Clinical Cases</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Clinical Practice Case Catalog</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Structured simulation cases modeled on high-frequency hospital presentations, regional demographic nuances,
              and unconventional clinical scenarios where real patient constraints diverge from standard textbook practice.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 sm:gap-4 self-start md:self-auto shrink-0">
            <div className="bg-slate-800/70 backdrop-blur border border-slate-700/60 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Cases</div>
              <div className="text-xl font-bold text-white mt-0.5">{stats.total}</div>
            </div>
            <div className="bg-slate-800/70 backdrop-blur border border-slate-700/60 rounded-xl px-4 py-3 text-center min-w-[90px]">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Completed</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">{stats.completed} / {stats.total}</div>
            </div>
            {stats.avgScore !== null && (
              <div className="bg-slate-800/70 backdrop-blur border border-slate-700/60 rounded-xl px-4 py-3 text-center min-w-[90px]">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Avg Score</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">{stats.avgScore}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Advisory Disclaimer */}
        <div className="mt-4 pt-3 border-t border-indigo-800/30 text-xs text-indigo-300/80 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span>Simulated hospital encounters & unconventional therapy protocols. Evaluated across objective 100-point rubrics.</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by case code, clinical topic, or category..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Search educational cases"
            />
          </div>

          {/* Difficulty Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by difficulty">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Difficulty:
            </span>
            {(['ALL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as DifficultyFilter[]).map((level) => {
              const active = difficultyFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficultyFilter(level)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {level === 'ALL' ? 'All Tiers' : level.charAt(0) + level.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          {/* Completion Status Filter */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Filter by completion status">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Status:</span>
            {(['ALL', 'COMPLETED', 'NOT_ATTEMPTED'] as CompletionFilter[]).map((st) => {
              const active = completionFilter === st;
              const label =
                st === 'ALL' ? 'All Cases' : st === 'COMPLETED' ? 'Completed' : 'Not Attempted';
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setCompletionFilter(st)}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    active
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="catalog-loading">
          <SkeletonLoader type="card" count={3} />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          role="alert"
          className="p-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-center space-y-3"
          data-testid="catalog-error"
        >
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-red-900 dark:text-red-200">
            Failed to Load Simulation Cases
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 max-w-md mx-auto">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchCases()} className="mt-2">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredCases.length === 0 && (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No Cases Match Active Filters"
          description="Try broadening your difficulty, completion, or keyword search criteria to see available educational cases."
          action={{
            label: 'Clear All Filters',
            onClick: () => {
              setDifficultyFilter('ALL');
              setCompletionFilter('ALL');
              setSearchQuery('');
            },
          }}
          className="my-6"
        />
      )}

      {/* Case Grid */}
      {!isLoading && !error && filteredCases.length > 0 && (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          data-testid="cases-grid"
        >
          {filteredCases.map((caseItem) => {
            const hasAttempts = caseItem.attempts_count > 0;
            return (
              <div
                key={caseItem.id}
                data-testid={`case-card-${caseItem.case_code}`}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {caseItem.case_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getDifficultyBadge(caseItem.difficulty)}
                      <StatusBadge status={caseItem.completion_status} size="sm" />
                    </div>
                  </div>

                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {caseItem.title}
                    </h2>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                      <Target className="w-3 h-3 shrink-0" />
                      <span>{caseItem.category.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  {/* Learning Objectives */}
                  {caseItem.learning_objectives.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Learning Objectives
                      </div>
                      <ul className="space-y-1">
                        {caseItem.learning_objectives.slice(0, 3).map((obj, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1 shrink-0" />
                            <span className="line-clamp-2">{obj}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {hasAttempts ? (
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {caseItem.attempts_count} attempt{caseItem.attempts_count === 1 ? '' : 's'}
                        </span>
                        {caseItem.best_score !== null && (
                          <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                            <Award className="w-3.5 h-3.5" />
                            Best: {caseItem.best_score}/100
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-400">
                        <BookOpen className="w-3.5 h-3.5" />
                        Ready to begin
                      </span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant={hasAttempts ? 'secondary' : 'primary'}
                    onClick={() => onSelectCase(caseItem.id)}
                    className="shrink-0"
                  >
                    <span>{hasAttempts ? 'Retake Case' : 'Start Assessment'}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

