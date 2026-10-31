import React, { useState } from 'react';
import {
  Activity,
  Award,
  GraduationCap,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { SeverityBadge } from '../common/SeverityBadge';
import { Modal } from '../common/Modal';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { EmptyState } from '../common/EmptyState';
import { UserRole } from '../../types/api';

export const Stage1WorkspaceShell: React.FC = () => {
  const { user } = useAuth();
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'primitives' | 'roadmap'>(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'primitives' || tabParam === 'roadmap') return tabParam;
    }
    return 'overview';
  });

  const primaryRole: UserRole = (user?.roles?.[0] as UserRole) || 'staff_pharmacist';

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      {/* Workspace Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            {primaryRole === 'staff_pharmacist' && <Activity className="w-6 h-6" />}
            {primaryRole === 'chief_pharmacist' && <Award className="w-6 h-6" />}
            {primaryRole === 'pharmacy_student' && <GraduationCap className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white capitalize">
                {primaryRole.replace('_', ' ')} Workstation
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Stage 1 Shell Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Signed in as <strong className="text-slate-800 dark:text-slate-200">{user?.full_name}</strong> (
              <span className="font-mono text-xs">{user?.username}</span>). Authorized roles from backend JWT:{' '}
              <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {user?.roles?.join(', ')}
              </span>
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('primitives')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'primitives'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            UI Primitives Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'roadmap'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Stage Roadmap
          </button>
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Authentication & RBAC
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                21 Endpoints
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Typed contracts verified against FastAPI Pydantic v2 schemas.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Role Quick-Switching
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white capitalize">
                Live Backend
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Direct authentication via real credentials. Zero simulated fake tokens.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Session Safety
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                Auto 401 Eviction
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Automatic session cleanup, audit log dispatch, and clean token handling.
              </p>
            </div>
          </div>

          {/* Role specific guide */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">
              Current Role Permissions & Capabilities
            </h3>
            {primaryRole === 'staff_pharmacist' && (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  As a <strong>Staff Pharmacist</strong>, you are authorized to verify clinical prescriptions in the verification queue:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                  <li>Inspect patient demographics, medication orders, and prescriber records.</li>
                  <li>Review deterministic safety findings: Drug-Drug Interactions, Allergies, Dosage, Duplicate Therapy.</li>
                  <li>Submit <code>ACCEPT</code> (requires clinical rationale if HIGH-severity finding exists).</li>
                  <li>Submit <code>OVERRIDE</code> (requires non-empty clinical rationale).</li>
                  <li>Submit <code>ESCALATE</code> (requires clarification/escalation reason stored in notes).</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Ready for <strong>Stage 2</strong>: Clinical Verification Queue & Interactive Review Dialog.
                </div>
              </div>
            )}

            {primaryRole === 'chief_pharmacist' && (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  As a <strong>Chief Pharmacist</strong>, you possess supervisory authority across the hospital pharmacy:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                  <li>Resolve escalated prescriptions: <code>APPROVED_AFTER_CLARIFICATION</code> or <code>REJECTED</code>.</li>
                  <li>High-severity approvals strictly require mandatory non-empty rationale.</li>
                  <li>Inspect pharmacy inventory status summaries, deficits, and transaction audit trails.</li>
                  <li>Update medication minimum inventory reorder thresholds with real-time recalculation.</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Ready for <strong>Stage 3</strong>: Chief Oversight, Escalation Resolution & Inventory Management.
                </div>
              </div>
            )}

            {primaryRole === 'pharmacy_student' && (
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  As a <strong>Pharmacy Student</strong>, you operate in an isolated educational simulation environment:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                  <li>Access synthetic clinical practice cases without impacting live patient queues.</li>
                  <li>Formulate clinical determination and document reasoning explanation.</li>
                  <li>Receive transparent, rubric-based deterministic evaluations and immediate feedback.</li>
                  <li>Review personal assessment history and score progressions.</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Ready for <strong>Stage 4</strong>: Student Simulation Lab & Deterministic Rubric Assessments.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: UI Primitives Catalog */}
      {activeTab === 'primitives' && (
        <div className="space-y-6">
          {/* Status Badges */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              1. StatusBadge Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Accessible badges for prescription workflow and inventory inventory states.
            </p>
            <div className="flex flex-wrap gap-2.5 items-center">
              <StatusBadge status="pending" />
              <StatusBadge status="reviewed" />
              <StatusBadge status="overridden" />
              <StatusBadge status="escalated" />
              <StatusBadge status="resolved" />
              <StatusBadge status="IN_STOCK" />
              <StatusBadge status="LOW_STOCK" />
              <StatusBadge status="OUT_OF_STOCK" />
            </div>
          </div>

          {/* Severity Badges */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              2. SeverityBadge Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Strictly color-coded clinical safety severity levels.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <SeverityBadge severity="HIGH" />
              <SeverityBadge severity="MODERATE" />
              <SeverityBadge severity="LOW" />
              <SeverityBadge severity="INFO" />
            </div>
          </div>

          {/* Buttons */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              3. Button Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Variants, sizes, and states designed for clinical workstation efficiency.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Button variant="primary">Primary Action</Button>
              <Button variant="secondary">Secondary Action</Button>
              <Button variant="danger">Danger Action</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="primary" isLoading>
                Loading
              </Button>
              <Button variant="secondary" disabled>
                Disabled
              </Button>
            </div>
          </div>

          {/* Modal Demo */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              4. Modal Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Accessible dialog with backdrop, Escape key listener, and keyboard trap.
            </p>
            <Button variant="secondary" onClick={() => setIsDemoModalOpen(true)}>
              Open Verification Modal Demo
            </Button>

            <Modal
              isOpen={isDemoModalOpen}
              onClose={() => setIsDemoModalOpen(false)}
              title="Prescription Clinical Rationale Modal"
              subtitle="Demonstrating accessible modal primitive with keyboard support."
              footer={
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsDemoModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setIsDemoModalOpen(false)}>
                    Confirm Action
                  </Button>
                </>
              }
            >
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  This modal verifies full accessibility compliance, including focus handling, backdrop dismiss, and Escape key dismissal.
                </p>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300">
                  Modal test payload: verified for clinical action dialogues in Stage 2.
                </div>
              </div>
            </Modal>
          </div>

          {/* Skeleton Loaders */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              5. SkeletonLoader Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Content placeholder skeletons for asynchronous prescription and inventory queries.
            </p>
            <SkeletonLoader type="text" count={3} />
          </div>

          {/* Empty State */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              6. EmptyState Primitive
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Accessible empty state illustration when queues or tables have zero records.
            </p>
            <EmptyState
              title="No Pending Prescriptions"
              description="All queued prescription verification checks have been processed for this shift."
            />
          </div>
        </div>
      )}

      {/* Tab 3: Stage Roadmap */}
      {activeTab === 'roadmap' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Frontend Implementation Phased Plan
            </h3>
            <p className="text-xs text-slate-500">
              Contract-verified staged delivery according to the approved architecture.
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20 flex items-start space-x-3.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Stage 1 · Current Milestone
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  Foundation, Authentication, Navigation Shell & UI Primitives
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  API client with 401 handling, AuthContext with live backend role switching, responsive header, compact advisory disclaimer, and reusable UI primitives.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-start space-x-3.5">
              <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stage 2 · Next
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  Staff Pharmacist Verification Queue & Review Actions
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Queue table, filters, prescription detail panel with findings list, and review submission dialogs with client validation for required rationales.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-start space-x-3.5">
              <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stage 3
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  Chief Pharmacist Oversight, Escalation Resolution & Inventory Management
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Supervisory escalation workspace, HIGH-finding rationale enforcement, inventory status cards, threshold editor, and audit transaction log.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-start space-x-3.5">
              <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stage 4
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  Pharmacy Student Educational Simulation & Rubric Assessment
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Interactive case study lab, dynamic determination selection, clinical reasoning documentation, rubric scoring results, and performance history.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-start space-x-3.5">
              <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stage 5
                </span>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  End-to-End Verification, Responsive Polish & Final Security Audit
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Full regression test execution, responsive layout audit across viewport sizes, error boundary verification, and build bundle validation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

