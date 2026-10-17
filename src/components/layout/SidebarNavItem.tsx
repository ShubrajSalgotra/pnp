import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  isCollapsed: boolean;
  badge?: string | number;
  onClick?: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  name,
  href,
  icon: Icon,
  isCollapsed,
  badge,
  onClick,
}) => {
  const location = useLocation();
  const [showTooltip, setShowTooltip] = useState(false);

  // Match exact route or subroutes (except root /dashboard matching /)
  const isActive =
    location.pathname === href ||
    (href !== '/dashboard' && href !== '/' && location.pathname.startsWith(href));

  return (
    <div className="relative">
      <Link
        to={href}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`group relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          isActive
            ? 'bg-primary-600/10 text-primary-800 shadow-sm border border-primary-500/20 dark:bg-primary-500/20 dark:text-emerald-300 dark:border-primary-400/30 font-semibold'
            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
        } ${isCollapsed ? 'justify-center px-2.5' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <span
          className={`flex items-center justify-center transition-colors ${
            isActive
              ? 'text-primary-600 dark:text-emerald-400'
              : 'text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </span>

        {!isCollapsed && (
          <span className="truncate flex-1 tracking-tight">{name}</span>
        )}

        {!isCollapsed && badge !== undefined && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-800 dark:bg-primary-500/20 dark:text-emerald-300">
            {badge}
          </span>
        )}

        {/* Active side indicator */}
        {isActive && (
          <span
            className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary-600 dark:bg-emerald-400 ${
              isCollapsed ? 'hidden' : 'block'
            }`}
          />
        )}
      </Link>

      {/* Floating Tooltip when collapsed */}
      {isCollapsed && showTooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl ring-1 ring-white/10 dark:bg-slate-800 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-2">
            <span>{name}</span>
            {badge !== undefined && (
              <span className="rounded bg-primary-500/30 px-1.5 py-0.2 text-[10px] text-emerald-300">
                {badge}
              </span>
            )}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900 dark:border-r-slate-800" />
        </div>
      )}
    </div>
  );
};
