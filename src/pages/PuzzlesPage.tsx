import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, Swords, Trophy } from 'lucide-react';
import PuzzleTrainer from '../components/PuzzleTrainer';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { GameAnalysis } from '../types/analysis';
import { ChessGame } from '../types/game';
import { ChessReport } from '../types/report';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { userDataService } from '../services/userDataService';

const PuzzlesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [gameAnalyses, setGameAnalyses] = useState<GameAnalysis[]>([]);
  const [profileReport, setProfileReport] = useState<ChessReport | null>(null);
  const [profileGames, setProfileGames] = useState<ChessGame[]>([]);
  const [profilePlatform, setProfilePlatform] = useState<'lichess' | 'chess.com' | undefined>();
  const [profileUsername, setProfileUsername] = useState<string | undefined>();
  const [profileRated, setProfileRated] = useState<boolean | undefined>();

  useEffect(() => {
    let isMounted = true;

    const loadAnalysisContext = async () => {
      const [profile, analyses] = await Promise.all([
        profileAnalysisService.loadProfile(currentUser?.id),
        userDataService.loadGameAnalyses(currentUser?.id),
      ]);

      if (!isMounted) return;

      setProfileReport(profile?.report || null);
      setProfileGames(profile?.games || []);
      setProfilePlatform(profile?.platform);
      setProfileUsername(profile?.username);
      setProfileRated(profile?.rated);
      setGameAnalyses(analyses);
    };

    void loadAnalysisContext();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const latestGameAnalysis = useMemo(() => {
    return gameAnalyses
      .slice()
      .sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime())[0] || null;
  }, [gameAnalyses]);

  const trainerAnalysis = useMemo(() => {
    if (latestGameAnalysis) return latestGameAnalysis;
    if (profileReport) return createAnalysisFromProfileReport(profileReport);
    return null;
  }, [latestGameAnalysis, profileReport]);

  const formatAccuracy = (value: number) => {
    if (!Number.isFinite(value)) return '—';
    return `${Math.round(value * 10) / 10}%`;
  };

  return (
    <div className="section-shell space-y-8 py-8">
      <section className="aurora-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-300">Tactics lab</p>
        <div className="mt-2">
          <h1 className="font-display text-3xl font-semibold text-slate-900 sm:text-4xl dark:text-white">Puzzle Trainer</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-700 sm:text-base dark:text-slate-300">
            Train with focused, analysis-aware puzzle sets that feel like a modern coaching workspace.
          </p>
        </div>
      </section>

      <section className="aurora-subtle divide-y divide-primary-200/70 pt-2 dark:divide-slate-700/80">
        {[
          { icon: <Swords className="h-4 w-4" />, title: 'Fix weaknesses', text: 'Mine your last 20 games for long thinks and blunders, then replay those exact moments.' },
          { icon: <Sparkles className="h-4 w-4" />, title: 'Session flow', text: 'Hints, resets, and next puzzles are one-click and fast.' },
          { icon: <Trophy className="h-4 w-4" />, title: 'Progress streaks', text: 'Keep momentum with streak and solved tracking.' },
          { icon: <Brain className="h-4 w-4" />, title: 'Openings & endgames', text: 'Starts at your puzzle rating, then climbs after streaks.' },
        ].map((item) => (
          <div key={item.title} className="grid gap-2 py-3 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100/80 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">{item.icon}</div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="mr-2 font-semibold text-slate-900 dark:text-white">{item.title}</span>
              {item.text}
            </p>
          </div>
        ))}
      </section>

      {!profileUsername && (
        <section className="aurora-subtle flex items-start gap-3 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-600 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Sync a chess account for weakness puzzles</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Fix My Weaknesses needs your chess games. Open reports to connect an account, then come back to replay your own blunders and long thinks.
            </p>
            <Button type="button" variant="outline" size="sm" className="mt-3 cursor-pointer" onClick={() => navigate('/reports')}>
              Open reports
            </Button>
          </div>
        </section>
      )}

      {profileUsername && !latestGameAnalysis && !profileReport && (
        <section className="aurora-subtle flex items-start gap-3 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-600 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Ready for weakness training</h2>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Your account is connected. Fix My Weaknesses will scan your last 20 games when you start.
            </p>
          </div>
        </section>
      )}

      {latestGameAnalysis && (
        <section className="aurora-subtle grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-primary-200/70 dark:sm:divide-slate-700/80">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Latest analysis</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
              {latestGameAnalysis.openingEvaluation?.name || 'Analyzed game'}
            </div>
          </div>
          <div className="sm:pl-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">White accuracy</div>
            <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {formatAccuracy(latestGameAnalysis.whiteAccuracy)}
            </div>
          </div>
          <div className="sm:pl-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Black accuracy</div>
            <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {formatAccuracy(latestGameAnalysis.blackAccuracy)}
            </div>
          </div>
        </section>
      )}

      {!latestGameAnalysis && profileReport && (
        <section className="aurora-subtle grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-primary-200/70 dark:sm:divide-slate-700/80">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Profile analysis</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
              {profileReport.executiveSummary.favoriteOpenings?.[0] || 'Synced profile'}
            </div>
          </div>
          <div className="sm:pl-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Average accuracy</div>
            <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {formatAccuracy(profileReport.executiveSummary.averageAccuracy)}
            </div>
          </div>
          <div className="sm:pl-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Win rate</div>
            <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
              {formatAccuracy(profileReport.executiveSummary.winRate)}
            </div>
          </div>
        </section>
      )}

      <div className="aurora-subtle pt-6">
        <PuzzleTrainer
          analysis={trainerAnalysis}
          platform={profilePlatform}
          username={profileUsername}
          games={profileGames}
          rated={profileRated}
        />
      </div>
    </div>
  );
};

export default PuzzlesPage;

const createAnalysisFromProfileReport = (report: ChessReport): GameAnalysis => {
  const averageAccuracy = Number.isFinite(report.executiveSummary.averageAccuracy)
    ? report.executiveSummary.averageAccuracy
    : 70;

  return {
    gameId: report.id,
    moves: [],
    whiteAccuracy: averageAccuracy,
    blackAccuracy: averageAccuracy,
    totalMistakes: {
      white: {
        blunders: report.recurringWeaknesses?.[0]?.frequency || 0,
        mistakes: report.recurringWeaknesses?.[1]?.frequency || 0,
        inaccuracies: report.recurringWeaknesses?.[2]?.frequency || 0
      },
      black: {
        blunders: 0,
        mistakes: 0,
        inaccuracies: 0
      }
    },
    openingEvaluation: {
      name: report.executiveSummary.favoriteOpenings?.[0] || 'Profile analysis',
      eco: '',
      evaluation: 0
    },
    criticalMoments: [],
    analyzedAt: new Date(report.generatedAt),
    engineUsed: 'stockfish',
    depth: 0
  };
};
