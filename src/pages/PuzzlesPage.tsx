import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Brain } from 'lucide-react';
import PuzzleTrainer from '../components/PuzzleTrainer';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { GameAnalysis } from '../types/analysis';
import { profileAnalysisService } from '../services/profileAnalysisService';

const PuzzlesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<GameAnalysis[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadAnalysisContext = async () => {
      const savedAnalyses = localStorage.getItem(`chess-analyses-${currentUser?.id}`);
      const profile = await profileAnalysisService.loadProfile(currentUser?.id);

      if (!savedAnalyses) {
        if (isMounted) setAnalyses(profile?.report ? [createAnalysisFromProfileReport(profile.report)] : []);
        return;
      }

      try {
        const parsedAnalyses = JSON.parse(savedAnalyses) as Array<[string, GameAnalysis]>;
        const gameAnalyses = parsedAnalyses.map(([, analysis]) => ({
          ...analysis,
          analyzedAt: new Date(analysis.analyzedAt)
        }));
        if (isMounted) {
          setAnalyses(profile?.report ? [createAnalysisFromProfileReport(profile.report), ...gameAnalyses] : gameAnalyses);
        }
      } catch (error) {
        console.error('Error loading puzzle analysis context:', error);
        if (isMounted) setAnalyses(profile?.report ? [createAnalysisFromProfileReport(profile.report)] : []);
      }
    };

    loadAnalysisContext();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const latestAnalysis = useMemo(() => {
    return analyses
      .slice()
      .sort((a, b) => b.analyzedAt.getTime() - a.analyzedAt.getTime())[0] || null;
  }, [analyses]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Puzzle Trainer</h1>
          <p className="text-gray-600 mt-2">
            Train the exact area you want with Lichess puzzles matched to your level.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => navigate('/analyze')}>
          <BarChart3 className="mr-2 h-4 w-4" />
          Analyze a Game
        </Button>
      </div>

      {!latestAnalysis && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-blue-950">No analyzed game found yet</h2>
                <p className="text-sm text-blue-800">
                  You can still solve general puzzles now. Analyze a game later to make the categories more personal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {latestAnalysis && (
        <Card className="mb-6">
          <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-gray-500">Latest analysis</div>
              <div className="font-semibold">{latestAnalysis.openingEvaluation.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">White accuracy</div>
              <div className="font-semibold">{latestAnalysis.whiteAccuracy}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Black accuracy</div>
              <div className="font-semibold">{latestAnalysis.blackAccuracy}%</div>
            </div>
          </CardContent>
        </Card>
      )}

      <PuzzleTrainer analysis={latestAnalysis} />
    </div>
  );
};

export default PuzzlesPage;

const createAnalysisFromProfileReport = (report: any): GameAnalysis => ({
  gameId: report.id,
  moves: [],
  whiteAccuracy: report.executiveSummary.averageAccuracy || 70,
  blackAccuracy: report.executiveSummary.averageAccuracy || 70,
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
});
