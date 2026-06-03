import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';
import {
  ChevronDown,
  Crown,
  LogOut,
  Menu,
  Settings,
  User,
  X
} from 'lucide-react';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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
    { name: 'Reports', href: '/reports' },
  ];

  const coachNavigation = [
    { name: 'Coach Tools', href: '/coach' },
    { name: 'Students', href: '/students' },
  ];

  const navLinkClass = 'border-transparent text-gray-600 hover:border-gold-500 hover:text-primary-800 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors';
  const mobileLinkClass = 'border-transparent text-gray-600 hover:bg-primary-50 hover:border-gold-500 hover:text-primary-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium';

  return (
    <nav className="sticky top-0 z-40 border-b border-primary-900/10 bg-white/90 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link to="/" className="flex items-center space-x-3">
                <img
                  src="/pnp_logo.jpeg"
                  alt="Pawnsposes logo"
                  className="h-10 w-10 rounded-lg object-cover shadow-sm ring-1 ring-primary-900/10"
                />
                <span className="text-xl font-bold text-primary-900">Pawnsposes</span>
              </Link>
            </div>

            {currentUser && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link key={item.name} to={item.href} className={navLinkClass}>
                    {item.name}
                  </Link>
                ))}

                {currentUser.role === 'coach' && coachNavigation.map((item) => (
                  <Link key={item.name} to={item.href} className={navLinkClass}>
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {currentUser ? (
              <div className="flex items-center space-x-4">
                {currentUser.isPremium && (
                  <div className="flex items-center space-x-1 rounded-full bg-gold-100 px-2 py-1 text-xs font-medium text-gold-800">
                    <Crown className="h-3 w-3" />
                    <span>Premium</span>
                  </div>
                )}

                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center space-x-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                      <User className="h-4 w-4 text-primary-600" />
                    </div>
                    <span className="text-gray-700">{currentUser.displayName}</span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 z-50 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                      <div className="py-1">
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Link>
                        <Link
                          to="/settings"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
                        {!currentUser.isPremium && (
                          <Link
                            to="/premium"
                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <Crown className="mr-2 h-4 w-4" />
                            Upgrade to Premium
                          </Link>
                        )}
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden">
          <div className="space-y-1 pb-3 pt-2">
            {currentUser ? (
              <>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={mobileLinkClass}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}

                {currentUser.role === 'coach' && coachNavigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={mobileLinkClass}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}

                <div className="border-t border-primary-900/10 pb-3 pt-4">
                  <div className="flex items-center px-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                      <User className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="ml-3 min-w-0">
                      <div className="truncate text-base font-medium text-gray-800">{currentUser.displayName}</div>
                      <div className="truncate text-sm font-medium text-gray-500">{currentUser.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-800"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-base font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-800"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Link
                  to="/login"
                  className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="block px-4 py-2 text-base font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-800"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
