import React, { useState, useEffect } from 'react';
import {
  Activity,
  Award,
  GraduationCap,
  Store,
  ScanLine,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/api';
import { StaffPrescriptionWorkspace } from '../prescriptions/StaffPrescriptionWorkspace';
import { ChiefOversightWorkspace } from '../oversight/ChiefOversightWorkspace';
import { StudentSimulationWorkspace } from '../education/StudentSimulationWorkspace';
import { CounterIntakeStudio } from '../community/CounterIntakeStudio';
import { PrescriptionScannerStudio } from '../community/PrescriptionScannerStudio';

export interface Stage1WorkspaceShellProps {
  workspace?: 'staff' | 'chief' | 'student';
  onNavigateWorkspace?: (ws: 'staff' | 'chief' | 'student') => void;
  showHospitalQueue?: boolean;
}

export const Stage1WorkspaceShell: React.FC<Stage1WorkspaceShellProps> = ({
  workspace,
  showHospitalQueue = false,
}) => {
  const { user } = useAuth();
  const [staffMode, setStaffMode] = useState<'counter' | 'scanner'>(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const mode = new URLSearchParams(window.location.search).get('mode');
      if (mode === 'scanner') return 'scanner';
    }
    return 'counter';
  });

  // Sanitize any legacy mode=inpatient query parameters from URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('mode') === 'inpatient') {
        url.searchParams.delete('mode');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white capitalize">
                {primaryRole.replace('_', ' ')} Workstation
              </h2>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Station Online</span>
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Clinician: <strong className="text-slate-700 dark:text-slate-200 font-medium">{user?.full_name}</strong> · Role: <span className="font-mono text-[11px] text-sky-700 dark:text-sky-400">{user?.roles?.join(', ')}</span>
            </p>
          </div>
        </div>

        {/* Clinical Engine & Model Status Badges */}
        <div className="flex items-center space-x-2 self-start sm:self-auto text-xs">
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px]">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">Safety Engine:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">Deterministic Active</span>
          </div>
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/70 border border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 text-[11px]">
            <span className="text-sky-700 dark:text-sky-300 font-semibold">Bedrock AI:</span>
            <span className="font-bold font-mono">Claude Sonnet 4.6</span>
          </div>
        </div>
      </div>

      {/* Staff Pharmacist Sub-Workflow Mode Selector (Community Counter vs Prescription Scanner) */}
      {primaryRole === 'staff_pharmacist' && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex flex-wrap items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setStaffMode('counter')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                staffMode === 'counter'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs border border-slate-300 dark:border-slate-700 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Counter Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setStaffMode('scanner')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                staffMode === 'scanner'
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-xs border border-slate-300 dark:border-slate-700 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Prescription Scanner</span>
            </button>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-300 hidden sm:inline">
            Active Mode:{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-bold">
              {staffMode === 'counter'
                ? 'Counter Consultation Intake'
                : 'Prescription OCR & 7-Field Human Gate'}
            </strong>
          </span>
        </div>
      )}

      {/* Main Clinical Workstation */}
      <div className="space-y-6">
        {/* Staff Pharmacist Workspaces */}
        {primaryRole === 'staff_pharmacist' && (
          showHospitalQueue ? (
            /* Hospital Inpatient Queue (Preserved for institutional approval phase) */
            <StaffPrescriptionWorkspace />
          ) : staffMode === 'scanner' ? (
            <PrescriptionScannerStudio />
          ) : (
            <CounterIntakeStudio />
          )
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
