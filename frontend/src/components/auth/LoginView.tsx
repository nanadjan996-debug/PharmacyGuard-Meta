import React, { useState } from 'react';
import { ShieldCheck, Activity, Award, GraduationCap, AlertCircle, ArrowRight, Lock, User as UserIcon, Brain, Users } from 'lucide-react';
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
    <div className="flex-1 min-h-[calc(100vh-160px)] flex flex-col justify-center items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full">
      {/* Brand Hero Header */}
      <div className="text-center mb-8 max-w-2xl mx-auto">
        <div className="relative inline-flex items-center justify-center mb-3">
          <div className="absolute inset-0 bg-sky-400/20 rounded-full blur-xl scale-125"></div>
          <img
            src="/logo.png"
            alt="PharmacyGuard Shield Logo"
            className="relative w-20 h-20 sm:w-22 sm:h-22 object-contain drop-shadow-md hover:scale-105 transition-transform"
          />
        </div>
        <h2
          aria-label="PharmacyGuard Workstation"
          className="text-3xl sm:text-4xl font-black tracking-tight leading-none flex items-center justify-center"
        >
          <span className="text-sky-500">PHARMACY</span><span className="text-blue-700 dark:text-blue-400">GUARD</span>
          <span className="text-slate-800 dark:text-white font-extrabold ml-2 text-2xl sm:text-3xl">Workstation</span>
        </h2>
        <p className="mt-2 text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 tracking-wide">
          AI Clinical Verification Agent
        </p>
        <div className="w-12 h-0.5 bg-sky-500 mx-auto my-2 rounded-full"></div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
          For Pharmacists &amp; Pharmacy Students
        </p>

        {/* 3 Core Pillars on a single line */}
        <div className="flex items-center justify-center gap-3 sm:gap-6 mt-4 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap overflow-x-auto">
          <div className="flex items-center space-x-1.5 shrink-0">
            <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0" />
            <span className="whitespace-nowrap">Safer Decisions</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Brain className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="whitespace-nowrap">AI-Powered Verification</span>
          </div>
          <span className="text-slate-300 dark:text-slate-700 shrink-0">·</span>
          <div className="flex items-center space-x-1.5 shrink-0">
            <Users className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">Human In the Loop</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, Role Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-stretch w-full">
        {/* Left column: Manual Credentials Sign-In */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Sign In with Account
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
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
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Workstation Username
                </label>
                <div className="relative rounded-md shadow-2xs">
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
                    className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Password
                </label>
                <div className="relative rounded-md shadow-2xs">
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
                    className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading && activeSubmittingRole === null}
                className="w-full mt-2 font-semibold shadow-2xs"
              >
                Sign In to Workstation
              </Button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1 text-center">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
              API Route: POST /api/v1/auth/login · JWT Bearer
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              Role-Based Access Control · Non-Authoritative Advisory
            </span>
          </div>
        </div>

        {/* Right column: 1-Click Demo Profiles */}
        <div className="lg:col-span-7 space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-850 p-3 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Live Demo Workstation Profiles
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Click any profile to instantly authenticate into authorized clinical workflows.
              </p>
            </div>
            <span className="inline-flex items-center space-x-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap shrink-0 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Real API Auth</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 flex-1">
            {demoRolesConfig.map((item) => {
              const Icon = item.icon;
              const creds = DEMO_CREDENTIALS[item.role];
              const isCardSubmitting = isLoading && activeSubmittingRole === item.role;

              return (
                <div
                  key={item.role}
                  className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 sm:p-4.5 transition-all shadow-2xs hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${item.borderColor}`}
                >
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                        Username: <span className="text-slate-800 dark:text-slate-200 font-semibold">{creds.username}</span>
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
                      className="w-full sm:w-auto font-semibold whitespace-nowrap shrink-0 shadow-2xs"
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

