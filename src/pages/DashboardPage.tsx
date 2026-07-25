import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { 
  CalendarDays,
  Camera,
  Gamepad2,
  Medal,
  Puzzle,
  TrendingUp, 
  RefreshCw,
  AlertCircle,
  FileText,
  SearchX
} from 'lucide-react';
import { profileAnalysisService } from '../services/profileAnalysisService';
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

    profileAnalysisService.loadProfile(currentUser?.id).then(savedProfile => {
      if (!isMounted) return;
      setProfile(savedProfile);
      if (savedProfile) {
        setPlatform(savedProfile.platform);
        setUsername(savedProfile.username);
      }
      setIsLoadingProfile(false);
    }).catch(loadError => {
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

  // Pull live ratings from Chess.com / Lichess so "Current Rapid" is the real rating,
  // not inferred from a misclassified time-control string in the archive.
  useEffect(() => {
    let isMounted = true;
    const emptyRatings = { rapid: null, bullet: null, blitz: null, puzzle: null };

    const chessComPuzzleRating = (tactics: {
      last?: { rating?: number };
      highest?: { rating?: number };
      lowest?: { rating?: number };
    } | undefined): number | null => {
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
            rapid: typeof data?.chess_rapid?.last?.rating === 'number' ? data.chess_rapid.last.rating : null,
            bullet: typeof data?.chess_bullet?.last?.rating === 'number' ? data.chess_bullet.last.rating : null,
            blitz: typeof data?.chess_blitz?.last?.rating === 'number' ? data.chess_blitz.last.rating : null,
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

  // Keep navbar in sync with the chess.com avatar when the user hasn't set a custom photo.
  useEffect(() => {
    if (!chessAvatarUrl || !currentUser?.id) return;
    if (isCustomAvatar(currentUser.avatarUrl)) return;
    if (currentUser.avatarUrl === chessAvatarUrl) return;
    void setAvatarUrl(chessAvatarUrl);
  }, [chessAvatarUrl, currentUser?.id, currentUser?.avatarUrl, setAvatarUrl]);

  const displayAvatarUrl = isCustomAvatar(currentUser?.avatarUrl)
    ? currentUser?.avatarUrl
    : (chessAvatarUrl || currentUser?.avatarUrl || null);

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
      setError(avatarError instanceof Error ? avatarError.message : 'Could not update profile picture.');
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

  const wins = userGames.filter(game => getGameResult(game) === 'Win').length;
  const draws = userGames.filter(game => getGameResult(game) === 'Draw').length;
  const losses = userGames.filter(game => getGameResult(game) === 'Loss').length;

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

    // Archives store minutes after parseTime (e.g. 600+0 → "10+0").
    // Raw API/PGN values can still be seconds (e.g. "600+0").
    const baseMinutes = base >= 60 ? base / 60 : base;
    const incrementSeconds = increment;
    // Chess.com estimated duration: base + 40 × increment.
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
      (game) => classifyTimeControl(game.timeControl) === kind && typeof getUserRating(game) === 'number'
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

  const stats = [
    {
      title: 'Games Tracked',
      value: userGames.length.toString(),
      change: profile?.lastCheckedAt ? `Synced ${new Date(profile.lastCheckedAt).toLocaleDateString()}` : 'Add your chess username',
      icon: <Gamepad2 className="w-5 h-5" />,
      color: 'text-primary-600 dark:text-primary-300'
    },
    {
      title: 'Current Rapid Rating',
      value: gameStats.rapidRating ? gameStats.rapidRating.toLocaleString() : '-',
      change: liveRatings.rapid != null ? 'Live from your chess account' : 'Most recent rapid game',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-emerald-600 dark:text-emerald-300'
    },
    {
      title: 'Current Bullet Rating',
      value: gameStats.bulletRating ? gameStats.bulletRating.toLocaleString() : '-',
      change: liveRatings.bullet != null ? 'Live from your chess account' : 'Most recent bullet game',
      icon: <Medal className="w-5 h-5" />,
      color: 'text-amber-600 dark:text-amber-300'
    },
    {
      title: 'Puzzle Rating',
      value: gameStats.puzzleRating ? gameStats.puzzleRating.toLocaleString() : '-',
      change:
        liveRatings.puzzle != null
          ? profile?.platform === 'chess.com'
            ? 'Live from Chess.com tactics'
            : 'Live from Lichess puzzles'
          : 'Connect an account with puzzle history',
      icon: <Puzzle className="w-5 h-5" />,
      color: 'text-cyan-600 dark:text-cyan-300'
    }
  ];

  const saveAndAnalyze = async (request: GameReportRequest) => {
    if (!currentUser?.id || !request.username.trim()) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress(null);
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
            allGames: request.allGames,
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
          (result.newGamesCount > 0 ? ` · synced ${result.newGamesCount} new game${result.newGamesCount === 1 ? '' : 's'}` : '')
      );
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not generate report.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshAnalysis = async () => {
    if (!currentUser?.id) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress(null);

    try {
      const result = await profileAnalysisService.refreshProfile(currentUser.id);
      setProfile(result.profile);
      setMessage(
        result.reusedCache || result.newGamesCount === 0
          ? 'No new games found. Your archive is up to date.'
          : `Synced ${result.newGamesCount} new game${result.newGamesCount === 1 ? '' : 's'}. Generate a report when you want an updated analysis.`
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh games.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const DashboardSkeleton = () => (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-4">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="surface-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-4 h-3 w-32" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="section-shell space-y-12 py-10 sm:space-y-14 sm:py-12">
      <section className="aurora-panel pb-2">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_auto] lg:items-center lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">Player cockpit</p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl dark:text-white">
              {currentUser?.displayName}, your chess command center
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300">
              Track performance, sync game archives, and jump straight into training decisions without switching contexts.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {profile && (
                <Button type="button" variant="outline" onClick={refreshAnalysis} disabled={isRefreshing} className="cursor-pointer border-primary-200/80 bg-white/70 text-slate-800 hover:bg-white dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100 dark:hover:bg-slate-800">
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh games
                </Button>
              )}
              <Button type="button" onClick={() => setIsReportPopupOpen(true)} disabled={isRefreshing} className="cursor-pointer bg-primary-600 text-white hover:bg-primary-700">
                <FileText className="mr-2 h-4 w-4" />
                {report ? 'Open / update report' : 'Connect chess account'}
              </Button>
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              {profile?.lastCheckedAt
                ? `Last sync: ${new Date(profile.lastCheckedAt).toLocaleString()}`
                : 'No sync yet.'}
            </p>
            {progress && (
              <div className="mt-4 max-w-xl">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>{progress.message}</span>
                  <span>{progress.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-primary-100/80 dark:bg-slate-700">
                  <div className="h-2 rounded-full bg-primary-600 transition-all" style={{ width: `${progress.progress}%` }} />
                </div>
              </div>
            )}
            {message && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
            {error && (
              <p className="mt-4 flex items-center text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="mr-2 h-4 w-4" />
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-4 text-center lg:items-end lg:text-right">
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
              aria-label="Change profile picture"
              className="group relative h-32 w-32 cursor-pointer overflow-hidden rounded-full border-4 border-white shadow-soft transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait sm:h-36 sm:w-36 dark:border-slate-700"
            >
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt="Player avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                <DefaultAvatar className="h-full w-full bg-gradient-to-b from-primary-100 to-primary-200 text-primary-800 ring-0 dark:from-primary-500/30 dark:to-primary-500/15 dark:text-primary-200" />
              )}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-950/55 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="h-5 w-5" />
                <span className="text-xs font-medium">
                  {isUploadingAvatar ? 'Updating…' : 'Change'}
                </span>
              </span>
            </button>
            <div className="text-sm leading-6 text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">{profile?.username || currentUser?.displayName}</span>
              {profile ? ` · ${profile.platform}` : ''}
            </div>
          </div>
        </div>
      </section>

      {isLoadingProfile && (
        <Card className="border-primary-200 bg-primary-50 dark:border-slate-700 dark:bg-slate-900/60">
          <CardContent className="flex items-center gap-3 p-6 text-primary-900 dark:text-slate-100">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-medium">Loading your chess profile</p>
              <p className="mt-1 text-sm text-primary-700 dark:text-slate-300">Syncing your full game history from supported APIs.</p>
            </div>
          </CardContent>
        </Card>
      )}
      {isLoadingProfile && <DashboardSkeleton />}

      <section className="aurora-panel border-t border-primary-200/60 pt-10 dark:border-slate-700/80">
        <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0">
        {stats.map((stat, index) => (
          <div key={index} className="xl:border-r xl:border-primary-200/60 xl:px-6 xl:last:border-r-0 xl:first:pl-0 dark:xl:border-slate-700/80">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">{stat.title}</p>
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white">{stat.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{stat.change}</p>
          </div>
        ))}
        </div>
      </section>

      <section className="aurora-subtle border-t border-primary-200/60 pt-10 dark:border-slate-700/80">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">Game Record</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Wins, draws, and losses pulled directly from your chess game archives.</p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
          <div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">Wins</p>
            <p className="mt-2 font-display text-3xl font-semibold text-emerald-900 sm:text-4xl dark:text-emerald-200">{gameStats.wins}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Draws</p>
            <p className="mt-2 font-display text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white">{gameStats.draws}</p>
          </div>
          <div>
            <p className="text-sm text-rose-700 dark:text-rose-300">Losses</p>
            <p className="mt-2 font-display text-3xl font-semibold text-rose-900 sm:text-4xl dark:text-rose-200">{gameStats.losses}</p>
          </div>
        </div>
        <div className="mt-8 text-sm text-slate-700 dark:text-slate-300">
          Win rate: <span className="font-semibold text-slate-900 dark:text-white">{gameStats.winRate}%</span>
        </div>
      </section>

      <section className="border-t border-primary-200/60 pt-10 dark:border-slate-700/80">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">All Previous Games</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Recent games from your chess archive, newest first.</p>
        </div>
          {userGames.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No games synced yet"
              description="Connect your chess username from the report form to pull your latest archive and unlock personalized insights."
              className="border-dashed"
              action={
                <Button onClick={() => setIsReportPopupOpen(true)} className="cursor-pointer">
                  Open Report Form
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {userGames.map((game: any) => {
                const result = getGameResult(game);
                const opponent = getOpponentName(game);
                const userRating = getUserRating(game);
                const opponentRating = getOpponentRating(game);
                const openingName = game.opening?.name && game.opening.name !== 'Unknown'
                  ? game.opening.name
                  : null;
                const timeControl = game.timeControl && game.timeControl !== 'Unknown'
                  ? game.timeControl
                  : null;
                const accentClass = result === 'Win'
                  ? 'bg-emerald-500'
                  : result === 'Loss'
                    ? 'bg-rose-500'
                    : 'bg-slate-400 dark:bg-slate-500';
                const resultBadgeClass = result === 'Win'
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                  : result === 'Loss'
                    ? 'bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                    : 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600';

                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => {
                      persistSelectedGame(game as ChessGame);
                      navigate(`/game/${encodeURIComponent(game.id)}`, { state: { game } });
                    }}
                    className="game-card flex h-full w-full cursor-pointer flex-col pl-6 text-left transition hover:-translate-y-0.5 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    <span className={`game-card-accent ${accentClass}`} aria-hidden />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {game.date}
                          </span>
                          {timeControl && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {timeControl}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 truncate font-display text-lg font-semibold text-slate-900 dark:text-white">
                          vs {opponent}
                        </h3>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${resultBadgeClass}`}>
                        {result}
                      </span>
                    </div>

                    {openingName && (
                      <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-300">
                        {openingName}
                      </p>
                    )}

                    <div className="mt-auto grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">You</p>
                        <p className="mt-1 font-display text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                          {userRating ? userRating.toLocaleString() : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Opp</p>
                        <p className="mt-1 font-display text-base font-semibold tabular-nums text-slate-900 dark:text-white">
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
