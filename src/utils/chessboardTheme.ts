import { Chess, type Square } from 'chess.js';

/**
 * Wood board + Chess.com interaction language:
 * yellow last-move/selected, gray legal-move hints.
 */
export const BOARD_LIGHT = '#f0d9b5';
export const BOARD_DARK = '#b58863';
export const LAST_MOVE_TINT = 'rgba(255, 255, 51, 0.5)';
export const SELECTED_SQUARE_TINT = 'rgba(255, 255, 51, 0.5)';
export const HOVER_LEGAL_TINT = 'rgba(255, 255, 51, 0.45)';
export const WRONG_MOVE_TINT = 'rgba(202, 52, 49, 0.55)';
/** Soft amber highlight for first-level puzzle hints. */
export const HINT_SQUARE_TINT = 'rgba(56, 189, 248, 0.42)';
/** Chess.com quiet-move hint — dark translucent dot. */
export const LEGAL_MOVE_DOT =
  'radial-gradient(rgba(0, 0, 0, 0.14) 19%, rgba(0, 0, 0, 0) 20%)';
/** Chess.com capture hint — dark ring. */
export const LEGAL_CAPTURE_RING =
  'radial-gradient(transparent 0%, transparent 79%, rgba(0, 0, 0, 0.14) 80%)';

export type BoardLastMove = {
  from: string;
  to: string;
  toTint?: string;
};

export type PlayedBoardMove = {
  san: string;
  from: string;
  to: string;
  fenAfter: string;
  color: 'w' | 'b';
  captured?: string;
  isCheck: boolean;
  isCheckmate: boolean;
};

export function tryPlayMove(
  fen: string,
  from: string,
  to: string,
  promotion: string = 'q'
): PlayedBoardMove | null {
  const chess = new Chess(fen);
  const piece = chess.get(from as Square);
  const isPromotion =
    piece?.type === 'p' &&
    ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

  try {
    const move = chess.move(
      isPromotion ? { from, to, promotion } : { from, to }
    );
    if (!move) return null;
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      fenAfter: chess.fen(),
      color: move.color,
      captured: move.captured,
      isCheck: Boolean(move.san.includes('+') || move.san.includes('#')),
      isCheckmate: Boolean(move.san.includes('#')),
    };
  } catch {
    return null;
  }
}

export function getLegalTargets(
  fen: string,
  from: string
): { to: string; isCapture: boolean }[] {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from as Square);
    if (!piece) return [];
    return chess
      .moves({ square: from as Square, verbose: true })
      .map((move) => ({
        to: move.to,
        isCapture:
          Boolean(move.captured) || move.flags.includes('c') || move.flags.includes('e'),
      }));
  } catch {
    return [];
  }
}

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  try {
    return new Chess(fen).turn();
  } catch {
    return 'w';
  }
}
