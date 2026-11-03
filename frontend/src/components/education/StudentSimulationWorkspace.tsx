import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  BookOpen,
  Target,
  Award,
  History,
  Sparkles,
} from 'lucide-react';
import { CaseCatalog } from './CaseCatalog';
import { AssessmentStudio } from './AssessmentStudio';
import { EvaluationResultsView } from './EvaluationResultsView';
import { StudentSubmissionHistory } from './StudentSubmissionHistory';
import { StudentSubmissionResponse } from '../../types/api';
import { Button } from '../common/Button';

export type StudentSimulationTab = 'catalog' | 'assessment' | 'results' | 'history';

export interface StudentSimulationWorkspaceProps {
  initialTab?: StudentSimulationTab;
  initialCaseId?: string | null;
  className?: string;
}

export const StudentSimulationWorkspace: React.FC<StudentSimulationWorkspaceProps> = ({
  initialTab = 'catalog',
  initialCaseId = null,
  className = '',
}) => {
  // Read initial values from URL query parameters if available
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(() => {
    if (initialCaseId) return initialCaseId;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('case') || urlParams.get('case_id');
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<StudentSimulationTab>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab') as StudentSimulationTab;
      if (tabParam && ['catalog', 'assessment', 'results', 'history'].includes(tabParam)) {
        return tabParam;
      }
    }
    return initialTab;
  });

  const [activeSubmission, setActiveSubmission] = useState<StudentSubmissionResponse | null>(null);

  // Synchronize URL parameters on tab/case navigation
  const updateUrl = (tab: StudentSimulationTab, caseId?: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    if (tab === 'assessment' && caseId) {
      url.searchParams.set('case', caseId);
    } else {
      url.searchParams.delete('case');
      url.searchParams.delete('case_id');
    }
    window.history.pushState({}, '', url.toString());
  };

  // Switch tab directly
  const handleTabChange = (tab: StudentSimulationTab) => {
    setActiveTab(tab);
    updateUrl(tab, tab === 'assessment' ? selectedCaseId : null);
  };

  // Case selected from catalog
  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveTab('assessment');
    updateUrl('assessment', caseId);
  };

  // Assessment submitted successfully
  const handleAssessmentSubmitted = (response: StudentSubmissionResponse) => {
    setActiveSubmission(response);
    setSelectedCaseId(response.case_code || response.case_id);
    setActiveTab('results');
    updateUrl('results', null);
  };

  // Retake case from Results View or History View
  const handleRetakeCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveTab('assessment');
    updateUrl('assessment', caseId);
  };

  // Return to catalog
  const handleBackToCatalog = () => {
    setActiveTab('catalog');
    updateUrl('catalog', null);
  };

  // Navigate to history
  const handleViewHistory = () => {
    setActiveTab('history');
    updateUrl('history', null);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as StudentSimulationTab;
      const caseParam = params.get('case') || params.get('case_id');

      if (tabParam && ['catalog', 'assessment', 'results', 'history'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      if (caseParam) {
        setSelectedCaseId(caseParam);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className={`space-y-6 ${className}`} data-testid="student-simulation-workspace">
      {/* Simulation Navigation Tabs Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {/* Tab 1: Catalog */}
          <button
            type="button"
            onClick={() => handleTabChange('catalog')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'catalog'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            data-testid="student-tab-catalog"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Case Catalog</span>
          </button>

          {/* Tab 2: Assessment Studio */}
          <button
            type="button"
            onClick={() => handleTabChange('assessment')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'assessment'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            data-testid="student-tab-assessment"
          >
            <Target className="w-4 h-4 shrink-0" />
            <span>Assessment Studio</span>
            {selectedCaseId && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 ml-1">
                {selectedCaseId}
              </span>
            )}
          </button>

          {/* Tab 3: Evaluation Results */}
          <button
            type="button"
            onClick={() => handleTabChange('results')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'results'
                ? 'bg-indigo-600 text-white shadow-xs'
                : activeSubmission
                ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                : 'text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400'
            }`}
            data-testid="student-tab-results"
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>Evaluation Results</span>
            {activeSubmission && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                  activeSubmission.score_awarded >= 70
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {activeSubmission.score_awarded}/100
              </span>
            )}
          </button>

          {/* Tab 4: Submission History */}
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            data-testid="student-tab-history"
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Submission History</span>
          </button>
        </div>

        {/* Simulation Environment Mode Badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 rounded-md border border-indigo-200 dark:border-indigo-900/60">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Hospital & Regional Case Simulation</span>
        </div>
      </div>

      {/* Main View Outlet */}
      <div>
        {/* VIEW 1: Case Catalog */}
        {activeTab === 'catalog' && (
          <CaseCatalog onSelectCase={handleSelectCase} />
        )}

        {/* VIEW 2: Assessment Studio */}
        {activeTab === 'assessment' && (
          selectedCaseId ? (
            <AssessmentStudio
              caseId={selectedCaseId}
              onBackToList={handleBackToCatalog}
              onSubmitted={handleAssessmentSubmitted}
            />
          ) : (
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-xl mx-auto shadow-xs"
              data-testid="student-no-case-selected"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No Case Selected for Assessment
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                Select a clinical case from the catalog to evaluate hospital presentations, regional demographic nuances, and unique therapeutic regimens.
              </p>
              <div className="mt-6">
                <Button
                  variant="primary"
                  onClick={handleBackToCatalog}
                  data-testid="select-case-prompt-btn"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Case Catalog
                </Button>
              </div>
            </div>
          )
        )}

        {/* VIEW 3: Evaluation Results */}
        {activeTab === 'results' && (
          activeSubmission ? (
            <EvaluationResultsView
              submission={activeSubmission}
              onBackToCatalog={handleBackToCatalog}
              onViewHistory={handleViewHistory}
              onRetakeCase={handleRetakeCase}
            />
          ) : (
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center max-w-xl mx-auto shadow-xs"
              data-testid="student-no-results-selected"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-4">
                <Award className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No Evaluation Results in Active Session
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
                Submit an assessment from the Assessment Studio to view instant rubric scoring, or inspect feedback from your past attempts in Submission History.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleBackToCatalog}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Browse Case Catalog
                </Button>
                <Button
                  variant="primary"
                  onClick={handleViewHistory}
                >
                  <History className="w-4 h-4 mr-2" />
                  View Submission History
                </Button>
              </div>
            </div>
          )
        )}

        {/* VIEW 4: Student Submission History */}
        {activeTab === 'history' && (
          <StudentSubmissionHistory
            onSelectCase={handleRetakeCase}
            onBackToCatalog={handleBackToCatalog}
          />
        )}
      </div>
    </div>
  );
};
