import { ChessGame } from '../types/game';
import {
  ActionableImprovementPlan,
  EndgameAnalysis,
  ExecutiveSummary,
  MiddleGameAnalysis,
  OpeningAnalysis,
  RecurringWeakness,
} from '../types/report';
import { computeOpponentGameStats } from './opponentStats';
import { videoRecommendationService } from '../services/videoRecommendationService';

export interface LocalReportStats {
  totalGames: number;
  winRate: number;
  averageAccuracy: number | null;
  favoriteOpenings: string[];
  timeControlPreference: string;
  overallRating: number;
  asWhiteWinRate: number;
  asBlackWinRate: number;
  recentForm: Array<'W' | 'D' | 'L'>;
  ratingTrendDelta: number | null;
}

export function computeLocalReportStats(games: ChessGame[], username: string): LocalReportStats {
  const stats = computeOpponentGameStats(games, username);

  let accuracySum = 0;
  let accuracyCount = 0;
  for (const game of games) {
    const isWhite = game.white.name.toLowerCase() === username.toLowerCase();
    const acc = isWhite ? game.accuracy?.white : game.accuracy?.black;
    if (typeof acc === 'number' && Number.isFinite(acc)) {
      accuracySum += acc;
      accuracyCount += 1;
    }
  }

  const ratingCandidates = games
    .map((game) => {
      const isWhite = game.white.name.toLowerCase() === username.toLowerCase();
      return isWhite ? game.white.rating : game.black.rating;
    })
    .filter((r): r is number => typeof r === 'number' && Number.isFinite(r));

  const overallRating =
    ratingCandidates.length > 0
      ? Math.round(ratingCandidates.reduce((a, b) => a + b, 0) / ratingCandidates.length)
      : stats.ratingTrend.latest || 0;

  return {
    totalGames: stats.totalGames,
    winRate: stats.overall.winRate,
    averageAccuracy:
      accuracyCount > 0 ? Math.round((accuracySum / accuracyCount) * 10) / 10 : null,
    favoriteOpenings: [
      ...stats.openingsAsWhite.slice(0, 2).map((o) => o.name),
      ...stats.openingsAsBlack.slice(0, 2).map((o) => o.name),
    ].slice(0, 4),
    timeControlPreference: stats.preferredTimeControl,
    overallRating,
    asWhiteWinRate: stats.asWhite.winRate,
    asBlackWinRate: stats.asBlack.winRate,
    recentForm: stats.recentForm.slice(0, 10),
    ratingTrendDelta: stats.ratingTrend.delta,
  };
}

export function mergeExecutiveSummary(
  local: LocalReportStats,
  ai: Partial<ExecutiveSummary> | undefined
): ExecutiveSummary {
  const aiOpenings = ai?.favoriteOpenings;
  const aiStrengths = ai?.strengthAreas;
  const aiInsights = ai?.keyInsights;

  return {
    totalGames: local.totalGames,
    winRate: local.winRate,
    averageAccuracy:
      local.averageAccuracy ??
      (typeof ai?.averageAccuracy === 'number' ? ai.averageAccuracy : 70),
    favoriteOpenings:
      local.favoriteOpenings.length > 0
        ? local.favoriteOpenings
        : Array.isArray(aiOpenings)
          ? aiOpenings.slice(0, 4)
          : ['Various'],
    timeControlPreference: local.timeControlPreference || ai?.timeControlPreference || 'Mixed',
    overallRating: local.overallRating || ai?.overallRating || 0,
    strengthAreas: Array.isArray(aiStrengths) ? aiStrengths.slice(0, 4) : [],
    keyInsights: Array.isArray(aiInsights) ? aiInsights.slice(0, 4) : [],
  };
}

/** Build opening phase review from real game opening tags (local, accurate). */
export function buildOpeningAnalysis(
  games: ChessGame[],
  username: string,
  aiHints?: Partial<Pick<OpeningAnalysis, 'strengths' | 'weaknesses' | 'recommendations' | 'overallRating'>>
): OpeningAnalysis {
  const stats = computeOpponentGameStats(games, username);
  const repertoire = [
    ...stats.openingsAsWhite.slice(0, 4).map((o) => ({
      name: o.name,
      performance: Math.max(1, Math.min(10, Math.round(o.winRate / 10))),
      gamesPlayed: o.games,
      successRate: o.winRate,
      asColor: 'white' as const,
    })),
    ...stats.openingsAsBlack.slice(0, 4).map((o) => ({
      name: o.name,
      performance: Math.max(1, Math.min(10, Math.round(o.winRate / 10))),
      gamesPlayed: o.games,
      successRate: o.winRate,
      asColor: 'black' as const,
    })),
  ]
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 6);

  const best = stats.bestOpenings.slice(0, 2).map((o) => `${o.name} (${o.winRate}% in ${o.games})`);
  const worst = stats.worstOpenings.slice(0, 2).map((o) => `${o.name} (${o.winRate}% in ${o.games})`);

  const aiStrengths = aiHints?.strengths;
  const aiWeaknesses = aiHints?.weaknesses;
  const aiRecommendations = aiHints?.recommendations;

  const strengths =
    Array.isArray(aiStrengths) && aiStrengths.length > 0
      ? aiStrengths.slice(0, 3)
      : best.length > 0
        ? best.map((b) => `Reliable results with ${b}`)
        : [`White score ${stats.asWhite.winRate}%`, `Black score ${stats.asBlack.winRate}%`];

  const weaknesses =
    Array.isArray(aiWeaknesses) && aiWeaknesses.length > 0
      ? aiWeaknesses.slice(0, 3)
      : worst.length > 0
        ? worst.map((w) => `Soft results in ${w}`)
        : ['Narrow or inconsistent repertoire sample'];

  const recommendations =
    Array.isArray(aiRecommendations) && aiRecommendations.length > 0
      ? aiRecommendations.slice(0, 3)
      : [
          worst[0]
            ? `Prioritize repairing ${stats.worstOpenings[0]?.name || 'your weakest opening'}`
            : 'Pick 1 main line as White and 1 as Black and deepen them',
          stats.asWhite.winRate + 8 < stats.asBlack.winRate
            ? 'White repertoire needs more practical systems'
            : stats.asBlack.winRate + 8 < stats.asWhite.winRate
              ? 'Black defenses need a clearer main weapon'
              : 'Keep color balance — deepen your highest-volume lines',
          'Study typical middlegame plans arising from your top 2 openings',
        ];

  const avgSuccess =
    repertoire.length > 0
      ? repertoire.reduce((sum, r) => sum + r.successRate, 0) / repertoire.length
      : stats.overall.winRate;

  return {
    overallRating:
      typeof aiHints?.overallRating === 'number'
        ? aiHints.overallRating
        : Math.max(1, Math.min(10, Math.round(avgSuccess / 10))),
    strengths,
    weaknesses,
    repertoire,
    recommendations,
    asWhiteWinRate: stats.asWhite.winRate,
    asBlackWinRate: stats.asBlack.winRate,
  };
}

export function ensureMiddleGameAnalysis(
  analysis?: Partial<MiddleGameAnalysis> | null
): MiddleGameAnalysis {
  const source = analysis ?? {};
  return {
    overallRating: source.overallRating ?? 5,
    strengths: Array.isArray(source.strengths) ? source.strengths : [],
    weaknesses: Array.isArray(source.weaknesses) ? source.weaknesses : [],
    patterns: {
      positionalUnderstanding: source.patterns?.positionalUnderstanding ?? 5,
      tacticalAwareness: source.patterns?.tacticalAwareness ?? 5,
      planFormation: source.patterns?.planFormation ?? 5,
      pieceCoordination: source.patterns?.pieceCoordination ?? 5,
    },
    recommendations: Array.isArray(source.recommendations) ? source.recommendations : [],
    examplePositions: Array.isArray(source.examplePositions) ? source.examplePositions : [],
  };
}

export function ensureEndgameAnalysis(
  analysis?: Partial<EndgameAnalysis> | null
): EndgameAnalysis {
  const source = analysis ?? {};
  return {
    overallRating: source.overallRating ?? 5,
    strengths: Array.isArray(source.strengths) ? source.strengths : [],
    weaknesses: Array.isArray(source.weaknesses) ? source.weaknesses : [],
    commonMistakes: Array.isArray(source.commonMistakes) ? source.commonMistakes : [],
    endgameTypes: Array.isArray(source.endgameTypes) ? source.endgameTypes : [],
    recommendations: Array.isArray(source.recommendations) ? source.recommendations : [],
    studyMaterial: Array.isArray(source.studyMaterial) ? source.studyMaterial : [],
    examplePositions: Array.isArray(source.examplePositions) ? source.examplePositions : [],
  };
}

/** Build improvement plan without a second AI round-trip. */
export function buildImprovementPlanFromAnalysis(
  weaknesses: RecurringWeakness[],
  middlegame: MiddleGameAnalysis,
  endgame: EndgameAnalysis,
  aiPlan?: Partial<ActionableImprovementPlan>
): ActionableImprovementPlan {
  const video = videoRecommendationService.getPersonalizedVideoRecommendation(
    weaknesses,
    middlegame,
    endgame
  );

  const fallbackActions = weaknesses.slice(0, 3).map((w, index) => ({
    priority: (index === 0 ? 'high' : index === 1 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
    action: `Fix: ${w.title}`,
    description: w.technicalImprovement || w.improvementSuggestion,
    timeframe: index === 0 ? 'Next 5 games' : index === 1 ? 'This week' : 'Next 2 weeks',
  }));

  const aiActions = aiPlan?.immediateActions;
  const immediateActions =
    Array.isArray(aiActions) && aiActions.length > 0 ? aiActions.slice(0, 4) : fallbackActions;

  const aiWeekly = aiPlan?.weeklyFocus;
  const weeklyFocus =
    Array.isArray(aiWeekly) && aiWeekly.length > 0
      ? aiWeekly.slice(0, 3)
      : [
          {
            week: 1,
            focus: weaknesses[0]?.title || 'Tactical awareness',
            exercises: [
              'Solve 15 puzzles daily targeting the #1 weakness',
              'Annotate 2 of your losses focusing only on that theme',
            ],
            goals: ['Eliminate the #1 recurring mistake pattern in practice games'],
          },
          {
            week: 2,
            focus: middlegame.recommendations[0] || 'Middlegame planning',
            exercises: [
              'Before every pawn break, write one sentence plan',
              'Review 1 master game featuring the same structure',
            ],
            goals: ['Clearer middlegame plans in 70%+ of games'],
          },
          {
            week: 3,
            focus: endgame.studyMaterial[0] || 'Endgame technique',
            exercises: [
              'Drill the top endgame type from your report for 20 minutes',
              'Play out 3 converted advantages without rushing',
            ],
            goals: ['Convert +1 to +2 advantages more reliably'],
          },
        ];

  const aiMonthly = aiPlan?.monthlyGoals;
  const monthlyGoals =
    Array.isArray(aiMonthly) && aiMonthly.length > 0
      ? aiMonthly.slice(0, 2)
      : [
          {
            month: 1,
            goal: `Cut frequency of “${weaknesses[0]?.title || 'main weakness'}” by half`,
            milestones: ['Track each occurrence after every session', 'Re-check with a mini report'],
            trackingMethod: 'Mark each game where the pattern appears',
          },
        ];

  const masterGame = aiPlan?.resources?.masterGame || {
    players: 'Capablanca vs Tartakower (1924)',
    event: 'New York 1924',
    description:
      'Model game for converting a small positional edge with patient piece improvement.',
    relevantConcept: weaknesses[0]?.title || 'Piece activity',
    keyMoves: 'Rook lift, improving the worst piece, timely pawn break',
  };

  const aiExercises = aiPlan?.resources?.exercises;

  return {
    immediateActions,
    weeklyFocus,
    monthlyGoals,
    resources: {
      recommendedVideo: {
        title: video.title,
        channel: video.channel,
        url: video.url,
        description: video.description,
        relevantWeakness: video.relevantWeakness,
        duration: video.duration,
      },
      exercises: Array.isArray(aiExercises)
        ? aiExercises.slice(0, 5)
        : [
            `Theme puzzles for: ${weaknesses[0]?.title || 'tactics'}`,
            'Play 10 slow games with a written plan at move 12',
            endgame.studyMaterial[0] || 'Basic rook endgame drills',
          ],
      masterGame,
    },
  };
}
