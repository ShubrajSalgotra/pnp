import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Puzzle,
  Sun,
  Swords,
  Target,
  Trophy,
  User,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DefaultAvatar } from '../DefaultAvatar';

export const MobileNavigation: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Close drawer on path changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Analyze', href: '/analyze', icon: Swords },
    { name: 'Practice', href: '/practice', icon: Target },
    { name: 'Puzzles', href: '/puzzles', icon: Puzzle },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Study', href: '/study', icon: GraduationCap },
    { name: 'Reports', href: '/reports', icon: FileText },
  ];

  const coachItems = [
    { name: 'Coach Tools', href: '/coach', icon: Briefcase },
    { name: 'Students', href: '/students', icon: Users },
  ];

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/95">
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <img
          src="/pnp_logo.jpeg"
          alt="Pawnposes"
          className="h-8 w-8 rounded-lg object-cover ring-1 ring-primary-500/20"
        />
        <span className="font-display text-base font-bold text-slate-900 dark:text-white">
          Pawnposes
        </span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Open mobile navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-2xl dark:bg-slate-950 animate-in slide-in-from-left duration-250">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pnp_logo.jpeg"
                  alt="Pawnposes"
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-primary-500/20"
                />
                <div className="flex flex-col">
                  <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Pawnposes
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-600 dark:text-emerald-400">
                    Student Arena
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Links list */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              <div className="space-y-1">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Navigation
                </p>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-primary-600/10 text-primary-800 font-semibold border border-primary-500/20 dark:bg-primary-500/20 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive
                            ? 'text-primary-600 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-400'
                        }`}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>

              {currentUser?.role === 'coach' && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-emerald-400">
                    Coaching
                  </p>
                  {coachItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-primary-600/10 text-primary-800 font-semibold dark:bg-primary-500/20 dark:text-emerald-300'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5 text-slate-400" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User profile drawer footer */}
            {currentUser && (
              <div className="border-t border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.displayName || 'User'}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-primary-500/20"
                    />
                  ) : (
                    <DefaultAvatar className="h-10 w-10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {currentUser.displayName}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.email}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link
                    to="/profile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <User className="h-3.5 w-3.5" />
                    Profile
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
