import { ChessGame } from '../types/game';
import { ChessReport } from '../types/report';

/** Stockfish UCI_Elo supported range (engine cannot go below this natively). */
export const STOCKFISH_ELO_MIN = 1320;
export const STOCKFISH_ELO_MAX = 3190;

const normalizeUsername = (value: string) => value.trim().toLowerCase();

export function clampStockfishElo(elo: number): number {
  return Math.max(STOCKFISH_ELO_MIN, Math.min(STOCKFISH_ELO_MAX, Math.round(elo)));
}

/** Sanitize a human/platform rating for practice targeting. */
export function sanitizeTargetElo(elo: number): number {
  return Math.max(100, Math.min(STOCKFISH_ELO_MAX, Math.round(elo)));
}

/**
 * Extra randomness used when the target is below Stockfish's UCI_Elo floor (1320).
 * ~793 → ~0.59, ~1000 → ~0.36, ~1200 → ~0.13
 */
export function subFloorBlunderChance(targetElo: number): number {
  if (targetElo >= STOCKFISH_ELO_MIN) return 0;
  return Math.min(0.82, (STOCKFISH_ELO_MIN - targetElo) / 900);
}

/**
 * Best-effort opponent rating for practice strength.
 * Prefers live ratings (rapid → blitz → bullet), then game sample average, then report estimate.
 * Returns the real rating (may be below 1320) — do not clamp here for display/targeting.
 */
export function resolveOpponentPracticeRating(input: {
  username: string;
  games?: ChessGame[];
  report?: ChessReport | null;
  liveRatings?: {
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
  } | null;
}): { elo: number; source: 'live' | 'games' | 'report' | 'default' } {
  const live = input.liveRatings;
  const livePick = live?.rapid ?? live?.blitz ?? live?.bullet;
  if (typeof livePick === 'number' && livePick > 0) {
    return { elo: sanitizeTargetElo(livePick), source: 'live' };
  }

  const target = normalizeUsername(input.username);
  const ratings: number[] = [];
  for (const game of input.games || []) {
    if (normalizeUsername(game.white.name) === target && typeof game.white.rating === 'number') {
      ratings.push(game.white.rating);
    } else if (normalizeUsername(game.black.name) === target && typeof game.black.rating === 'number') {
      ratings.push(game.black.rating);
    }
  }

  if (ratings.length > 0) {
    // Prefer recent games (import is newest-first).
    const sample = ratings.slice(0, Math.min(ratings.length, 30));
    const avg = sample.reduce((sum, r) => sum + r, 0) / sample.length;
    return { elo: sanitizeTargetElo(avg), source: 'games' };
  }

  const reportRating = input.report?.executiveSummary?.overallRating;
  if (typeof reportRating === 'number' && reportRating > 0) {
    return { elo: sanitizeTargetElo(reportRating), source: 'report' };
  }

  return { elo: 1500, source: 'default' };
}
