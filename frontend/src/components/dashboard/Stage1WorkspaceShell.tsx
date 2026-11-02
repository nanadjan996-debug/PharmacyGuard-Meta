import React from 'react';
import {
  Activity,
  Award,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/api';
import { StaffPrescriptionWorkspace } from '../prescriptions/StaffPrescriptionWorkspace';
import { ChiefOversightWorkspace } from '../oversight/ChiefOversightWorkspace';
import { StudentSimulationWorkspace } from '../education/StudentSimulationWorkspace';

export interface Stage1WorkspaceShellProps {
  workspace?: 'staff' | 'chief' | 'student';
  onNavigateWorkspace?: (ws: 'staff' | 'chief' | 'student') => void;
}

export const Stage1WorkspaceShell: React.FC<Stage1WorkspaceShellProps> = ({ workspace }) => {
  const { user } = useAuth();

  const workspaceToRole: Record<'staff' | 'chief' | 'student', UserRole> = {
    staff: 'staff_pharmacist',
    chief: 'chief_pharmacist',
    student: 'pharmacy_student',
  };

  const primaryRole: UserRole = workspace
    ? workspaceToRole[workspace]
    : ((user?.roles?.[0] as UserRole) || 'staff_pharmacist');

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-5 space-y-6">
      {/* Modern Clinical Station Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-5 py-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-sky-50 dark:bg-sky-950/60 border border-sky-100 dark:border-sky-800/80 rounded-xl text-sky-600 dark:text-sky-400 shrink-0 shadow-2xs">
            {primaryRole === 'staff_pharmacist' && <Activity className="w-5 h-5 text-blue-600 dark:text-sky-400" />}
            {primaryRole === 'chief_pharmacist' && <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            {primaryRole === 'pharmacy_student' && <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white capitalize">
                {primaryRole.replace('_', ' ')} Workstation
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                {primaryRole === 'staff_pharmacist'
                  ? 'Stage 2 Workstation'
                  : primaryRole === 'chief_pharmacist'
                  ? 'Stage 3 Oversight Workstation'
                  : 'Stage 4 Student Simulation Lab'}
              </span>
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Station Online</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clinician: <strong className="text-slate-700 dark:text-slate-200 font-medium">{user?.full_name}</strong> · Role: <span className="font-mono text-[11px] text-sky-700 dark:text-sky-400">{user?.roles?.join(', ')}</span>
            </p>
          </div>
        </div>

        {/* Clinical Engine & Model Status Badges */}
        <div className="flex items-center space-x-2 self-start sm:self-auto text-xs">
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 text-[11px]">
            <span className="text-slate-400 font-medium">Safety Engine:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">Deterministic Active</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-50/80 dark:bg-sky-950/50 border border-sky-200/70 dark:border-sky-800/60 text-sky-800 dark:text-sky-300 text-[11px]">
            <span className="text-sky-600 dark:text-sky-400 font-medium">Meta AI:</span>
            <span className="font-semibold font-mono">Muse Spark Open</span>
          </div>
        </div>
      </div>

      {/* Main Clinical Workstation */}
      <div className="space-y-6">
        {/* Staff Pharmacist Live Prescription Workflow */}
        {primaryRole === 'staff_pharmacist' && (
          <StaffPrescriptionWorkspace />
        )}

        {/* Chief Pharmacist Live Oversight & Inventory Workstation */}
        {primaryRole === 'chief_pharmacist' && (
          <ChiefOversightWorkspace />
        )}

        {/* Pharmacy Student Live Simulation Workstation */}
        {primaryRole === 'pharmacy_student' && (
          <StudentSimulationWorkspace />
        )}
      </div>
    </div>
  );
};
