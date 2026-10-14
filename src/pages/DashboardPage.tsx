import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileText,
  Gamepad2,
  GraduationCap,
  Medal,
  Puzzle,
  RefreshCw,
  SearchX,
  Swords,
  Target,
  TrendingUp,
} from 'lucide-react';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { userDataService } from '../services/userDataService';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { GameReportRequest, ReportGenerationProgress } from '../types/report';
import ReportPopup from '../components/ReportPopup';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { persistSelectedGame } from '../utils/selectedGame';
import { ChessGame } from '../types/game';

const isCustomAvatar = (url?: string | null) => Boolean(url?.startsWith('data:'));

const DashboardPage: React.FC = () => {
  const { currentUser, updateAvatar, setAvatarUrl } = useAuth();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<PlayerAnalysisProfile | null>(null);
  const [platform, setPlatform] = useState<'lichess' | 'chess.com'>('lichess');
  const [username, setUsername] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<ReportGenerationProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isReportPopupOpen, setIsReportPopupOpen] = useState(false);
  const [chessAvatarUrl, setChessAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [liveRatings, setLiveRatings] = useState<{
    rapid: number | null;
    bullet: number | null;
    blitz: number | null;
    puzzle: number | null;
  }>({ rapid: null, bullet: null, blitz: null, puzzle: null });

  useEffect(() => {
    let isMounted = true;

    profileAnalysisService
      .loadProfile(currentUser?.id)
      .then((savedProfile) => {
        if (!isMounted) return;
        setProfile(savedProfile);
        if (savedProfile) {
          setPlatform(savedProfile.platform);
          setUsername(savedProfile.username);
        }
        setIsLoadingProfile(false);
      })
      .catch((loadError) => {
        console.error('Error loading dashboard profile:', loadError);
        if (isMounted) {
          setError('Could not load your saved analysis profile.');
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const report = profile?.report || null;

  useEffect(() => {
    let isMounted = true;

    const loadChessAvatar = async () => {
      if (!profile?.username || profile.platform !== 'chess.com') {
        setChessAvatarUrl(null);
        return;
      }

      try {
        const response = await fetch(`https://api.chess.com/pub/player/${profile.username}`);
        if (!response.ok) {
          if (isMounted) setChessAvatarUrl(null);
          return;
        }
        const data = await response.json();
        if (isMounted) {
          setChessAvatarUrl(typeof data?.avatar === 'string' ? data.avatar : null);
        }
      } catch (avatarError) {
        console.error('Could not load chess.com avatar:', avatarError);
        if (isMounted) {
          setChessAvatarUrl(null);
        }
      }
    };

    loadChessAvatar();

    return () => {
      isMounted = false;
    };
  }, [profile?.platform, profile?.username]);

  // Pull live ratings from Chess.com / Lichess so "Current Rapid" is the real rating
  useEffect(() => {
    let isMounted = true;
    const emptyRatings = { rapid: null, bullet: null, blitz: null, puzzle: null };

    const chessComPuzzleRating = (
      tactics:
        | {
            last?: { rating?: number };
            highest?: { rating?: number };
            lowest?: { rating?: number };
          }
        | undefined
    ): number | null => {
      const last = tactics?.last?.rating;
      const highest = tactics?.highest?.rating;
      const lowest = tactics?.lowest?.rating;
      const unusedDefault = highest === 400 && lowest === 400;
      if (typeof last === 'number' && last > 0) return Math.round(last);
      if (!unusedDefault && typeof highest === 'number' && highest > 0) return Math.round(highest);
      if (!unusedDefault && typeof lowest === 'number' && lowest > 0) return Math.round(lowest);
      return null;
    };

    const loadLiveRatings = async () => {
      if (!profile?.username) {
        if (isMounted) setLiveRatings(emptyRatings);
        return;
      }

      try {
        if (profile.platform === 'chess.com') {
          const response = await fetch(
            `https://api.chess.com/pub/player/${encodeURIComponent(profile.username)}/stats`
          );
          if (!response.ok) {
            if (isMounted) setLiveRatings(emptyRatings);
            return;
          }
          const data = await response.json();
          if (!isMounted) return;
          setLiveRatings({
            rapid:
              typeof data?.chess_rapid?.last?.rating === 'number'
                ? data.chess_rapid.last.rating
                : null,
            bullet:
              typeof data?.chess_bullet?.last?.rating === 'number'
                ? data.chess_bullet.last.rating
                : null,
            blitz:
              typeof data?.chess_blitz?.last?.rating === 'number'
                ? data.chess_blitz.last.rating
                : null,
            puzzle: chessComPuzzleRating(data?.tactics),
          });
          return;
        }

        const response = await fetch(
          `https://lichess.org/api/user/${encodeURIComponent(profile.username)}`
        );
        if (!response.ok) {
          if (isMounted) setLiveRatings(emptyRatings);
          return;
        }
        const data = await response.json();
        if (!isMounted) return;
        const puzzle = data?.perfs?.puzzle?.rating;
        setLiveRatings({
          rapid: typeof data?.perfs?.rapid?.rating === 'number' ? data.perfs.rapid.rating : null,
          bullet: typeof data?.perfs?.bullet?.rating === 'number' ? data.perfs.bullet.rating : null,
          blitz: typeof data?.perfs?.blitz?.rating === 'number' ? data.perfs.blitz.rating : null,
          puzzle: typeof puzzle === 'number' && puzzle > 0 ? Math.round(puzzle) : null,
        });
      } catch (ratingsError) {
        console.error('Could not load live ratings:', ratingsError);
        if (isMounted) setLiveRatings(emptyRatings);
      }
    };

    loadLiveRatings();

    return () => {
      isMounted = false;
    };
  }, [profile?.platform, profile?.username]);

  useEffect(() => {
    if (!chessAvatarUrl || !currentUser?.id) return;
    if (isCustomAvatar(currentUser.avatarUrl)) return;
    if (currentUser.avatarUrl === chessAvatarUrl) return;
    void setAvatarUrl(chessAvatarUrl);
  }, [chessAvatarUrl, currentUser?.id, currentUser?.avatarUrl, setAvatarUrl]);

  const displayAvatarUrl = isCustomAvatar(currentUser?.avatarUrl)
    ? currentUser?.avatarUrl
    : chessAvatarUrl || currentUser?.avatarUrl || null;

  const handleAvatarClick = () => {
    if (isUploadingAvatar) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploadingAvatar(true);
    setError(null);
    try {
      await updateAvatar(file);
      setMessage('Profile picture updated.');
    } catch (avatarError) {
      setError(
        avatarError instanceof Error ? avatarError.message : 'Could not update profile picture.'
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const userGames = useMemo(() => profile?.games || [], [profile?.games]);

  const getIsUserWhite = (game: any) => {
    if (!profile?.username) return true;
    return game.white?.name?.trim().toLowerCase() === profile.username.trim().toLowerCase();
  };

  const getUserRating = (game: any) => {
    return getIsUserWhite(game) ? game.white?.rating : game.black?.rating;
  };

  const getOpponentRating = (game: any) => {
    return getIsUserWhite(game) ? game.black?.rating : game.white?.rating;
  };

  const getOpponentName = (game: any) => {
    const opponent = getIsUserWhite(game) ? game.black?.name : game.white?.name;
    if (!opponent || opponent === 'Unknown') return 'Opponent';
    return opponent;
  };

  const getGameResult = (game: any) => {
    if (game.result === '1/2-1/2') return 'Draw';
    const userWhite = getIsUserWhite(game);
    const isWin = (userWhite && game.result === '1-0') || (!userWhite && game.result === '0-1');
    return isWin ? 'Win' : 'Loss';
  };

  const wins = userGames.filter((game) => getGameResult(game) === 'Win').length;
  const draws = userGames.filter((game) => getGameResult(game) === 'Draw').length;
  const losses = userGames.filter((game) => getGameResult(game) === 'Loss').length;

  const classifyTimeControl = (timeControl?: string): 'bullet' | 'blitz' | 'rapid' | 'other' => {
    if (!timeControl) return 'other';
    const normalized = timeControl.toLowerCase().trim();
    if (normalized.includes('bullet')) return 'bullet';
    if (normalized.includes('blitz')) return 'blitz';
    if (normalized.includes('rapid')) return 'rapid';

    const plusMatch = normalized.match(/(\d+)\+(\d+)/);
    const baseMatch = normalized.match(/^(\d+)$/);
    if (!plusMatch && !baseMatch) return 'other';

    let base = plusMatch ? parseInt(plusMatch[1], 10) : parseInt(baseMatch![1], 10);
    const increment = plusMatch ? parseInt(plusMatch[2], 10) : 0;
    if (Number.isNaN(base)) return 'other';

    const baseMinutes = base >= 60 ? base / 60 : base;
    const incrementSeconds = increment;
    const estimatedMinutes = baseMinutes + (40 * incrementSeconds) / 60;

    if (estimatedMinutes < 3) return 'bullet';
    if (estimatedMinutes < 10) return 'blitz';
    if (estimatedMinutes < 60) return 'rapid';
    return 'other';
  };

  const gamesByNewest = useMemo(() => {
    return [...userGames].sort((a, b) => {
      const aTime = Date.parse(a.date) || 0;
      const bTime = Date.parse(b.date) || 0;
      return bTime - aTime;
    });
  }, [userGames]);

  const ratingFromRecentGames = (kind: 'bullet' | 'blitz' | 'rapid') => {
    const match = gamesByNewest.find(
      (game) =>
        classifyTimeControl(game.timeControl) === kind && typeof getUserRating(game) === 'number'
    );
    return match ? getUserRating(match) ?? null : null;
  };

  const gameStats = {
    wins,
    draws,
    losses,
    rapidRating: liveRatings.rapid ?? ratingFromRecentGames('rapid'),
    bulletRating: liveRatings.bullet ?? ratingFromRecentGames('bullet'),
    blitzRating: liveRatings.blitz ?? ratingFromRecentGames('blitz'),
    puzzleRating: liveRatings.puzzle,
    winRate: userGames.length ? Math.round((wins / userGames.length) * 100) : 0,
  };

  // Persist dashboard stats to Firestore
  useEffect(() => {
    if (!currentUser?.id || !profile) return;

    void userDataService.saveStats({
      userId: currentUser.id,
      platform: profile.platform,
      username: profile.username,
      ratings: {
        rapid: gameStats.rapidRating,
        blitz: gameStats.blitzRating,
        bullet: gameStats.bulletRating,
        puzzle: gameStats.puzzleRating,
      },
      wins: gameStats.wins,
      losses: gameStats.losses,
      draws: gameStats.draws,
      winRate: gameStats.winRate,
      gamesCount: userGames.length,
      averageAccuracy: profile.report?.executiveSummary?.averageAccuracy ?? null,
      lastReportId: profile.report?.id ?? null,
      updatedAt: new Date().toISOString(),
    });
  }, [
    currentUser?.id,
    gameStats.blitzRating,
    gameStats.bulletRating,
    gameStats.draws,
    gameStats.losses,
    gameStats.puzzleRating,
    gameStats.rapidRating,
    gameStats.winRate,
    gameStats.wins,
    profile,
    userGames.length,
  ]);

  const saveAndAnalyze = async (request: GameReportRequest) => {
    if (!currentUser?.id || !request.username.trim()) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress({
      stage: 'fetching',
      message: 'Starting report…',
      progress: 3,
    });
    profileAnalysisService.setProgressCallback(setProgress);

    try {
      const username = request.username.trim();
      const needsNewProfile =
        !profile ||
        profile.username.trim().toLowerCase() !== username.toLowerCase() ||
        profile.platform !== request.platform;

      const result = needsNewProfile
        ? await profileAnalysisService.setupProfile({
            userId: currentUser.id,
            platform: request.platform,
            username,
            gameCount: request.gameCount,
            rated: request.rated,
            allGames: false,
            generateReport: true,
          })
        : await profileAnalysisService.generateProfileReport(currentUser.id, {
            gameCount: request.gameCount,
            rated: request.rated,
          });

      setProfile(result.profile);
      setPlatform(result.profile.platform);
      setUsername(result.profile.username);
      setMessage(
        `Report ready · analyzed ${result.profile.report?.gameCount ?? request.gameCount} games` +
          (result.newGamesCount > 0
            ? ` · synced ${result.newGamesCount} new game${result.newGamesCount === 1 ? '' : 's'}`
            : '')
      );
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not generate report.');
    } finally {
      setProgress(null);
      setIsRefreshing(false);
    }
  };

  const refreshAnalysis = async () => {
    if (!currentUser?.id) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress({
      stage: 'fetching',
      message: 'Importing your full chess game history…',
      progress: 15,
    });
    profileAnalysisService.setProgressCallback(setProgress);

    try {
      const result = await profileAnalysisService.refreshProfile(currentUser.id);
      setProfile(result.profile);
      const total = result.profile.games.length;
      setMessage(
        total === 0
          ? 'No games found for this account.'
          : result.newGamesCount === 0
          ? `Archive up to date · ${total} game${total === 1 ? '' : 's'} stored.`
          : `Synced ${result.newGamesCount} new game${
              result.newGamesCount === 1 ? '' : 's'
            } · ${total} total now stored.`
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh games.');
    } finally {
      setProgress(null);
      setIsRefreshing(false);
    }
  };

  const quickActions = [
    {
      title: 'Start Practice',
      description: 'Face rated challenges adapted to your level',
      href: '/practice',
      icon: Target,
      color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
      borderHover: 'hover:border-emerald-500/40',
      badge: 'Interactive',
    },
    {
      title: 'Solve Puzzles',
      description: 'Tactical problems mined from critical game moments',
      href: '/puzzles',
      icon: Puzzle,
      color: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
      borderHover: 'hover:border-sky-500/40',
      badge: 'Tactics',
    },
    {
      title: 'Analyze Opponents',
      description: 'Scout rival tendencies, prep openings, and exploit flaws',
      href: '/analyze',
      icon: Swords,
      color: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
      borderHover: 'hover:border-amber-500/40',
      badge: 'Scouting',
    },
    {
      title: 'Continue Study',
      description: 'Interactive curriculum of master games and key plans',
      href: '/study',
      icon: GraduationCap,
      color: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
      borderHover: 'hover:border-purple-500/40',
      badge: 'Lessons',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Welcome & Profile Cockpit */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4 sm:gap-5 min-w-0">
            {/* Avatar with click-to-upload */}
            <div className="relative shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                aria-label="Change profile photo"
                title="Click to change photo"
                className="group relative h-16 w-16 sm:h-20 sm:w-20 cursor-pointer overflow-hidden rounded-2xl ring-2 ring-primary-500/20 shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                {displayAvatarUrl ? (
                  <img
                    src={displayAvatarUrl}
                    alt="Player avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <DefaultAvatar className="h-full w-full" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-[10px] font-semibold mt-0.5">
                    {isUploadingAvatar ? 'Saving…' : 'Edit'}
                  </span>
                </div>
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-emerald-400">
                  Student Command Center
                </span>
                {profile?.platform && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {profile.platform} · @{profile.username}
                  </span>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                Welcome back, {currentUser?.displayName || 'Player'}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                Review your current ratings, monitor game archives, and jump directly into focused training.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {profile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refreshAnalysis}
                disabled={isRefreshing}
                className="cursor-pointer border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Sync Games
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setIsReportPopupOpen(true)}
              disabled={isRefreshing}
              className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white"
            >
              <FileText className="mr-2 h-4 w-4" />
              {report ? 'Update Account / Report' : 'Connect Chess Account'}
            </Button>
          </div>
        </div>

        {/* Sync progress */}
        {progress && (
          <div className="mt-5 max-w-xl rounded-xl border border-primary-200/80 bg-primary-50/60 p-3 dark:border-primary-900/40 dark:bg-primary-950/20">
            <div className="flex items-center justify-between text-xs font-semibold text-primary-800 dark:text-emerald-300 mb-1.5">
              <span>{progress.message}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-primary-200/80 dark:bg-slate-700">
              <div
                className="h-2 rounded-full bg-primary-600 dark:bg-emerald-400 transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Feedback messages */}
        {message && (
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200/80 dark:border-rose-900/40">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Loading Skeleton */}
      {isLoadingProfile && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-4 h-8 w-16" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
          ))}
        </div>
      )}

      {/* Rating & Performance KPI Cards */}
      {!isLoadingProfile && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Rapid Rating"
            value={gameStats.rapidRating ? gameStats.rapidRating.toLocaleString() : '—'}
            change={liveRatings.rapid != null ? 'Live account rating' : 'From recent games'}
            icon={<TrendingUp className="h-5 w-5" />}
            iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          />
          <StatCard
            title="Blitz Rating"
            value={gameStats.blitzRating ? gameStats.blitzRating.toLocaleString() : '—'}
            change={liveRatings.blitz != null ? 'Live blitz rating' : 'Most recent blitz'}
            icon={<Medal className="h-5 w-5" />}
            iconBg="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          />
          <StatCard
            title="Puzzle Rating"
            value={gameStats.puzzleRating ? gameStats.puzzleRating.toLocaleString() : '—'}
            change={
              liveRatings.puzzle != null
                ? profile?.platform === 'chess.com'
                  ? 'Tactics rating'
                  : 'Lichess puzzle rating'
                : 'Puzzles completed'
            }
            icon={<Puzzle className="h-5 w-5" />}
            iconBg="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          />
          <StatCard
            title="Games Tracked"
            value={userGames.length.toString()}
            change={
              profile?.lastCheckedAt
                ? `Synced ${new Date(profile.lastCheckedAt).toLocaleDateString()}`
                : 'Connect account to sync'
            }
            icon={<Gamepad2 className="h-5 w-5" />}
            iconBg="bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400"
          />
        </section>
      )}

      {/* Quick Actions Grid */}
      <section className="space-y-4">
        <SectionHeader
          title="Quick Actions"
          description="Continue your personalized training across key chess disciplines"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                type="button"
                onClick={() => navigate(action.href)}
                className={`group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 ${action.borderHover} cursor-pointer`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {action.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {action.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-primary-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Enter</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Game Record & Win/Draw/Loss Summary */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
        <SectionHeader
          title="Game Record & Performance"
          description="Aggregated results across your connected chess archives"
        />

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="rounded-xl bg-emerald-50/70 p-4 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Wins
            </span>
            <p className="mt-2 font-display text-3xl font-bold text-emerald-900 dark:text-emerald-200 tabular-nums">
              {gameStats.wins}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/70 dark:bg-slate-800/40 dark:border-slate-700/60">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Draws
            </span>
            <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {gameStats.draws}
            </p>
          </div>

          <div className="rounded-xl bg-rose-50/70 p-4 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
              Losses
            </span>
            <p className="mt-2 font-display text-3xl font-bold text-rose-900 dark:text-rose-200 tabular-nums">
              {gameStats.losses}
            </p>
          </div>

          <div className="rounded-xl bg-primary-50/60 p-4 border border-primary-100 dark:bg-primary-950/20 dark:border-primary-900/30 flex flex-col justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-800 dark:text-emerald-300">
              Win Rate
            </span>
            <div>
              <p className="font-display text-3xl font-bold text-primary-900 dark:text-emerald-200 tabular-nums">
                {gameStats.winRate}%
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-primary-200/70 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-primary-600 dark:bg-emerald-400"
                  style={{ width: `${gameStats.winRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Previous Games Archive */}
      <section className="space-y-4">
        <SectionHeader
          title="Recent Games Archive"
          description="Interactive game history from your connected account, newest first"
        />

        {userGames.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No games synced yet"
            description="Connect your Chess.com or Lichess account to automatically pull your full history and analyze your play."
            className="border-dashed"
            action={
              <Button onClick={() => setIsReportPopupOpen(true)} className="cursor-pointer bg-primary-600 text-white">
                Connect Account
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {userGames.slice(0, 18).map((game: any) => {
              const result = getGameResult(game);
              const opponent = getOpponentName(game);
              const userRating = getUserRating(game);
              const opponentRating = getOpponentRating(game);
              const openingName =
                game.opening?.name && game.opening.name !== 'Unknown'
                  ? game.opening.name
                  : null;
              const timeControl =
                game.timeControl && game.timeControl !== 'Unknown'
                  ? game.timeControl
                  : null;

              const resultBadgeClass =
                result === 'Win'
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-300/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                  : result === 'Loss'
                  ? 'bg-rose-50 text-rose-800 ring-rose-300/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                  : 'bg-slate-100 text-slate-700 ring-slate-300/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';

              const accentColor =
                result === 'Win'
                  ? 'bg-emerald-500'
                  : result === 'Loss'
                  ? 'bg-rose-500'
                  : 'bg-slate-400';

              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => {
                    persistSelectedGame(game as ChessGame);
                    navigate(`/game/${encodeURIComponent(game.id)}`, { state: { game } });
                  }}
                  className="group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 pl-6 text-left shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${accentColor}`} aria-hidden />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          {game.date}
                        </span>
                        {timeControl && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {timeControl}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 truncate font-display text-base font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors">
                        vs {opponent}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${resultBadgeClass}`}
                    >
                      {result}
                    </span>
                  </div>

                  {openingName && (
                    <p className="mt-1.5 truncate text-xs text-slate-600 dark:text-slate-400">
                      {openingName}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">You</span>
                      <p className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {userRating ? userRating.toLocaleString() : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Opponent</span>
                      <p className="font-bold text-slate-900 dark:text-white tabular-nums">
                        {opponentRating ? opponentRating.toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sync/Report Modal */}
      <ReportPopup
        isOpen={isReportPopupOpen}
        onClose={() => setIsReportPopupOpen(false)}
        report={report}
        initialPlatform={platform}
        initialUsername={username}
        onSaveAndAnalyze={saveAndAnalyze}
        isRefreshing={isRefreshing}
        progress={progress}
        message={message}
        error={error}
      />
    </div>
  );
};

export default DashboardPage;
