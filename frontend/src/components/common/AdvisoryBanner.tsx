import React from 'react';
import { Info } from 'lucide-react';

export const AdvisoryBanner: React.FC = () => {
  return (
    <div
      role="note"
      aria-label="Clinical Demonstration Disclaimer"
      className="bg-gradient-to-r from-sky-50/90 via-slate-50 to-sky-50/90 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 text-slate-700 dark:text-slate-300 border-b border-sky-100 dark:border-slate-800 px-4 py-1.5 text-[11px] flex items-center justify-between select-none"
    >
      <div className="flex items-center space-x-2 overflow-hidden">
        <div className="p-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 shrink-0">
          <Info className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        <span className="font-semibold tracking-wide text-sky-950 dark:text-sky-200 shrink-0 font-sans">
          DEMONSTRATION PROTOTYPE ONLY:
        </span>
        <span className="truncate text-slate-600 dark:text-slate-400 font-sans">
          Advisory deterministic rule engine with synthetic clinical data. Not for clinical or diagnostic medication dispensing.
        </span>
      </div>
      <div className="hidden sm:flex items-center space-x-2 shrink-0 ml-4 font-mono">
        <span className="text-[10px] uppercase tracking-wider font-semibold border border-sky-200 dark:border-sky-800 bg-sky-100/60 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full shadow-2xs">
          Deterministic Engine · v0.1
        </span>
      </div>
    </div>
  );
};

