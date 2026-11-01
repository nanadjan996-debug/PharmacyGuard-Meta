import React from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/api';

export interface AccessDeniedViewProps {
  requestedWorkspace: string;
  requiredRole: UserRole | string;
  onNavigateHome: () => void;
}

const roleNames: Record<string, string> = {
  staff_pharmacist: 'Staff Pharmacist',
  chief_pharmacist: 'Chief Pharmacist',
  pharmacy_student: 'Pharmacy Student',
  staff: 'Staff Pharmacist',
  chief: 'Chief Pharmacist',
  student: 'Pharmacy Student',
};

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  requestedWorkspace,
  requiredRole,
  onNavigateHome,
}) => {
  const { user } = useAuth();

  const userRolesFormatted = user?.roles
    ? user.roles.map((r) => roleNames[r] || r).join(', ')
    : 'None';
  const targetWorkspaceFormatted = roleNames[requestedWorkspace] || requestedWorkspace;
  const requiredRoleFormatted = roleNames[requiredRole] || requiredRole;

  return (
    <div
      role="region"
      aria-label="Access Denied"
      className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center"
    >
      <div className="p-4 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm mb-5">
        <ShieldAlert className="w-12 h-12" aria-hidden="true" />
      </div>

      <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800 mb-3">
        <Lock className="w-3.5 h-3.5" />
        <span>HTTP 403 · ACCESS CONTROL REJECTION</span>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
        Access Denied: Restricted Workspace
      </h2>

      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mb-6 leading-relaxed">
        You are authenticated as <strong className="text-slate-900 dark:text-slate-200">{user?.full_name}</strong> with role{' '}
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {userRolesFormatted}
        </span>
        . Access to the <strong className="text-slate-900 dark:text-slate-200">{targetWorkspaceFormatted}</strong> workspace is strictly restricted to accounts with{' '}
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {requiredRoleFormatted}
        </span>{' '}
        privileges.
      </p>

      {/* Safety Boundary Notice */}
      <div className="w-full max-w-lg text-left p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2 mb-6 shadow-xs">
        <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
          <span>Dual Safety Boundary Active</span>
        </p>
        <p>
          1. <strong>Frontend Route Guard:</strong> Intercepted direct URL navigation to <code className="text-red-600 dark:text-red-400">?workspace={requestedWorkspace}</code> and rendered this security boundary.
        </p>
        <p>
          2. <strong>Backend API Rejection:</strong> FastAPI route dependencies independently reject any unauthorized requests with <code className="text-red-600 dark:text-red-400">HTTP 403 Forbidden</code> regardless of client-side routing.
        </p>
      </div>

      <Button
        variant="primary"
        size="md"
        icon={<ArrowLeft className="w-4 h-4" />}
        onClick={onNavigateHome}
      >
        Return to Authorized Workspace
      </Button>
    </div>
  );
};

