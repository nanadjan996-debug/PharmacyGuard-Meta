import React from 'react';
import { FindingSeverity } from '../../types/api';

export interface SeverityBadgeProps {
  severity: FindingSeverity | string;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

interface SeverityConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

const severityConfigs: Record<string, SeverityConfig> = {
  HIGH: {
    label: 'HIGH SEVERITY',
    badgeClass: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 font-bold',
    dotClass: 'bg-red-600 animate-pulse',
  },
  MODERATE: {
    label: 'MODERATE',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-semibold',
    dotClass: 'bg-amber-500',
  },
  LOW: {
    label: 'LOW',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800 font-medium',
    dotClass: 'bg-sky-500',
  },
  INFO: {
    label: 'INFO',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 font-medium',
    dotClass: 'bg-slate-400',
  },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  className = '',
  showIcon = true,
}) => {
  const normalizedKey = (severity || 'INFO').toUpperCase();
  const config = severityConfigs[normalizedKey] || severityConfigs.INFO;

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px] tracking-wide gap-1.5' : 'px-2.5 py-1 text-xs tracking-wider gap-2';

  return (
    <span
      className={`inline-flex items-center uppercase border rounded-md select-none ${config.badgeClass} ${sizeClasses} ${className}`}
    >
      {showIcon && (
        <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} aria-hidden="true" />
      )}
      <span>{config.label}</span>
    </span>
  );
};

