import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Puzzle,
  Swords,
  Target,
  Trophy,
  Users,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SidebarNavItem } from './SidebarNavItem';
import { UserProfileMenu } from './UserProfileMenu';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
}) => {
  const { currentUser } = useAuth();

  const mainNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Analyze', href: '/analyze', icon: Swords },
    { name: 'Practice', href: '/practice', icon: Target },
    { name: 'Puzzles', href: '/puzzles', icon: Puzzle },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Study', href: '/study', icon: GraduationCap },
  ];

  const secondaryNavigation = [
    { name: 'Reports', href: '/reports', icon: FileText },
  ];

  const coachNavigation = [
    { name: 'Coach Tools', href: '/coach', icon: Briefcase },
    { name: 'Students', href: '/students', icon: Users },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-slate-200/90 bg-white/95 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/95 z-30 transition-[width] duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      aria-label="Student Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800/80">
        <Link
          to="/dashboard"
          className={`flex items-center gap-3 transition-opacity ${
            isCollapsed ? 'justify-center w-full' : ''
          }`}
          title="Pawnposes Dashboard"
        >
          <img
            src="/pnp_logo.jpeg"
            alt="Pawnposes"
            className="h-9 w-9 rounded-xl object-cover ring-2 ring-primary-500/20 shadow-sm"
          />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Pawnsposes 
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-emerald-400">
                Chess
              </span>
            </div>
          )}
        </Link>

        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation Links Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {/* Main Section */}
        <div className="space-y-1">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Learning Arena
            </p>
          )}
          {mainNavigation.map((item) => (
            <SidebarNavItem
              key={item.name}
              name={item.name}
              href={item.href}
              icon={item.icon}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Coach Navigation (if role === 'coach') */}
        {currentUser?.role === 'coach' && (
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/70">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-emerald-400">
                Coaching
              </p>
            )}
            {coachNavigation.map((item) => (
              <SidebarNavItem
                key={item.name}
                name={item.name}
                href={item.href}
                icon={item.icon}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}

        {/* Tools & Reports */}
        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/70">
          {!isCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Analytics
            </p>
          )}
          {secondaryNavigation.map((item) => (
            <SidebarNavItem
              key={item.name}
              name={item.name}
              href={item.href}
              icon={item.icon}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </div>

      {/* Collapse Expand control when collapsed */}
      {isCollapsed && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800/70 flex justify-center">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
        <UserProfileMenu isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
};
