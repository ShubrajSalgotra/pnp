import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Plus, X } from 'lucide-react';
import { Button } from './ui/Button';
import ReportDisplay from './ReportDisplay';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { MatchupEdge, OpponentGameStats, OpponentScoutIntel } from '../types/opponentScout';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { reportService } from '../services/reportService';
import {
  buildMatchupEdge,
  computeOpponentGameStats,
  fetchOpponentLiveProfile,
} from '../utils/opponentStats';
import { buildScoutIntelFallback } from '../utils/scoutIntelFallback';
import { persistPracticeOpponent } from '../utils/practiceOpponent';

type DashboardTab = 'overview' | 'battle' | 'openings' | 'form' | 'report';

interface OpponentDashboardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  report: ChessReport | null;
  onAnalyze: (request: GameReportRequest) => Promise<void>;
  isAnalyzing: boolean;
  progress: ReportGenerationProgress | null;
  message: string | null;
  error: string | null;
  yourProfile: PlayerAnalysisProfile | null;
}

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'battle', label: 'Battle plan' },
  { id: 'openings', label: 'Openings' },
  { id: 'form', label: 'Form' },
  { id: 'report', label: 'Full report' },
];

const OpponentDashboardPopup: React.FC<OpponentDashboardPopupProps> = ({
  isOpen,
  onClose,
  report,
  onAnalyze,
  isAnalyzing,
  progress,
  message,
  error,
  yourProfile,
}) => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'form' | 'dashboard'>('dashboard');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const canPractice = Boolean(report?.rawGameData?.length);

  const startPractice = () => {
    if (!report?.rawGameData?.length) return;
    persistPracticeOpponent(report);
    onClose();
    navigate('/analyze/practice');
  };
  const [platform, setPlatform] = useState<'lichess' | 'chess.com'>('lichess');
  const [username, setUsername] = useState('');
  const [gameCount, setGameCount] = useState(20);
  const [ratedFilter, setRatedFilter] = useState<'all' | 'rated' | 'unrated'>('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);
  const [liveAvatar, setLiveAvatar] = useState<string | null>(null);
  const [liveRatings, setLiveRatings] = useState<{
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
    puzzle: number | null;
  }>({ rapid: null, blitz: null, bullet: null, puzzle: null });
  const [profileUrl, setProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!report) {
      setViewMode('form');
      setActiveTab('overview');
      setPlatform('lichess');
      setUsername('');
      setGameCount(20);
      setRatedFilter('all');
      setFormError(null);
      setValidationResult(null);
      setLiveAvatar(null);
      setLiveRatings({ rapid: null, blitz: null, bullet: null, puzzle: null });
      setProfileUrl(null);
      return;
    }

    setViewMode('dashboard');
    setActiveTab('overview');
    setPlatform(report.platform);
    setUsername(report.username);
    setGameCount(report.gameCount);
  }, [isOpen, report]);

  useEffect(() => {
    if (!isOpen || !report) return;
    let cancelled = false;
    fetchOpponentLiveProfile(report.platform, report.username).then((live) => {
      if (cancelled) return;
      setLiveAvatar(live.avatarUrl);
      setLiveRatings(live.ratings);
      setProfileUrl(live.url);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, report]);

  const stats = useMemo(() => {
    if (!report?.rawGameData?.length) return null;
    return computeOpponentGameStats(report.rawGameData, report.username);
  }, [report]);

  const scoutIntel = useMemo(() => {
    if (!report) return null;
    return report.scoutIntel || buildScoutIntelFallback(report);
  }, [report]);

  const matchup = useMemo(() => {
    if (!report) return null;
    return buildMatchupEdge(yourProfile, report);
  }, [report, yourProfile]);

  const estimatedTime = useMemo(() => reportService.estimateGenerationTime(gameCount), [gameCount]);

  const validateUsername = async () => {
    if (!username.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    setFormError(null);
    try {
      const isValid = await reportService.validateUserExists(platform, username.trim());
      setValidationResult(isValid);
      if (!isValid) setFormError(`User "${username.trim()}" not found on ${platform}`);
    } catch {
      setFormError('Failed to validate username');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim()) {
      setFormError('Please enter an opponent username.');
      return;
    }
    if (gameCount < 1 || gameCount > 100) {
      setFormError('Please choose between 1 and 100 games.');
      return;
    }
    setFormError(null);
    await onAnalyze({
      platform,
      username: username.trim(),
      gameCount,
      rated: ratedFilter === 'all' ? undefined : ratedFilter === 'rated',
    });
  };

  if (!isOpen) return null;

  const showDashboard = viewMode === 'dashboard' && !!report && !!scoutIntel;
  const fieldClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm dark:bg-black/70 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opponent-dossier-title"
        className="relative flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-[#F4F8F5] shadow-xl ring-1 ring-black/10 dark:bg-slate-950 dark:ring-white/10"
      >
        <header className="shrink-0 border-b border-primary-200/70 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-8 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex items-center gap-4">
              {showDashboard && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-primary-100 dark:bg-primary-500/20">
                  {liveAvatar ? (
                    <img src={liveAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-display text-lg font-semibold text-primary-800 dark:text-primary-200">
                      {report!.username.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
                  {showDashboard ? 'Opponent dossier' : 'Scout opponent'}
                </p>
                <h2
                  id="opponent-dossier-title"
                  className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  {showDashboard ? report!.username : 'New opponent'}
                </h2>
                {showDashboard && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {report!.platform}
                    <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                    {report!.gameCount} games
                    {(liveRatings.rapid || liveRatings.blitz) && (
                      <>
                        <span className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                        {[
                          liveRatings.rapid && `Rapid ${liveRatings.rapid}`,
                          liveRatings.blitz && `Blitz ${liveRatings.blitz}`,
                          liveRatings.bullet && `Bullet ${liveRatings.bullet}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {showDashboard && profileUrl && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white sm:inline-flex"
                >
                  Profile
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {showDashboard && canPractice && (
                <button
                  type="button"
                  onClick={startPractice}
                  className="inline-flex cursor-pointer items-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  Practice
                </button>
              )}
              {showDashboard && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('form');
                    setFormError(null);
                    setValidationResult(null);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {showDashboard && (
            <nav className="mt-5 flex gap-6 overflow-x-auto" aria-label="Dossier sections">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer whitespace-nowrap border-b-2 pb-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-slate-900 dark:border-primary-400 dark:text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          {viewMode === 'form' || !report ? (
            <FormView
              platform={platform}
              setPlatform={setPlatform}
              username={username}
              setUsername={setUsername}
              gameCount={gameCount}
              setGameCount={setGameCount}
              ratedFilter={ratedFilter}
              setRatedFilter={setRatedFilter}
              fieldClass={fieldClass}
              isAnalyzing={isAnalyzing}
              isValidating={isValidating}
              validationResult={validationResult}
              formError={formError}
              error={error}
              message={message}
              progress={progress}
              estimatedTime={estimatedTime}
              onValidate={validateUsername}
              onSubmit={handleSubmit}
              onCancel={() => {
                if (report) setViewMode('dashboard');
                else onClose();
              }}
              canCancelToDashboard={!!report}
            />
          ) : activeTab === 'overview' ? (
            <OverviewTab
              report={report}
              scoutIntel={scoutIntel!}
              stats={stats}
              matchup={matchup}
              canPractice={canPractice}
              onOpenBattle={() => setActiveTab('battle')}
              onPractice={startPractice}
            />
          ) : activeTab === 'battle' ? (
            <BattlePlanTab scoutIntel={scoutIntel!} matchup={matchup} />
          ) : activeTab === 'openings' ? (
            <OpeningsTab stats={stats} scoutIntel={scoutIntel!} />
          ) : activeTab === 'form' ? (
            <FormStatsTab stats={stats} report={report} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-primary-200/70 bg-white dark:border-slate-700 dark:bg-slate-900">
              <ReportDisplay report={report} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------- Form ---------- */

const FormView: React.FC<{
  platform: 'lichess' | 'chess.com';
  setPlatform: (v: 'lichess' | 'chess.com') => void;
  username: string;
  setUsername: (v: string) => void;
  gameCount: number;
  setGameCount: (v: number) => void;
  ratedFilter: 'all' | 'rated' | 'unrated';
  setRatedFilter: (v: 'all' | 'rated' | 'unrated') => void;
  fieldClass: string;
  isAnalyzing: boolean;
  isValidating: boolean;
  validationResult: boolean | null;
  formError: string | null;
  error: string | null;
  message: string | null;
  progress: ReportGenerationProgress | null;
  estimatedTime: number;
  onValidate: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  canCancelToDashboard: boolean;
}> = ({
  platform,
  setPlatform,
  username,
  setUsername,
  gameCount,
  setGameCount,
  ratedFilter,
  setRatedFilter,
  fieldClass,
  isAnalyzing,
  isValidating,
  validationResult,
  formError,
  error,
  message,
  progress,
  estimatedTime,
  onValidate,
  onSubmit,
  onCancel,
  canCancelToDashboard,
}) => (
  <div className="mx-auto max-w-lg">
    <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Scout an opponent</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
      Pull recent games and generate a battle plan, opening targets, and full analysis.
    </p>

    <div className="mt-8 space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">Platform</legend>
        <div className="flex gap-6">
          {(['lichess', 'chess.com'] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800 dark:text-slate-100">
              <input
                type="radio"
                name="opp-platform"
                value={value}
                checked={platform === value}
                onChange={() => setPlatform(value)}
                className="accent-primary-600"
                disabled={isAnalyzing}
              />
              {value === 'lichess' ? 'Lichess' : 'Chess.com'}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="opp-username" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Username
        </label>
        <div className="flex gap-2">
          <input
            id="opp-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Opponent username"
            className={`flex-1 ${fieldClass}`}
            disabled={isAnalyzing}
          />
          <Button
            type="button"
            variant="outline"
            onClick={onValidate}
            disabled={!username.trim() || isValidating || isAnalyzing}
            className="cursor-pointer"
          >
            {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
          </Button>
        </div>
        {validationResult === true && (
          <p className="mt-2 text-xs text-primary-700 dark:text-primary-300">Username found.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="opp-games" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Games
          </label>
          <input
            id="opp-games"
            type="number"
            min={1}
            max={100}
            value={gameCount}
            onChange={(e) => setGameCount(parseInt(e.target.value, 10) || 20)}
            className={fieldClass}
            disabled={isAnalyzing}
          />
        </div>
        <div>
          <label htmlFor="opp-rated" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Filter
          </label>
          <select
            id="opp-rated"
            value={ratedFilter}
            onChange={(e) => setRatedFilter(e.target.value as 'all' | 'rated' | 'unrated')}
            className={`h-[42px] ${fieldClass}`}
            disabled={isAnalyzing}
          >
            <option value="all">All</option>
            <option value="rated">Rated</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        About {Math.ceil(estimatedTime / 60)} min · recommended 20–50 games
      </p>

      {(formError || error) && (
        <p className="text-sm text-rose-700 dark:text-rose-300">{formError || error}</p>
      )}
      {message && <p className="text-sm text-primary-800 dark:text-primary-200">{message}</p>}

      {isAnalyzing && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-300 dark:bg-primary-400"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isAnalyzing || !username.trim() || validationResult === false}
          className="flex-1 cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            'Generate dossier'
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isAnalyzing} className="cursor-pointer">
          {canCancelToDashboard ? 'Back' : 'Cancel'}
        </Button>
      </div>
    </div>
  </div>
);

/* ---------- Overview (executive) ---------- */

const OverviewTab: React.FC<{
  report: ChessReport;
  scoutIntel: OpponentScoutIntel;
  stats: OpponentGameStats | null;
  matchup: MatchupEdge | null;
  canPractice: boolean;
  onOpenBattle: () => void;
  onPractice: () => void;
}> = ({ report, scoutIntel, stats, matchup, canPractice, onOpenBattle, onPractice }) => {
  const metrics = [
    {
      label: 'Win rate',
      value: `${stats?.overall.winRate ?? report.executiveSummary.winRate}%`,
      hint: stats
        ? `${stats.overall.wins}W · ${stats.overall.draws}D · ${stats.overall.losses}L`
        : `${report.gameCount} games`,
    },
    {
      label: 'White / Black',
      value: `${stats?.asWhite.winRate ?? '—'}% / ${stats?.asBlack.winRate ?? '—'}%`,
      hint: 'Win rate by color',
    },
    {
      label: 'Form',
      value: stats?.recentForm.slice(0, 6).join('') || '—',
      hint: stats ? `${stats.currentStreak.count}× ${stats.currentStreak.type} streak` : 'Recent results',
    },
    {
      label: 'Predictability',
      value: `${scoutIntel.predictabilityScore}`,
      hint: 'Higher = easier to prepare',
    },
  ];

  return (
    <div className="space-y-10">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
          Battle plan
        </p>
        <h3 className="mt-2 max-w-3xl font-display text-2xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          {scoutIntel.battlePlanHeadline}
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400">
          {scoutIntel.playingStyle.length > 220
            ? `${scoutIntel.playingStyle.slice(0, 220).trim()}…`
            : scoutIntel.playingStyle}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onOpenBattle}
            className="cursor-pointer text-sm font-semibold text-primary-700 transition-colors duration-200 hover:text-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Read full battle plan →
          </button>
          {canPractice && (
            <button
              type="button"
              onClick={onPractice}
              className="cursor-pointer text-sm font-semibold text-slate-700 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:text-white"
            >
              Practice vs their style →
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-8 border-y border-primary-200/70 py-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 dark:border-slate-700/80">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={`xl:px-6 ${index === 0 ? 'xl:pl-0' : ''} ${
              index < metrics.length - 1 ? 'xl:border-r xl:border-primary-200/70 dark:xl:border-slate-700/80' : ''
            }`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {metric.label}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {metric.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{metric.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-10 lg:grid-cols-2">
        <div>
          <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">How to beat them</h4>
          <ol className="mt-4 space-y-4">
            {scoutIntel.howToBeatThem.slice(0, 4).map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                <span className="font-display text-sm font-semibold text-primary-700 dark:text-primary-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Before the game</h4>
          <ol className="mt-4 space-y-3">
            {scoutIntel.preGameChecklist.slice(0, 5).map((item, i) => (
              <li key={i} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                <span className="mt-0.5 text-slate-400 dark:text-slate-500">{i + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {matchup && matchup.leveragePoints.length > 0 && (
        <section className="border-t border-primary-200/70 pt-8 dark:border-slate-700/80">
          <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Your edge</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">From your saved analysis profile</p>
          <ul className="mt-4 max-w-2xl space-y-2">
            {matchup.leveragePoints.map((item, i) => (
              <li key={i} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-primary-200/70 pt-8 dark:border-slate-700/80">
        <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Targets</h4>
        <div className="mt-4 divide-y divide-primary-100 dark:divide-slate-800">
          {report.recurringWeaknesses.slice(0, 3).map((w, i) => (
            <div key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{w.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{w.description}</p>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-500">{w.frequency}×</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ---------- Battle plan ---------- */

const BattlePlanTab: React.FC<{ scoutIntel: OpponentScoutIntel; matchup: MatchupEdge | null }> = ({
  scoutIntel,
  matchup,
}) => (
  <div className="mx-auto max-w-3xl space-y-10">
    <section>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
        Predictability {scoutIntel.predictabilityScore}/100
      </p>
      <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
        {scoutIntel.battlePlanHeadline}
      </h3>
      <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">{scoutIntel.playingStyle}</p>
    </section>

    <SectionList title="How to beat them" items={scoutIntel.howToBeatThem} numbered />
    <SectionList title="Your edges" items={scoutIntel.yourEdges} />
    <SectionList title="Danger zones" items={scoutIntel.dangerZones} />

    <section className="grid gap-10 border-t border-primary-200/70 pt-10 sm:grid-cols-2 dark:border-slate-700/80">
      <PrepBlock
        title="When they have White"
        recommendation={scoutIntel.prepVsTheirWhite.recommendation}
        why={scoutIntel.prepVsTheirWhite.why}
        ideas={scoutIntel.prepVsTheirWhite.keyIdeas}
      />
      <PrepBlock
        title="When they have Black"
        recommendation={scoutIntel.prepVsTheirBlack.recommendation}
        why={scoutIntel.prepVsTheirBlack.why}
        ideas={scoutIntel.prepVsTheirBlack.keyIdeas}
      />
    </section>

    <SectionList title="Over the board" items={scoutIntel.overTheBoardTips} />
    <SectionList title="Psychology" items={scoutIntel.psychologicalNotes} />
    <SectionList title="Pre-game checklist" items={scoutIntel.preGameChecklist} numbered />

    {matchup && (
      <section className="border-t border-primary-200/70 pt-10 dark:border-slate-700/80">
        <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Matchup</h4>
        <div className="mt-4 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Your strengths</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {matchup.yourStrengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Their targets</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {matchup.theirWeaknesses.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
        {matchup.cautionPoints.length > 0 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Caution</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {matchup.cautionPoints.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    )}
  </div>
);

/* ---------- Openings ---------- */

const OpeningsTab: React.FC<{ stats: OpponentGameStats | null; scoutIntel: OpponentScoutIntel }> = ({
  stats,
  scoutIntel,
}) => (
  <div className="space-y-10">
    <section className="grid gap-10 lg:grid-cols-2">
      <PrepBlock
        title="Prep vs their White"
        recommendation={scoutIntel.prepVsTheirWhite.recommendation}
        why={scoutIntel.prepVsTheirWhite.why}
        ideas={scoutIntel.prepVsTheirWhite.keyIdeas}
      />
      <PrepBlock
        title="Prep vs their Black"
        recommendation={scoutIntel.prepVsTheirBlack.recommendation}
        why={scoutIntel.prepVsTheirBlack.why}
        ideas={scoutIntel.prepVsTheirBlack.keyIdeas}
      />
    </section>

    {!stats ? (
      <p className="text-sm text-slate-600 dark:text-slate-400">Opening stats unavailable.</p>
    ) : (
      <div className="grid gap-10 lg:grid-cols-2">
        <OpeningList title="As White" rows={stats.openingsAsWhite} />
        <OpeningList title="As Black" rows={stats.openingsAsBlack} />
        <OpeningList title="Worst for them" rows={stats.worstOpenings} />
        <OpeningList title="Best for them" rows={stats.bestOpenings} />
      </div>
    )}
  </div>
);

/* ---------- Form ---------- */

const FormStatsTab: React.FC<{ stats: OpponentGameStats | null; report: ChessReport }> = ({
  stats,
  report,
}) => {
  if (!stats) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Game stats unavailable.</p>;
  }

  return (
    <div className="space-y-10">
      <section>
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Recent form</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {stats.recentForm.map((result, i) => (
            <span
              key={`${result}-${i}`}
              className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${
                result === 'W'
                  ? 'bg-primary-100 text-primary-900 dark:bg-primary-500/20 dark:text-primary-200'
                  : result === 'L'
                    ? 'bg-rose-50 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {result}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {stats.currentStreak.count}× {stats.currentStreak.type} streak
          <span className="mx-1.5 text-slate-300">·</span>
          Loss-after-loss {stats.tiltRate}%
        </p>
      </section>

      <section className="grid gap-8 border-y border-primary-200/70 py-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 dark:border-slate-700/80">
        {[
          { label: 'Overall', value: `${stats.overall.winRate}%`, hint: `${stats.overall.games} games` },
          {
            label: 'White',
            value: `${stats.asWhite.winRate}%`,
            hint: `${stats.asWhite.wins}W-${stats.asWhite.draws}D-${stats.asWhite.losses}L`,
          },
          {
            label: 'Black',
            value: `${stats.asBlack.winRate}%`,
            hint: `${stats.asBlack.wins}W-${stats.asBlack.draws}D-${stats.asBlack.losses}L`,
          },
          {
            label: 'Avg moves',
            value: `${stats.averageMoves}`,
            hint: stats.preferredTimeControl,
          },
        ].map((metric, index, arr) => (
          <div
            key={metric.label}
            className={`xl:px-6 ${index === 0 ? 'xl:pl-0' : ''} ${
              index < arr.length - 1 ? 'xl:border-r xl:border-primary-200/70 dark:xl:border-slate-700/80' : ''
            }`}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {metric.label}
            </p>
            <p className="mt-3 font-display text-3xl font-semibold text-slate-900 dark:text-white">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{metric.hint}</p>
          </div>
        ))}
      </section>

      {stats.ratingTrend.delta != null && (
        <section>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Rating in sample</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
            {stats.ratingTrend.earliest} → {stats.ratingTrend.latest}{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              ({stats.ratingTrend.delta >= 0 ? '+' : ''}
              {stats.ratingTrend.delta})
            </span>
          </p>
        </section>
      )}

      <section>
        <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Time controls</h3>
        <div className="mt-4 space-y-3">
          {stats.timeControls.map((tc) => (
            <div key={tc.label} className="grid grid-cols-[5rem_1fr_5rem] items-center gap-3">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{tc.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-primary-600 dark:bg-primary-400"
                  style={{ width: `${Math.max(6, Math.min(100, tc.winRate))}%` }}
                />
              </div>
              <span className="text-right text-xs text-slate-500">
                {tc.winRate}% · {tc.games}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-10 border-t border-primary-200/70 pt-10 sm:grid-cols-2 dark:border-slate-700/80">
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Phases</h3>
          <div className="mt-4 space-y-4">
            <PhaseRow label="Middlegame" score={report.middleGameAnalysis.overallRating} />
            <PhaseRow label="Endgame" score={report.endgameAnalysis.overallRating} />
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Style</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Openings</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                {report.executiveSummary.favoriteOpenings.slice(0, 3).join(', ') || 'Various'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Time preference</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                {report.executiveSummary.timeControlPreference}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Strengths</dt>
              <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                {report.executiveSummary.strengthAreas.slice(0, 3).join('; ')}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
};

/* ---------- Shared pieces ---------- */

const SectionList: React.FC<{ title: string; items: string[]; numbered?: boolean }> = ({
  title,
  items,
  numbered,
}) => (
  <section>
    <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h4>
    {numbered ? (
      <ol className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <span className="font-display text-sm font-semibold text-primary-700 dark:text-primary-300">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    ) : (
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-6 text-slate-700 dark:text-slate-300">
            {item}
          </li>
        ))}
      </ul>
    )}
  </section>
);

const PrepBlock: React.FC<{
  title: string;
  recommendation: string;
  why: string;
  ideas: string[];
}> = ({ title, recommendation, why, ideas }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
      {title}
    </p>
    <h4 className="mt-2 font-display text-base font-semibold leading-snug text-slate-900 dark:text-white">
      {recommendation}
    </h4>
    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{why}</p>
    {ideas.length > 0 && (
      <ul className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
        {ideas.map((idea, i) => (
          <li key={i}>{idea}</li>
        ))}
      </ul>
    )}
  </div>
);

const OpeningList: React.FC<{
  title: string;
  rows: OpponentGameStats['openingsAsWhite'];
}> = ({ title, rows }) => (
  <div>
    <h4 className="font-display text-lg font-semibold text-slate-900 dark:text-white">{title}</h4>
    {rows.length === 0 ? (
      <p className="mt-3 text-sm text-slate-500">Not enough games.</p>
    ) : (
      <div className="mt-3 divide-y divide-primary-100 dark:divide-slate-800">
        {rows.map((row) => (
          <div
            key={`${row.asColor}-${row.eco || ''}-${row.name}`}
            className="flex items-baseline justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {row.eco ? `${row.eco} ` : ''}
                {row.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {row.wins}W-{row.draws}D-{row.losses}L · {row.games}g
              </p>
            </div>
            <span className="shrink-0 font-display text-sm font-semibold text-slate-900 dark:text-white">
              {row.winRate}%
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PhaseRow: React.FC<{ label: string; score: number }> = ({ label, score }) => (
  <div>
    <div className="mb-1.5 flex justify-between text-sm">
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white">{score}/10</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-primary-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full bg-primary-600 dark:bg-primary-400"
        style={{ width: `${Math.min(100, score * 10)}%` }}
      />
    </div>
  </div>
);

export default OpponentDashboardPopup;
