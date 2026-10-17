import React from 'react';

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  kicker,
  title,
  description,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200/80 dark:border-slate-800/80 ${className}`}>
      <div className="space-y-1.5 min-w-0">
        {kicker && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-emerald-400">
              {kicker}
            </span>
            {badge}
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-3 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
};
