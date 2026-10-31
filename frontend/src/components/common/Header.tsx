import React, { useState } from 'react';
import { ShieldCheck, Activity, Award, GraduationCap, LogOut, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/api';

const roleDisplayMap: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  staff_pharmacist: {
    label: 'Staff Pharmacist',
    icon: Activity,
    color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  chief_pharmacist: {
    label: 'Chief Pharmacist',
    icon: Award,
    color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  pharmacy_student: {
    label: 'Pharmacy Student',
    icon: GraduationCap,
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
};

export const Header: React.FC = () => {
  const { user, logout, switchRole, isLoading } = useAuth();
  const [switchingRole, setSwitchingRole] = useState<UserRole | null>(null);

  // Determine current active primary role
  const primaryRole: UserRole = (user?.roles?.[0] as UserRole) || 'staff_pharmacist';

  const handleRoleSwitch = async (role: UserRole) => {
    if (primaryRole === role || switchingRole) return;
    setSwitchingRole(role);
    try {
      await switchRole(role);
    } finally {
      setSwitchingRole(null);
    }
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white shadow-sm flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                PharmacyGuard
              </h1>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Stage 1 Shell
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-0.5">
              Prescription Verification & Operational Decision Support
            </p>
          </div>
        </div>

        {/* Center: Live Demo Role Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60 self-start md:self-auto overflow-x-auto max-w-full">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-2 uppercase tracking-wider hidden lg:inline">
            Demo Role:
          </span>

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
                className={`relative px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all select-none whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isSwitching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                )}
                <span>{config.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Authenticated User Pill & Logout */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          {user ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-right">
                <div className="hidden sm:block">
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

