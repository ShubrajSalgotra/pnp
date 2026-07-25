import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Camera,
  Crown,
  ExternalLink,
  LogOut,
  Moon,
  RefreshCw,
  Sun,
  User,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Badge } from '../components/ui/Badge';

const roleLabel: Record<string, string> = {
  child: 'Player',
  parent: 'Parent',
  coach: 'Coach',
  admin: 'Admin',
};

const ProfilePage: React.FC = () => {
  const { currentUser, updateAvatar, updateDisplayName, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [chessProfile, setChessProfile] = useState<PlayerAnalysisProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(currentUser?.displayName || '');
  }, [currentUser?.displayName]);

  useEffect(() => {
    let isMounted = true;

    const loadChessProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const profile = await profileAnalysisService.loadProfile(currentUser?.id);
        if (isMounted) setChessProfile(profile);
      } catch (loadError) {
        console.error('Could not load chess profile:', loadError);
        if (isMounted) setChessProfile(null);
      } finally {
        if (isMounted) setIsLoadingProfile(false);
      }
    };

    void loadChessProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingAvatar(true);
    setError(null);
    setMessage(null);
    try {
      await updateAvatar(file);
      setMessage('Profile picture updated.');
    } catch (avatarError) {
      setError(avatarError instanceof Error ? avatarError.message : 'Could not update profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveDisplayName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim() || displayName.trim() === currentUser?.displayName) return;

    setIsSavingName(true);
    setError(null);
    setMessage(null);
    try {
      await updateDisplayName(displayName);
      setMessage('Display name saved.');
    } catch (nameError) {
      setError(nameError instanceof Error ? nameError.message : 'Could not update display name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.');
    }
  };

  if (!currentUser) return null;

  const chessAccountUrl = chessProfile
    ? chessProfile.platform === 'chess.com'
      ? `https://www.chess.com/member/${encodeURIComponent(chessProfile.username)}`
      : `https://lichess.org/@/${encodeURIComponent(chessProfile.username)}`
    : null;

  return (
    <div className="section-shell space-y-8 py-8 sm:space-y-10 sm:py-10">
      <section className="aurora-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">
          Account
        </p>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={isUploadingAvatar}
              aria-label="Change profile picture"
              className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-soft transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait dark:border-slate-700 sm:h-24 sm:w-24"
            >
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-100 dark:bg-primary-500/20">
                  <User className="h-8 w-8 text-primary-700 dark:text-primary-300" />
                </div>
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="h-4 w-4" />
                <span className="text-[10px] font-medium">
                  {isUploadingAvatar ? '…' : 'Edit'}
                </span>
              </span>
            </button>
            <div>
              <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-white">
                {currentUser.displayName}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{currentUser.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary-200 text-primary-800 dark:border-slate-600 dark:text-primary-200">
                  {roleLabel[currentUser.role] || currentUser.role}
                </Badge>
                {currentUser.isPremium ? (
                  <Badge className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-800 dark:text-amber-200">
                    <Crown className="h-3 w-3" />
                    Premium
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-300">
                    Free plan
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        {(message || error) && (
          <p
            className={`mt-4 text-sm ${
              error ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {error || message}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="aurora-subtle">
          <CardHeader>
            <CardTitle className="font-display text-xl">Profile</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              How you appear across Pawnsposes.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveDisplayName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  maxLength={60}
                  className="dark:border-slate-600 dark:bg-slate-900/60 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={currentUser.email}
                  disabled
                  className="dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={roleLabel[currentUser.role] || currentUser.role}
                  disabled
                  className="dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                />
              </div>
              <Button
                type="submit"
                disabled={
                  isSavingName ||
                  !displayName.trim() ||
                  displayName.trim() === currentUser.displayName
                }
                className="cursor-pointer"
              >
                {isSavingName ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save profile'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="aurora-subtle">
          <CardHeader>
            <CardTitle className="font-display text-xl">Appearance</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Theme preference syncs with your account.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-primary-200/70 bg-white/70 px-4 py-3 text-left transition hover:bg-primary-50/70 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800/70"
            >
              <span className="inline-flex items-center text-sm font-medium text-slate-800 dark:text-slate-100">
                {isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {isDark ? 'Light mode' : 'Dark mode'}
              </span>
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  isDark ? 'bg-primary-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    isDark ? 'left-4' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              Current theme: {isDark ? 'Dark' : 'Light'}
            </p>
          </CardContent>
        </Card>

        <Card className="aurora-subtle">
          <CardHeader>
            <CardTitle className="font-display text-xl">Chess account</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Connected platform used for games, reports, and puzzles.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingProfile ? (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading chess account…
              </div>
            ) : chessProfile ? (
              <>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                      Platform
                    </div>
                    <div className="mt-1 font-semibold capitalize text-slate-900 dark:text-white">
                      {chessProfile.platform}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                      Username
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {chessProfile.username}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                      Games synced
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {chessProfile.games?.length ?? 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                      Last sync
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {chessProfile.lastCheckedAt
                        ? new Date(chessProfile.lastCheckedAt).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chessAccountUrl && (
                    <a
                      href={chessAccountUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                    >
                      <Button type="button" variant="outline" size="sm" className="cursor-pointer">
                        View on {chessProfile.platform === 'chess.com' ? 'Chess.com' : 'Lichess'}
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                  >
                    Manage sync on dashboard
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  No chess account connected yet. Connect Chess.com or Lichess to unlock reports,
                  weakness puzzles, and live ratings.
                </p>
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => navigate('/dashboard')}
                >
                  Connect chess account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="aurora-subtle">
          <CardHeader>
            <CardTitle className="font-display text-xl">Plan & session</CardTitle>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Membership and sign-out controls.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-primary-200/70 bg-white/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="text-xs uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                Current plan
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="font-semibold text-slate-900 dark:text-white">
                  {currentUser.isPremium ? 'Premium' : 'Free'}
                </span>
                {!currentUser.isPremium && (
                  <Link
                    to="/premium"
                    className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-3">
                <span>Member since</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {currentUser.createdAt
                    ? new Date(currentUser.createdAt).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="w-full cursor-pointer border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;
