import { ChessGame } from '../types/game';
import {
  ColorRecord,
  FormResult,
  MatchupEdge,
  OpeningStat,
  OpponentGameStats,
  TimeControlStat,
} from '../types/opponentScout';
import { ChessReport } from '../types/report';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';

const emptyRecord = (): ColorRecord => ({
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0,
});

const finalizeRecord = (record: ColorRecord): ColorRecord => ({
  ...record,
  winRate: record.games > 0 ? Math.round((record.wins / record.games) * 1000) / 10 : 0,
});

const normalizeUsername = (value: string) => value.trim().toLowerCase();

const isPlayer = (game: ChessGame, username: string, color: 'white' | 'black') =>
  normalizeUsername(game[color].name) === normalizeUsername(username);

const resultForPlayer = (game: ChessGame, username: string): FormResult | null => {
  const asWhite = isPlayer(game, username, 'white');
  const asBlack = isPlayer(game, username, 'black');
  if (!asWhite && !asBlack) return null;

  if (game.result === '1/2-1/2') return 'D';
  if (game.result === '1-0') return asWhite ? 'W' : 'L';
  if (game.result === '0-1') return asBlack ? 'W' : 'L';
  return null;
};

const applyResult = (record: ColorRecord, result: FormResult) => {
  record.games += 1;
  if (result === 'W') record.wins += 1;
  else if (result === 'D') record.draws += 1;
  else record.losses += 1;
};

const openingKey = (game: ChessGame) => {
  const name = game.opening?.name?.trim() || 'Unknown opening';
  const eco = game.opening?.eco?.trim();
  return eco ? `${eco}|${name}` : name;
};

const timeControlLabel = (game: ChessGame): string => {
  if (game.timeClass) {
    const label = game.timeClass.toLowerCase();
    if (label.includes('bullet')) return 'Bullet';
    if (label.includes('blitz')) return 'Blitz';
    if (label.includes('rapid')) return 'Rapid';
    if (label.includes('daily') || label.includes('correspondence')) return 'Daily';
    if (label.includes('classical')) return 'Classical';
  }

  const raw = game.timeControl || '';
  const base = parseInt(raw.split('+')[0], 10);
  if (!Number.isFinite(base)) return raw || 'Unknown';
  if (base < 180) return 'Bullet';
  if (base < 600) return 'Blitz';
  if (base < 1800) return 'Rapid';
  return 'Classical';
};

const toOpeningStat = (
  name: string,
  eco: string | undefined,
  record: ColorRecord,
  asColor: OpeningStat['asColor']
): OpeningStat => ({
  name,
  eco,
  games: record.games,
  wins: record.wins,
  draws: record.draws,
  losses: record.losses,
  winRate: finalizeRecord(record).winRate,
  asColor,
});

export function computeOpponentGameStats(games: ChessGame[], username: string): OpponentGameStats {
  const overall = emptyRecord();
  const asWhite = emptyRecord();
  const asBlack = emptyRecord();
  const whiteOpenings = new Map<string, { name: string; eco?: string; record: ColorRecord }>();
  const blackOpenings = new Map<string, { name: string; eco?: string; record: ColorRecord }>();
  const timeControls = new Map<string, ColorRecord>();
  const recentForm: FormResult[] = [];
  let moveTotal = 0;
  let moveSamples = 0;
  const ratingsChronological: number[] = [];

  // Assume games arrive newest-first (import order); reverse for chronological rating trend.
  const chronological = [...games].reverse();

  for (const game of chronological) {
    const result = resultForPlayer(game, username);
    if (!result) continue;

    applyResult(overall, result);
    const color: 'white' | 'black' = isPlayer(game, username, 'white') ? 'white' : 'black';
    applyResult(color === 'white' ? asWhite : asBlack, result);

    const key = openingKey(game);
    const openingMap = color === 'white' ? whiteOpenings : blackOpenings;
    const existing = openingMap.get(key) || {
      name: game.opening?.name?.trim() || 'Unknown opening',
      eco: game.opening?.eco,
      record: emptyRecord(),
    };
    applyResult(existing.record, result);
    openingMap.set(key, existing);

    const tc = timeControlLabel(game);
    const tcRecord = timeControls.get(tc) || emptyRecord();
    applyResult(tcRecord, result);
    timeControls.set(tc, tcRecord);

    if (game.moves?.length) {
      moveTotal += game.moves.length;
      moveSamples += 1;
    }

    const rating = color === 'white' ? game.white.rating : game.black.rating;
    if (typeof rating === 'number' && rating > 0) {
      ratingsChronological.push(rating);
    }
  }

  // Form is most-recent first for UI chips.
  for (const game of games) {
    const result = resultForPlayer(game, username);
    if (result) recentForm.push(result);
    if (recentForm.length >= 12) break;
  }

  let currentStreak: OpponentGameStats['currentStreak'] = { type: 'D', count: 0 };
  if (recentForm.length > 0) {
    const type = recentForm[0];
    let count = 0;
    for (const result of recentForm) {
      if (result !== type) break;
      count += 1;
    }
    currentStreak = { type, count };
  }

  // recentForm is newest-first; tilt = share of losses that immediately follow another loss.
  const chronoForm = [...recentForm].reverse();
  let consecutiveLossPairs = 0;
  let lossOpportunities = 0;
  for (let i = 1; i < chronoForm.length; i++) {
    if (chronoForm[i] === 'L') {
      lossOpportunities += 1;
      if (chronoForm[i - 1] === 'L') consecutiveLossPairs += 1;
    }
  }
  const tiltRate =
    lossOpportunities > 0
      ? Math.round((consecutiveLossPairs / lossOpportunities) * 1000) / 10
      : 0;

  const openingsAsWhite = Array.from(whiteOpenings.values())
    .map((item) => toOpeningStat(item.name, item.eco, item.record, 'white'))
    .sort((a, b) => b.games - a.games);

  const openingsAsBlack = Array.from(blackOpenings.values())
    .map((item) => toOpeningStat(item.name, item.eco, item.record, 'black'))
    .sort((a, b) => b.games - a.games);

  const allOpenings = [...openingsAsWhite, ...openingsAsBlack].filter((o) => o.games >= 2);
  const worstOpenings = [...allOpenings].sort((a, b) => a.winRate - b.winRate || b.games - a.games).slice(0, 5);
  const bestOpenings = [...allOpenings].sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, 5);

  const timeControlStats: TimeControlStat[] = Array.from(timeControls.entries())
    .map(([label, record]) => {
      const finalized = finalizeRecord(record);
      return {
        label,
        games: finalized.games,
        wins: finalized.wins,
        draws: finalized.draws,
        losses: finalized.losses,
        winRate: finalized.winRate,
      };
    })
    .sort((a, b) => b.games - a.games);

  const earliest = ratingsChronological[0] ?? null;
  const latest = ratingsChronological[ratingsChronological.length - 1] ?? null;

  return {
    totalGames: overall.games,
    overall: finalizeRecord(overall),
    asWhite: finalizeRecord(asWhite),
    asBlack: finalizeRecord(asBlack),
    openingsAsWhite: openingsAsWhite.slice(0, 8),
    openingsAsBlack: openingsAsBlack.slice(0, 8),
    worstOpenings,
    bestOpenings,
    timeControls: timeControlStats,
    recentForm,
    currentStreak,
    tiltRate,
    averageMoves: moveSamples > 0 ? Math.round(moveTotal / moveSamples) : 0,
    preferredTimeControl: timeControlStats[0]?.label || 'Unknown',
    ratingTrend: {
      earliest,
      latest,
      delta: earliest != null && latest != null ? latest - earliest : null,
    },
  };
}

export function buildMatchupEdge(
  yourProfile: PlayerAnalysisProfile | null,
  opponentReport: ChessReport
): MatchupEdge | null {
  if (!yourProfile?.report) return null;

  const yourStrengths = yourProfile.report.executiveSummary.strengthAreas?.slice(0, 4) || [];
  const theirWeaknesses = opponentReport.recurringWeaknesses.slice(0, 4).map((w) => w.title);
  const theirStrengths = opponentReport.executiveSummary.strengthAreas?.slice(0, 3) || [];
  const yourWeaknesses = yourProfile.report.recurringWeaknesses.slice(0, 3).map((w) => w.title);

  const leveragePoints: string[] = [];
  if (yourStrengths[0] && theirWeaknesses[0]) {
    leveragePoints.push(`Lean on your ${yourStrengths[0].toLowerCase()} against their ${theirWeaknesses[0].toLowerCase()}.`);
  }
  if (theirWeaknesses[1]) {
    leveragePoints.push(`Steer the game toward positions that punish: ${theirWeaknesses[1]}.`);
  }
  if (opponentReport.middleGameAnalysis.overallRating < yourProfile.report.middleGameAnalysis.overallRating) {
    leveragePoints.push('You outscore them in the middlegame — complicate and keep pieces on.');
  }
  if (opponentReport.endgameAnalysis.overallRating < yourProfile.report.endgameAnalysis.overallRating) {
    leveragePoints.push('Your endgame edge is real — simplify into favorable technical endings.');
  }
  if (leveragePoints.length === 0 && theirWeaknesses[0]) {
    leveragePoints.push(`Primary target: ${theirWeaknesses[0]}.`);
  }

  const cautionPoints: string[] = [];
  if (theirStrengths[0]) {
    cautionPoints.push(`Do not gift them their comfort zone: ${theirStrengths[0]}.`);
  }
  if (yourWeaknesses[0] && theirStrengths[0]) {
    cautionPoints.push(`Watch your ${yourWeaknesses[0].toLowerCase()} — it plays into their strengths.`);
  }
  if (opponentReport.endgameAnalysis.overallRating >= 7) {
    cautionPoints.push('They convert endgames well — avoid lifeless equal endings if you need a win.');
  }

  return {
    yourStrengths,
    theirWeaknesses,
    leveragePoints: leveragePoints.slice(0, 4),
    cautionPoints: cautionPoints.slice(0, 3),
  };
}

export async function fetchOpponentLiveProfile(
  platform: 'lichess' | 'chess.com',
  username: string
): Promise<{
  avatarUrl: string | null;
  ratings: { rapid: number | null; blitz: number | null; bullet: number | null; puzzle: number | null };
  url: string | null;
}> {
  const empty = {
    avatarUrl: null as string | null,
    ratings: { rapid: null, blitz: null, bullet: null, puzzle: null },
    url: null as string | null,
  };

  try {
    if (platform === 'chess.com') {
      const [playerRes, statsRes] = await Promise.all([
        fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`),
        fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`),
      ]);

      if (!playerRes.ok) return empty;
      const player = await playerRes.json();
      const stats = statsRes.ok ? await statsRes.json() : {};

      return {
        avatarUrl: typeof player?.avatar === 'string' ? player.avatar : null,
        ratings: {
          rapid: stats?.chess_rapid?.last?.rating ?? null,
          blitz: stats?.chess_blitz?.last?.rating ?? null,
          bullet: stats?.chess_bullet?.last?.rating ?? null,
          puzzle: stats?.tactics?.highest?.rating ?? stats?.tactics?.lowest?.rating ?? null,
        },
        url: typeof player?.url === 'string' ? player.url : `https://www.chess.com/member/${username}`,
      };
    }

    const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username)}`);
    if (!response.ok) return empty;
    const data = await response.json();
    const puzzle = data?.perfs?.puzzle?.rating;

    return {
      avatarUrl: null,
      ratings: {
        rapid: typeof data?.perfs?.rapid?.rating === 'number' ? data.perfs.rapid.rating : null,
        blitz: typeof data?.perfs?.blitz?.rating === 'number' ? data.perfs.blitz.rating : null,
        bullet: typeof data?.perfs?.bullet?.rating === 'number' ? data.perfs.bullet.rating : null,
        puzzle: typeof puzzle === 'number' && puzzle > 0 ? Math.round(puzzle) : null,
      },
      url: `https://lichess.org/@/${username}`,
    };
  } catch (error) {
    console.error('Failed to fetch opponent live profile:', error);
    return empty;
  }
}
