import { Chess } from 'chess.js';
import { ChessGame } from '../types/game';

export type BookMove = {
  /** SAN move as played in the source games. */
  san: string;
  count: number;
};

export type OpponentOpeningBook = {
  /** Position key → weighted opponent moves from that side to move. */
  positions: Map<string, BookMove[]>;
  gamesUsed: number;
  movesIndexed: number;
};

const normalizeUsername = (value: string) => value.trim().toLowerCase();

/** Stable key: piece placement, side, castling, en passant (ignore clocks). */
export function positionKeyFromFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function recordOpponentMove(
  counts: Map<string, Map<string, number>>,
  indexedSamples: Set<string>,
  key: string,
  san: string
): boolean {
  const sampleKey = `${key}\u0000${san}`;
  if (indexedSamples.has(sampleKey)) return false;
  indexedSamples.add(sampleKey);

  const bucket = counts.get(key) || new Map<string, number>();
  bucket.set(san, (bucket.get(san) || 0) + 1);
  counts.set(key, bucket);
  return true;
}

/**
 * Build a frequency opening book from the opponent's moves in their past games.
 * Only indexes moves made by `opponentUsername`.
 */
export function buildOpponentOpeningBook(
  games: ChessGame[],
  opponentUsername: string
): OpponentOpeningBook {
  const counts = new Map<string, Map<string, number>>();
  let gamesUsed = 0;
  let movesIndexed = 0;
  const target = normalizeUsername(opponentUsername);

  for (const game of games) {
    const asWhite = normalizeUsername(game.white.name) === target;
    const asBlack = normalizeUsername(game.black.name) === target;
    if (!asWhite && !asBlack) continue;

    const opponentColor = asWhite ? 'w' : 'b';
    const chess = new Chess();
    const indexedSamples = new Set<string>();
    let indexedThisGame = false;

    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
        const history = chess.history({ verbose: true });
        chess.reset();

        for (const move of history) {
          const key = positionKeyFromFen(chess.fen());
          const played = chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion,
          });
          if (!played) break;

          if (played.color === opponentColor) {
            if (recordOpponentMove(counts, indexedSamples, key, played.san)) {
              movesIndexed += 1;
              indexedThisGame = true;
            }
          }
        }
        if (indexedThisGame) gamesUsed += 1;
        continue;
      }

      // Fallback: replay SAN move list
      if (!game.moves?.length) continue;
      for (const san of game.moves) {
        const key = positionKeyFromFen(chess.fen());
        const turn = chess.turn();
        const played = chess.move(san);
        if (!played) break;
        if (turn === opponentColor) {
          if (recordOpponentMove(counts, indexedSamples, key, played.san)) {
            movesIndexed += 1;
            indexedThisGame = true;
          }
        }
      }
      if (indexedThisGame) gamesUsed += 1;
    } catch {
      // skip corrupt games
    }
  }

  const positions = new Map<string, BookMove[]>();
  counts.forEach((moveMap, key) => {
    const moves = Array.from(moveMap.entries())
      .map(([san, count]) => ({ san, count }))
      .sort((a, b) => b.count - a.count);
    positions.set(key, moves);
  });

  return { positions, gamesUsed, movesIndexed };
}

/**
 * Sample a historical move in proportion to its observed game count.
 * Returns null when the opponent has no recorded move from the position.
 */
export function pickBookMove(
  book: OpponentOpeningBook,
  fen: string,
  options?: { minSamples?: number }
): { san: string; count: number; total: number } | null {
  const minSamples = options?.minSamples ?? 1;
  const moves = book.positions.get(positionKeyFromFen(fen));
  if (!moves?.length) return null;

  const total = moves.reduce((sum, m) => sum + m.count, 0);
  if (total < minSamples) return null;

  let roll = Math.random() * total;
  for (let i = 0; i < moves.length; i++) {
    roll -= moves[i].count;
    if (roll <= 0) {
      return { san: moves[i].san, count: moves[i].count, total };
    }
  }
  const last = moves[moves.length - 1];
  return { san: last.san, count: last.count, total };
}
