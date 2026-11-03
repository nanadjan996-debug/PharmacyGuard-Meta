import React, { useState } from 'react';
import { ShieldCheck, Activity, Award, GraduationCap, AlertCircle, ArrowRight, Lock, User as UserIcon, Brain, Users, Sparkles } from 'lucide-react';
import { useAuth, DEMO_CREDENTIALS } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { UserRole } from '../../types/api';

const demoRolesConfig: Array<{
  role: UserRole;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  accentBg: string;
  accentText: string;
  badgeStyle: string;
  borderStyle: string;
}> = [
  {
    role: 'staff_pharmacist',
    title: 'Staff Pharmacist',
    badge: 'Clinical Verification',
    icon: Activity,
    description: 'Review queued prescriptions, inspect deterministic engine safety findings, submit ACCEPT, OVERRIDE, or ESCALATE.',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    badgeStyle: 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderStyle: 'border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/80 hover:shadow-emerald-500/5',
  },
  {
    role: 'chief_pharmacist',
    title: 'Chief Pharmacist',
    badge: 'Oversight & Resolution',
    icon: Award,
    description: 'Resolve escalated HIGH-risk prescriptions, inspect inventory deficit alerts, adjust minimum reorder thresholds.',
    accentBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    accentText: 'text-indigo-700 dark:text-indigo-300',
    badgeStyle: 'bg-indigo-100/80 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    borderStyle: 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/80 hover:shadow-indigo-500/5',
  },
  {
    role: 'pharmacy_student',
    title: 'Pharmacy Student',
    badge: 'Educational Simulation',
    icon: GraduationCap,
    description: 'Engage with simulated synthetic patient cases, document clinical reasoning, receive objective rubric scoring.',
    accentBg: 'bg-amber-50 dark:bg-amber-950/60',
    accentText: 'text-amber-700 dark:text-amber-300',
    badgeStyle: 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderStyle: 'border-slate-200/90 dark:border-slate-800 hover:border-amber-500/80 hover:shadow-amber-500/5',
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
      {/* Centered Brand Hero */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-3xl bg-gradient-to-b from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 border border-sky-100/80 dark:border-slate-700 shadow-sm">
            <img
              src="/logo.png"
              alt="PharmacyGuard Shield Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-md hover:scale-105 transition-transform"
            />
          </div>
        </div>

        <h2
          aria-label="PharmacyGuard Workstation"
          className="text-3xl sm:text-4xl font-black tracking-tight leading-none flex items-center justify-center flex-wrap"
        >
          <span className="text-sky-500">PHARMACY</span>
          <span className="text-blue-700 dark:text-blue-400">GUARD</span>
          <span className="text-slate-900 dark:text-white font-extrabold ml-2 text-2xl sm:text-3xl">Workstation</span>
        </h2>

        <p className="mt-2.5 text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 tracking-wide">
          AI Clinical Verification Agent
        </p>
        <div className="w-16 h-1 bg-gradient-to-r from-sky-400 to-blue-600 mx-auto my-2.5 rounded-full"></div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
          For Pharmacists &amp; Pharmacy Students
        </p>

        {/* 3 Core Pills - Guaranteed single-line pills without wrapping breaks */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 max-w-xl mx-auto">
          <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800/80 text-xs font-semibold text-sky-800 dark:text-sky-300 whitespace-nowrap shrink-0 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <span>Safer Decisions</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/80 text-xs font-semibold text-indigo-800 dark:text-indigo-300 whitespace-nowrap shrink-0 shadow-2xs">
            <Brain className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>AI-Powered Verification</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/80 text-xs font-semibold text-emerald-800 dark:text-emerald-300 whitespace-nowrap shrink-0 shadow-2xs">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Human-in-the-Loop</span>
          </span>
        </div>
      </div>

      {/* Main Section: 1-Click Role Selection Cards (Balanced 3-Column Grid) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left bg-gradient-to-r from-slate-50 via-white to-sky-50/30 dark:from-slate-900 dark:to-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Live Demo Workstation Profiles
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Select an authorized clinical role below to instantly authenticate through the backend API with pre-seeded accounts.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 whitespace-nowrap shrink-0 shadow-2xs">
            Real API Auth
          </span>
        </div>

        {/* 3 Balanced Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {demoRolesConfig.map((item) => {
            const Icon = item.icon;
            const creds = DEMO_CREDENTIALS[item.role];
            const isCardSubmitting = isLoading && activeSubmittingRole === item.role;

            return (
              <div
                key={item.role}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 sm:p-6 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between ${item.borderStyle}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className={`p-2.5 rounded-xl ${item.accentBg} ${item.accentText} shrink-0 shadow-2xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${item.badgeStyle}`}>
                      {item.badge}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium min-h-[56px]">
                    {item.description}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500 dark:text-slate-400">Account:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {creds.username}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-1">
                  <Button
                    variant="secondary"
                    size="md"
                    isLoading={isCardSubmitting}
                    disabled={isLoading}
                    onClick={() => handleQuickDemoLogin(item.role)}
                    icon={<ArrowRight className="w-4 h-4 shrink-0" />}
                    iconPosition="right"
                    className="w-full font-semibold shadow-2xs whitespace-nowrap"
                  >
                    Authenticate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Centered Manual Credentials Sign-In Section */}
      <div className="mt-8 max-w-xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xs">
          <div className="text-center mb-5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Sign In with Account
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Enter custom credentials to access your specific authorized workstation workspace.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start space-x-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Authentication Error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Workstation Username
                </label>
                <div className="relative rounded-lg shadow-2xs">
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
                    className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors font-medium"
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
                <div className="relative rounded-lg shadow-2xs">
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
                    className="block w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-colors font-medium"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading && activeSubmittingRole === null}
              className="w-full mt-2 font-semibold shadow-xs whitespace-nowrap"
            >
              Sign In to Workstation
            </Button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 text-center font-mono">
            API Route: POST /api/v1/auth/login · JWT Bearer
          </div>
        </div>
      </div>
    </div>
  );
};
