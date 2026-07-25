import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  ArrowRight,
  ChevronDown,
  Crown,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
  X
} from 'lucide-react';
import { DefaultAvatar } from './DefaultAvatar';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isLandingPage = location.pathname === '/' && !currentUser;

  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Analyze', href: '/analyze' },
    { name: 'Puzzles', href: '/puzzles' },
  ];

  const coachNavigation = [
    { name: 'Coach Tools', href: '/coach' },
    { name: 'Students', href: '/students' },
  ];

  const getNavClassName = (href: string) => {
    const isActive = location.pathname === href;
    return [
      'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
      isActive
        ? 'bg-primary-100 text-primary-900 shadow-[inset_0_1px_0_rgba(18,56,38,0.06)] dark:bg-primary-500/25 dark:text-primary-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
        : 'text-slate-600 hover:bg-primary-50 hover:text-primary-900 dark:text-white/75 dark:hover:bg-primary-500/15 dark:hover:text-white',
    ].join(' ');
  };

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="pointer-events-auto mx-auto w-full max-w-4xl">
        <div className="rounded-full border border-slate-200 bg-white/90 px-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
          <div className="flex h-12 items-center justify-between gap-2 sm:h-14 sm:gap-4 sm:px-1">
            <Link to="/" className="group flex min-w-0 shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition">
              <img
                src="/pnp_logo.jpeg"
                alt="Pawnsposes logo"
                className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 sm:h-9 sm:w-9"
              />
              <span className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-white sm:text-base">
                Pawnsposes
              </span>
            </Link>

            {currentUser && (
              <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 sm:flex">
                {navigation.map((item) => (
                  <Link key={item.name} to={item.href} className={getNavClassName(item.href)}>
                    {item.name}
                  </Link>
                ))}
                {currentUser.role === 'coach' && coachNavigation.map((item) => (
                  <Link key={item.name} to={item.href} className={getNavClassName(item.href)}>
                    {item.name}
                  </Link>
                ))}
              </div>
            )}

            <div className="flex shrink-0 items-center justify-end gap-2">
              {currentUser ? (
                <div className="relative hidden sm:block">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-transparent py-1 pl-1 pr-2.5 text-sm text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/25 dark:text-white dark:hover:bg-white/10 dark:focus:ring-white/30"
                  >
                    {currentUser.avatarUrl ? (
                      <img
                        src={currentUser.avatarUrl}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20"
                      />
                    ) : (
                      <DefaultAvatar className="h-7 w-7" />
                    )}
                    <span className="max-w-[7.5rem] truncate font-medium">{currentUser.displayName}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 dark:text-white/70" />
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 z-50 mt-3 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:shadow-black/40">
                      <div className="space-y-1">
                        {currentUser.isPremium && (
                          <div className="mb-1 flex items-center gap-1 rounded-xl bg-gold-100/15 px-3 py-2 text-xs font-semibold text-gold-600 dark:text-gold-200">
                            <Crown className="h-3 w-3" />
                            Premium
                          </div>
                        )}
                        <Link
                          to="/profile"
                          className="flex items-center rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/10"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Profile & settings
                        </Link>
                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/10"
                        >
                          <span className="inline-flex items-center">
                            {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                            {isDark ? 'Light mode' : 'Dark mode'}
                          </span>
                          <span className={`relative h-5 w-9 rounded-full transition ${isDark ? 'bg-primary-500' : 'bg-slate-300'}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${isDark ? 'left-4' : 'left-0.5'}`} />
                          </span>
                        </button>
                        {!currentUser.isPremium && (
                          <Link
                            to="/premium"
                            className="flex items-center rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/10"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <Crown className="mr-2 h-4 w-4" />
                            Upgrade to Premium
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-white/85 dark:hover:bg-white/10"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  {!isLandingPage && (
                    <Link
                      to="/login"
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      Sign in
                    </Link>
                  )}
                  <Link
                    to="/register"
                    className="inline-flex items-center rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-white/30 dark:text-white dark:hover:bg-white/10"
                  >
                    Get Started
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-white/25 dark:text-white dark:hover:bg-white/10 dark:focus:ring-white/30 sm:hidden"
                aria-label="Toggle navigation"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="mt-2 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-white/15 dark:bg-slate-950/90 dark:shadow-black/30 sm:hidden">
            <div className="space-y-1">
              {currentUser ? (
                <>
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`block rounded-xl px-3 py-2 text-base font-medium transition ${
                        location.pathname === item.href
                          ? 'bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}

                  {currentUser.role === 'coach' && coachNavigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`block rounded-xl px-3 py-2 text-base font-medium transition ${
                        location.pathname === item.href
                          ? 'bg-slate-900/10 text-slate-900 dark:bg-white/15 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-900/5 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {item.name}
                    </Link>
                  ))}

                  <div className="mt-3 border-t border-slate-100 pt-4 dark:border-white/10">
                    <div className="flex items-center rounded-2xl bg-slate-50 px-3 py-3 dark:bg-white/10">
                      {currentUser.avatarUrl ? (
                        <img
                          src={currentUser.avatarUrl}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20"
                        />
                      ) : (
                        <DefaultAvatar className="h-10 w-10" />
                      )}
                      <div className="ml-3 min-w-0">
                        <div className="truncate text-base font-medium text-slate-900 dark:text-white">{currentUser.displayName}</div>
                        <div className="truncate text-sm font-medium text-slate-500 dark:text-white/60">{currentUser.email}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <Link
                        to="/profile"
                        className="block rounded-lg px-3 py-2 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Profile & settings
                      </Link>
                      <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        <span className="inline-flex items-center">
                          {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                          {isDark ? 'Light mode' : 'Dark mode'}
                        </span>
                        <span className={`relative h-5 w-9 rounded-full transition ${isDark ? 'bg-primary-500' : 'bg-slate-300'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${isDark ? 'left-4' : 'left-0.5'}`} />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full rounded-lg px-3 py-2 text-left text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    className="block rounded-full border border-slate-200 px-4 py-3 text-center text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-white/25 dark:text-white dark:hover:bg-white/10"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block rounded-full bg-slate-900 px-4 py-3 text-center text-base font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
