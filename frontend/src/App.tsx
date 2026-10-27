import React, { useState } from 'react';
import { ShieldAlert, Activity, BookOpen, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  const [activeRole, setActiveRole] = useState<'staff' | 'chief' | 'student'>('staff');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Advisory Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-medium">DEMONSTRATION PROTOTYPE ONLY:</span>
          <span>Synthetic data only. Advisory deterministic rule engine. Not clinically validated or for production medication dispensing.</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold border border-amber-500/30 px-2 py-0.5 rounded">
          Rule-Based Engine
        </span>
      </div>

      {/* Main Navigation Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">PharmacyGuard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Prescription Verification & Operational Decision Support</p>
          </div>
        </div>

        {/* Role Workspace Switcher Preview for Milestone 1 */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveRole('staff')}
            className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeRole === 'staff'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Staff Pharmacist</span>
          </button>
          <button
            onClick={() => setActiveRole('chief')}
            className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeRole === 'chief'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Chief Pharmacist</span>
          </button>
          <button
            onClick={() => setActiveRole('student')}
            className={`px-3 py-1.5 rounded-md flex items-center space-x-1.5 transition-colors ${
              activeRole === 'student'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Student Mode</span>
          </button>
        </div>
      </header>

      {/* Main Scaffold Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Milestone 1 Scaffold Initialized</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              PharmacyGuard Rebuild Scaffold
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-6">
              Full-stack hospital pharmacy prescription-verification prototype scaffold. Architecture configured with deterministic rule verification engine, role-based workflows (Staff Pharmacist, Chief Pharmacist, Student), and SQLite persistence.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Frontend Stack</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">React 19 + TypeScript</p>
                <p className="text-xs text-slate-500 mt-0.5">Vite + Tailwind CSS</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Backend Stack</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">FastAPI + Python 3.14</p>
                <p className="text-xs text-slate-500 mt-0.5">SQLAlchemy 2.x + Pydantic v2</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active Workspace</span>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 capitalize">{activeRole} Workspace</p>
                <p className="text-xs text-slate-500 mt-0.5">Ready for Milestone 2 Models</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <div>PharmacyGuard Rebuild — Meta Global AI Developer Hackathon Submission Prototype</div>
        <div>Advisory Deterministic Rule Engine • No Unchecked AI Dispensing</div>
      </footer>
    </div>
  );
};

export default App;
