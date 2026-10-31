import React from 'react';
import { Info } from 'lucide-react';

export const AdvisoryBanner: React.FC = () => {
  return (
    <div
      role="note"
      aria-label="Clinical Demonstration Disclaimer"
      className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 text-[11px] font-mono flex items-center justify-between select-none"
    >
      <div className="flex items-center space-x-2 overflow-hidden">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
        <span className="font-semibold tracking-wide text-slate-900 dark:text-slate-200 shrink-0">
          DEMONSTRATION PROTOTYPE ONLY:
        </span>
        <span className="truncate text-slate-600 dark:text-slate-400">
          Advisory deterministic rule engine with synthetic clinical data. Not for clinical or diagnostic medication dispensing.
        </span>
      </div>
      <div className="hidden sm:flex items-center space-x-2 shrink-0 ml-4">
        <span className="text-[10px] uppercase tracking-wider font-semibold border border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
          Deterministic Engine · v0.1
        </span>
      </div>
    </div>
  );
};

