import React from 'react';

export type SkeletonType = 'table' | 'card' | 'text' | 'stat-card';

export interface SkeletonLoaderProps {
  type?: SkeletonType;
  count?: number;
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  count = 3,
  className = '',
}) => {
  if (type === 'table') {
    return (
      <div className={`w-full divide-y divide-slate-200 dark:divide-slate-800 animate-pulse ${className}`} role="status" aria-label="Loading data">
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded mb-2" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="py-3 flex items-center justify-between space-x-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/6" />
            <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-full w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'stat-card') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse ${className}`} role="status" aria-label="Loading statistics">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-3" />
            <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`space-y-4 animate-pulse ${className}`} role="status" aria-label="Loading card content">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // Default 'text'
  return (
    <div className={`space-y-2.5 animate-pulse ${className}`} role="status" aria-label="Loading text content">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded"
          style={{ width: `${Math.max(40, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
};

