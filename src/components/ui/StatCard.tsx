import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  iconBg = 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-emerald-400',
  subtitle,
  className = '',
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
          {title}
        </p>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {value}
        </p>
      </div>

      {(change || subtitle) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <span className="truncate">{change || subtitle}</span>
        </div>
      )}
    </div>
  );
};
