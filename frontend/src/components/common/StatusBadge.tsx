import React from 'react';

export type AnyStatus =
  | 'pending'
  | 'reviewed'
  | 'overridden'
  | 'escalated'
  | 'resolved'
  | 'IN_STOCK'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | string;

export interface StatusBadgeProps {
  status: AnyStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  // Prescription workflow statuses
  pending: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  reviewed: {
    label: 'Accepted',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  overridden: {
    label: 'Overridden',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    dotClass: 'bg-purple-500',
  },
  escalated: {
    label: 'Escalated to Chief',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
    dotClass: 'bg-orange-500 animate-pulse',
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    dotClass: 'bg-blue-500',
  },

  // Inventory statuses
  IN_STOCK: {
    label: 'In Stock',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  LOW_STOCK: {
    label: 'Low Stock Alert',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500 animate-pulse',
  },
  OUT_OF_STOCK: {
    label: 'Out of Stock',
    badgeClass: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
    dotClass: 'bg-red-500',
  },

  // Educational simulation statuses
  COMPLETED: {
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  NOT_ATTEMPTED: {
    label: 'Not Attempted',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const normalizedKey = status ? String(status).trim() : 'unknown';
  const config = statusConfigs[normalizedKey] || {
    label: normalizedKey.replace(/_/g, ' '),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  };

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full select-none ${config.badgeClass} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

