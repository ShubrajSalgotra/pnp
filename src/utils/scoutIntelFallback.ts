import { OpponentScoutIntel } from '../types/opponentScout';
import { ChessReport } from '../types/report';

/** Build lightweight scout intel from a legacy opponent report that lacks scoutIntel. */
export function buildScoutIntelFallback(report: ChessReport): OpponentScoutIntel {
  const weaknesses = report.recurringWeaknesses.slice(0, 4);
  const strengths = report.executiveSummary.strengthAreas.slice(0, 3);

  return {
    battlePlanHeadline: `Pressure ${report.username} where their habits break — especially ${
      weaknesses[0]?.title?.toLowerCase() || 'recurring middlegame mistakes'
    }.`,
    playingStyle:
      report.executiveSummary.keyInsights.slice(0, 2).join(' ') ||
      `${report.username} shows a ${report.executiveSummary.timeControlPreference} preference with openings like ${
        report.executiveSummary.favoriteOpenings.slice(0, 2).join(', ') || 'varied systems'
      }.`,
    predictabilityScore: Math.min(
      92,
      45 + weaknesses.length * 8 + Math.round((100 - report.executiveSummary.winRate) / 4)
    ),
    howToBeatThem: [
      ...weaknesses.map((w) => `Exploit: ${w.title}. ${w.improvementSuggestion}`),
      ...(report.middleGameAnalysis.weaknesses[0]
        ? [`In the middlegame, look for: ${report.middleGameAnalysis.weaknesses[0]}`]
        : []),
    ].slice(0, 6),
    yourEdges: [
      ...weaknesses.slice(0, 3).map((w) => `They repeat “${w.title}” — prepare a plan that invites it.`),
      report.endgameAnalysis.overallRating <= 6
        ? 'Their endgame conversion looks softer — simplify when ahead.'
        : 'Stay sharp in technical endings; they can convert.',
    ].slice(0, 5),
    dangerZones: strengths.length
      ? strengths.map((s) => `Respect their strength: ${s}`)
      : report.middleGameAnalysis.strengths.slice(0, 3).map((s) => `Danger: ${s}`),
    prepVsTheirWhite: {
      recommendation: `Against their White repertoire (${report.executiveSummary.favoriteOpenings[0] || 'main lines'}), pick a structure you know cold.`,
      why: 'Force them out of autopilot openings into positions tied to their weaknesses.',
      keyIdeas: weaknesses.slice(0, 3).map((w) => w.title),
    },
    prepVsTheirBlack: {
      recommendation: 'As White, aim for practical, slightly imbalanced positions rather than dry equality.',
      why: 'Their Black defenses often rely on familiar setups — early pressure pays.',
      keyIdeas: report.middleGameAnalysis.recommendations.slice(0, 3),
    },
    preGameChecklist: [
      'Review their top 2 openings for the color they will play',
      `Write one plan targeting: ${weaknesses[0]?.title || 'a known weakness'}`,
      'Decide your main line + one backup structure',
      'Note one danger zone to avoid',
      'Set a clock habit: move when your plan is clear, not when the position is perfect',
    ],
    overTheBoardTips: [
      'If they blitz early moves, slow down at the first unfamiliar branch',
      'After they err, do not return the favor with a hasty “equalizing” trade',
      report.executiveSummary.timeControlPreference
        ? `They prefer ${report.executiveSummary.timeControlPreference} — keep the game in your tempo`
        : 'Keep the game in your preferred tempo',
    ],
    psychologicalNotes: [
      `Sample win rate in this report: ${report.executiveSummary.winRate}% — look for streak / tilt swings in recent form`,
      ...report.executiveSummary.keyInsights.slice(0, 2),
    ].slice(0, 4),
  };
}
