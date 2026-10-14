import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronUp, Crown, LogOut, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DefaultAvatar } from '../DefaultAvatar';

interface UserProfileMenuProps {
  isCollapsed: boolean;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ isCollapsed }) => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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

  if (!currentUser) return null;

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User profile menu"
        className={`group w-full flex items-center gap-3 rounded-xl p-2 text-left transition-colors duration-200 cursor-pointer outline-none hover:bg-slate-100/90 dark:hover:bg-slate-800/80 focus-visible:ring-2 focus-visible:ring-primary-500 ${
          isOpen ? 'bg-slate-100 dark:bg-slate-800/80' : ''
        } ${isCollapsed ? 'justify-center p-2' : ''}`}
      >
        <div className="relative shrink-0">
          {currentUser.avatarUrl ? (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.displayName || 'User'}
              className="h-9 w-9 rounded-full object-cover ring-2 ring-primary-500/20 dark:ring-emerald-400/20"
            />
          ) : (
            <DefaultAvatar className="h-9 w-9" />
          )}
          {currentUser.isPremium && (
            <span
              title="Premium Member"
              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-white shadow"
            >
              <Crown className="h-2.5 w-2.5" />
            </span>
          )}
        </div>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {currentUser.displayName || 'Student'}
              </span>
              {currentUser.isPremium && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  PRO
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentUser.email}
            </p>
          </div>
        )}

        {!isCollapsed && (
          <ChevronUp
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 dark:text-slate-500 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {/* Flyout Menu */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 mb-2 w-64 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95 animate-in fade-in zoom-in-95 duration-150 ${
            isCollapsed
              ? 'left-full bottom-0 ml-3'
              : 'bottom-full left-0 right-0'
          }`}
        >
          {/* User info preview in popover */}
          <div className="border-b border-slate-100 p-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-emerald-400">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
              {currentUser.displayName}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentUser.email}
            </p>
          </div>

          <div className="space-y-1 p-1">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Profile & Settings</span>
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                toggleTheme();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                {isDark ? (
                  <Sun className="h-4 w-4 text-amber-500" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-500" />
                )}
                <span>{isDark ? 'Light theme' : 'Dark theme'}</span>
              </span>
              <span
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  isDark ? 'bg-primary-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 shadow-sm ${
                    isDark ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </span>
            </button>

            {!currentUser.isPremium && (
              <Link
                to="/premium"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
              >
                <Crown className="h-4 w-4 text-amber-500" />
                <span>Upgrade to Premium</span>
              </Link>
            )}

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
