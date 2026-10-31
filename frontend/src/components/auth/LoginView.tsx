import React, { useState } from 'react';
import { ShieldCheck, Activity, Award, GraduationCap, AlertCircle, ArrowRight, Lock, User as UserIcon } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { UserRole } from '../../types/api';

const demoRolesConfig: Array<{
  role: UserRole;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  borderColor: string;
}> = [
  {
    role: 'staff_pharmacist',
    title: 'Staff Pharmacist',
    badge: 'Clinical Verification',
    icon: Activity,
    description: 'Review queued prescriptions, inspect deterministic engine safety findings, submit ACCEPT, OVERRIDE, or ESCALATE.',
    borderColor: 'hover:border-emerald-500/80',
  },
  {
    role: 'chief_pharmacist',
    title: 'Chief Pharmacist',
    badge: 'Oversight & Resolution',
    icon: Award,
    description: 'Resolve escalated HIGH-risk prescriptions, inspect inventory deficit alerts, adjust minimum reorder thresholds.',
    borderColor: 'hover:border-indigo-500/80',
  },
  {
    role: 'pharmacy_student',
    title: 'Pharmacy Student',
    badge: 'Educational Simulation',
    icon: GraduationCap,
    description: 'Engage with simulated synthetic patient cases, document clinical reasoning, receive objective rubric scoring.',
    borderColor: 'hover:border-amber-500/80',
  },
];

export const LoginView: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState('pharmacist_demo');
  const [password, setPassword] = useState('StaffDemoPassword2026!');
  const [activeSubmittingRole, setActiveSubmittingRole] = useState<UserRole | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    try {
      await login({ username: username.trim(), password });
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleQuickDemoLogin = async (role: UserRole) => {
    clearError();
    const creds = DEMO_CREDENTIALS[role];
    setUsername(creds.username);
    setPassword(creds.password);
    setActiveSubmittingRole(role);
    try {
      await login(creds);
    } catch {
      // Error handled by AuthContext
    } finally {
      setActiveSubmittingRole(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-emerald-600 rounded-2xl text-white shadow-md mb-3">
          <ShieldCheck className="w-8 h-8" aria-hidden="true" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          PharmacyGuard Workstation
        </h2>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Hospital prescription verification, safety escalation oversight, and pharmacy student simulation environment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Manual Credentials Sign-In */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            Sign In with Account
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Enter your workstation credentials to access your authorized role workspace.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">Authentication Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Workstation Username
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    clearError();
                    setUsername(e.target.value);
                  }}
                  disabled={isLoading}
                  placeholder="e.g. pharmacist_demo"
                  className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Password
              </label>
              <div className="relative rounded-md shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    clearError();
                    setPassword(e.target.value);
                  }}
                  disabled={isLoading}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading && activeSubmittingRole === null}
              className="w-full mt-2"
            >
              Sign In to Workstation
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center font-mono">
            API Route: POST /api/v1/auth/login · JWT Bearer
          </div>
        </div>

        {/* Right column: 1-Click Demo Profiles */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Live Demo Workstation Profiles
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any profile to instantly authenticate through the backend API with pre-seeded demo accounts.
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 hidden sm:inline">
              Real API Auth
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {demoRolesConfig.map((item) => {
              const Icon = item.icon;
              const creds = DEMO_CREDENTIALS[item.role];
              const isCardSubmitting = isLoading && activeSubmittingRole === item.role;

              return (
                <div
                  key={item.role}
                  className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 transition-all shadow-xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${item.borderColor}`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1.5">
                        Username: <span className="text-slate-700 dark:text-slate-300">{creds.username}</span>
                      </p>
                    </div>
                  </div>

                  <div className="sm:self-center shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={isCardSubmitting}
                      disabled={isLoading}
                      onClick={() => handleQuickDemoLogin(item.role)}
                      icon={<ArrowRight className="w-3.5 h-3.5" />}
                      iconPosition="right"
                      className="w-full sm:w-auto"
                    >
                      Authenticate
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

