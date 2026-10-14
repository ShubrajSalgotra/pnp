import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, Swords, Target, Trophy } from 'lucide-react';
import PuzzleTrainer from '../components/PuzzleTrainer';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/ui/StatCard';
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
    return (
      gameAnalyses
        .slice()
        .sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime())[0] || null
    );
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
    <div className="space-y-8">
      <PageHeader
        kicker="TACTICS LAB"
        title="Puzzle Trainer"
        description="Solve tailored tactical puzzles mined from your games, master critical opening ideas, and hone endgame conversion."
      />

      {/* Feature Pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            icon: Swords,
            title: 'Fix Weaknesses',
            subtitle: 'Replay your own blunders & long thinks',
          },
          {
            icon: Sparkles,
            title: 'Adaptive Flow',
            subtitle: 'Progressive hints and quick resets',
          },
          {
            icon: Trophy,
            title: 'Streak Multipliers',
            subtitle: 'Build momentum with daily solve streaks',
          },
          {
            icon: Target,
            title: 'Openings & Endings',
            subtitle: 'Curated sets scaling with your level',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-emerald-400">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {item.title}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {item.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!profileUsername && (
        <div className="flex items-start gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
            <Brain className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Connect your chess account for personalized weakness mining
            </h2>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              Fix My Weaknesses analyzes your actual games to extract the exact moments you hesitated or made a mistake. Connect your account in reports to unlock personalized puzzles.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 cursor-pointer text-xs font-bold"
              onClick={() => navigate('/dashboard')}
            >
              Connect Chess Account
            </Button>
          </div>
        </div>
      )}

      {/* Accuracy / Performance Highlights if available */}
      {latestGameAnalysis && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Latest Analyzed Opening"
            value={latestGameAnalysis.openingEvaluation?.name || 'Analyzed game'}
            subtitle="Extracted from your game review"
            icon={<Brain className="h-5 w-5" />}
          />
          <StatCard
            title="White Accuracy"
            value={formatAccuracy(latestGameAnalysis.whiteAccuracy)}
            subtitle="Engine accuracy percentage"
            icon={<Target className="h-5 w-5" />}
          />
          <StatCard
            title="Black Accuracy"
            value={formatAccuracy(latestGameAnalysis.blackAccuracy)}
            subtitle="Engine accuracy percentage"
            icon={<Trophy className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Main Puzzle Trainer Component */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
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
        inaccuracies: report.recurringWeaknesses?.[2]?.frequency || 0,
      },
      black: {
        blunders: 0,
        mistakes: 0,
        inaccuracies: 0,
      },
    },
    openingEvaluation: {
      name: report.executiveSummary.favoriteOpenings?.[0] || 'Profile analysis',
      eco: '',
      evaluation: 0,
    },
    criticalMoments: [],
    analyzedAt: new Date(report.generatedAt),
    engineUsed: 'stockfish',
    depth: 0,
  };
};
