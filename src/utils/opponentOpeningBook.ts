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

    try {
      if (game.pgn) {
        chess.loadPgn(game.pgn);
        const history = chess.history({ verbose: true });
        chess.reset();

        let indexedThisGame = false;
        for (const move of history) {
          const key = positionKeyFromFen(chess.fen());
          const played = chess.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion,
          });
          if (!played) break;

          if (played.color === opponentColor) {
            const bucket = counts.get(key) || new Map<string, number>();
            bucket.set(played.san, (bucket.get(played.san) || 0) + 1);
            counts.set(key, bucket);
            movesIndexed += 1;
            indexedThisGame = true;
          }
        }
        if (indexedThisGame) gamesUsed += 1;
        continue;
      }

      // Fallback: replay SAN move list
      if (!game.moves?.length) continue;
      let indexedThisGame = false;
      for (const san of game.moves) {
        const key = positionKeyFromFen(chess.fen());
        const turn = chess.turn();
        const played = chess.move(san);
        if (!played) break;
        if (turn === opponentColor) {
          const bucket = counts.get(key) || new Map<string, number>();
          bucket.set(played.san, (bucket.get(played.san) || 0) + 1);
          counts.set(key, bucket);
          movesIndexed += 1;
          indexedThisGame = true;
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
 * Weighted sample from book moves. Requires minCount total samples in the position.
 * Returns null when out of book / too sparse.
 */
export function pickBookMove(
  book: OpponentOpeningBook,
  fen: string,
  options?: { minSamples?: number; temperature?: number }
): { san: string; count: number; total: number } | null {
  const minSamples = options?.minSamples ?? 2;
  const temperature = options?.temperature ?? 0.85;
  const moves = book.positions.get(positionKeyFromFen(fen));
  if (!moves?.length) return null;

  const total = moves.reduce((sum, m) => sum + m.count, 0);
  if (total < minSamples) return null;

  // Softmax-ish weighting so the modal move wins often but alternatives appear.
  const weights = moves.map((m) => Math.pow(m.count, 1 / Math.max(0.35, temperature)));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * weightSum;
  for (let i = 0; i < moves.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return { san: moves[i].san, count: moves[i].count, total };
    }
  }
  const last = moves[moves.length - 1];
  return { san: last.san, count: last.count, total };
}
