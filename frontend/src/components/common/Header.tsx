import React, { useState } from 'react';
import { Activity, Award, GraduationCap, LogOut, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/api';

export interface HeaderProps {
  currentWorkspace?: 'staff' | 'chief' | 'student';
  onNavigateWorkspace?: (ws: 'staff' | 'chief' | 'student') => void;
}

const roleDisplayMap: Record<
  UserRole,
  { label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }>; workspace: 'staff' | 'chief' | 'student' }
> = {
  staff_pharmacist: {
    label: 'Staff Pharmacist',
    shortLabel: 'Staff',
    icon: Activity,
    workspace: 'staff',
  },
  chief_pharmacist: {
    label: 'Chief Pharmacist',
    shortLabel: 'Chief',
    icon: Award,
    workspace: 'chief',
  },
  pharmacy_student: {
    label: 'Pharmacy Student',
    shortLabel: 'Student',
    icon: GraduationCap,
    workspace: 'student',
  },
};

export const Header: React.FC<HeaderProps> = ({ onNavigateWorkspace }) => {
  const { user, logout, switchRole, isLoading } = useAuth();
  const [switchingRole, setSwitchingRole] = useState<UserRole | null>(null);

  // Determine current active primary role
  const primaryRole: UserRole = (user?.roles?.[0] as UserRole) || 'staff_pharmacist';

  const handleRoleSwitch = async (role: UserRole) => {
    if (primaryRole === role || switchingRole) return;
    setSwitchingRole(role);
    try {
      await switchRole(role);
      const targetWorkspace = roleDisplayMap[role]?.workspace;
      if (targetWorkspace && onNavigateWorkspace) {
        onNavigateWorkspace(targetWorkspace);
      }
    } finally {
      setSwitchingRole(null);
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        {/* Brand identity */}
        <div className="flex items-center justify-between md:justify-start">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="shrink-0 flex items-center justify-center">
              <img src="/logo.png" alt="PharmacyGuard Logo" className="w-7 h-7 sm:w-9 sm:h-9 object-contain drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-lg font-black tracking-tight leading-none">
                  <span className="text-sky-500">PHARMACY</span>
                  <span className="text-blue-700 dark:text-blue-400">GUARD</span>
                </h1>
                <span className="text-[9px] sm:text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-semibold">
                  AI Agent
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-none mt-1 hidden xs:block sm:block">
                AI Clinical Verification Agent • For Pharmacists &amp; Students
              </p>
            </div>
          </div>

          {/* Mobile-only Logout button in brand row */}
          {user && (
            <div className="flex md:hidden items-center space-x-2">
              <span className="text-[11px] font-mono text-slate-500">@{user.username}</span>
              <button
                type="button"
                onClick={() => logout()}
                title="Log out of current session"
                className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Live Demo Role Switcher */}
        <div className="flex items-center justify-center sm:justify-start bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 w-full md:w-auto overflow-x-auto">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-2 uppercase tracking-wider hidden lg:inline shrink-0">
            Demo Role:
          </span>

          <div className="flex items-center justify-between w-full md:w-auto space-x-1">
            {(['staff_pharmacist', 'chief_pharmacist', 'pharmacy_student'] as UserRole[]).map((role) => {
              const config = roleDisplayMap[role];
              const IconComponent = config.icon;
              const isActive = primaryRole === role;
              const isSwitching = switchingRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleRoleSwitch(role)}
                  disabled={isLoading || isSwitching}
                  title={`Switch to ${config.label} account (authenticates via API)`}
                  className={`flex-1 md:flex-initial relative px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium flex items-center justify-center space-x-1.5 transition-all select-none whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {isSwitching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                  ) : (
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  )}
                  <span className="hidden sm:inline">{config.label}</span>
                  <span className="sm:hidden">{config.shortLabel}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Authenticated User Pill & Logout (Desktop / Tablet) */}
        <div className="hidden md:flex items-center space-x-3 shrink-0">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-right">
                <div>
                  <p className="text-xs font-medium text-slate-900 dark:text-white leading-tight">
                    {user.full_name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 leading-tight">
                    @{user.username}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold">
                  <UserIcon className="w-4 h-4" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                title="Log out of current session"
                className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
