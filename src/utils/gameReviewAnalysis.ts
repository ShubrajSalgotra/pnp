import { Chess, Move } from 'chess.js';
import { ChessGame } from '../types/game';
import { stockfishService, STOCKFISH_DEPTH } from '../services/stockfishService';

/** Chess.com Game Review classification set. */
export type ReviewClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface ReviewMove {
  index: number;
  moveNumber: number;
  san: string;
  color: 'w' | 'b';
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  evaluation: number;
  evalBefore: number;
  centipawnLoss: number;
  /** Per-move accuracy 0–100 (win% model). */
  moveAccuracy: number;
  classification: ReviewClassification;
  glyph: string;
  clock?: string;
  /** Remaining clock in seconds after this move, when PGN `%clk` is present. */
  clockSeconds?: number;
  /** Seconds spent thinking on this move (derived from consecutive clocks). */
  timeSpentSeconds?: number;
  isCapture: boolean;
  isCheck: boolean;
  bestMoveUci?: string | null;
  bestMoveFrom?: string;
  bestMoveTo?: string;
}

export interface ReviewAnalysis {
  moves: ReviewMove[];
  evalSeries: number[];
  whiteAccuracy: number;
  blackAccuracy: number;
  whitePerformance: number;
  blackPerformance: number;
  counts: {
    white: Record<ReviewClassification, number>;
    black: Record<ReviewClassification, number>;
  };
  phaseAccuracy: {
    opening: { white: number | null; black: number | null };
    middlegame: { white: number | null; black: number | null };
    endgame: { white: number | null; black: number | null };
  };
  engine: 'stockfish';
  depth: number;
}

export type ReviewProgress = {
  currentMove: number;
  totalMoves: number;
  progress: number;
  message: string;
};

const PIECE_VALUE: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const emptyCounts = (): Record<ReviewClassification, number> => ({
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
});

/** Chess.com-aligned labels, glyphs, and colors. */
export const classificationMeta: Record<
  ReviewClassification,
  { label: string; color: string; glyph: string }
> = {
  brilliant: { label: 'Brilliant', color: '#1baca6', glyph: '!!' },
  great: { label: 'Great', color: '#5c8bb0', glyph: '!' },
  best: { label: 'Best', color: '#96bc4b', glyph: '*' },
  excellent: { label: 'Excellent', color: '#81b64c', glyph: '+' },
  good: { label: 'Good', color: '#b2c87e', glyph: '' },
  book: { label: 'Book', color: '#d0a67b', glyph: '' },
  inaccuracy: { label: 'Inaccuracy', color: '#f7c631', glyph: '?!' },
  mistake: { label: 'Mistake', color: '#e6912c', glyph: '?' },
  miss: { label: 'Miss', color: '#ee6aa7', glyph: 'X' },
  blunder: { label: 'Blunder', color: '#ca3431', glyph: '??' },
};

/**
 * Approximate win probability for White from a white-centric centipawn eval.
 * Same logistic used by Lichess / similar to Chess.com expected-points.
 */
function whiteWinProb(cp: number): number {
  const clamped = Math.max(-1200, Math.min(1200, cp));
  return 1 / (1 + Math.exp(-0.00368208 * clamped));
}

/** Per-move accuracy from expected-points loss (0–100). */
function moveAccuracyScore(evalBefore: number, evalAfter: number, color: 'w' | 'b'): number {
  const before = color === 'w' ? whiteWinProb(evalBefore) : 1 - whiteWinProb(evalBefore);
  const after = color === 'w' ? whiteWinProb(evalAfter) : 1 - whiteWinProb(evalAfter);
  const winPercentLost = Math.max(0, (before - after) * 100);
  const accuracy = 103.1668 * Math.exp(-0.04354 * winPercentLost) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

function avgAccuracy(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function isPieceSacrifice(move: Move): boolean {
  if (!move.captured) return false;
  const given = PIECE_VALUE[move.piece] ?? 0;
  const taken = PIECE_VALUE[move.captured] ?? 0;
  // Chess.com-style: a real piece sac (not pawn trades / equal exchanges).
  if (given < 3) return false;
  return given > taken;
}

function playerEval(evaluation: number, color: 'w' | 'b'): number {
  return color === 'w' ? evaluation : -evaluation;
}

function classifyMove(args: {
  loss: number;
  moveIndex: number;
  playedUci: string;
  bestMoveUci: string | null;
  move: Move;
  evalBefore: number;
  evalAfter: number;
  opponentPreviousClass?: ReviewClassification;
}): ReviewClassification {
  const {
    loss,
    moveIndex,
    playedUci,
    bestMoveUci,
    move,
    evalBefore,
    evalAfter,
    opponentPreviousClass,
  } = args;

  const isBest = Boolean(bestMoveUci && playedUci === bestMoveUci);
  const nearBest = isBest || loss <= 10;
  const isCheck = move.san.includes('+') || move.san.includes('#');
  const beforeForPlayer = playerEval(evalBefore, move.color);
  const afterForPlayer = playerEval(evalAfter, move.color);

  // Book: early opening theory window with a solid move.
  if (moveIndex < 12 && loss <= 25) return 'book';

  // Miss: failed to punish opponent's recent error when a much better move existed.
  const opponentErred =
    opponentPreviousClass === 'blunder' ||
    opponentPreviousClass === 'mistake' ||
    opponentPreviousClass === 'inaccuracy';
  if (opponentErred && loss >= 80 && beforeForPlayer >= 150) {
    return 'miss';
  }

  // Brilliant: best/near-best piece sacrifice that doesn't leave you worse.
  if (nearBest && loss <= 15 && isPieceSacrifice(move) && afterForPlayer > -80) {
    return 'brilliant';
  }

  // Great: only-good / game-changing best move (swing or saving check).
  const swung =
    (beforeForPlayer < -80 && afterForPlayer >= -20) ||
    (beforeForPlayer < 80 && afterForPlayer >= 200) ||
    afterForPlayer - beforeForPlayer >= 180;
  if (isBest && loss <= 8 && (swung || (isCheck && afterForPlayer >= beforeForPlayer))) {
    return 'great';
  }

  if (isBest || loss <= 5) return 'best';
  if (loss <= 20) return 'excellent';
  if (loss <= 40) return 'good';
  if (loss <= 80) return 'inaccuracy';
  if (loss <= 150) return 'mistake';
  return 'blunder';
}

export function parseClockToSeconds(raw?: string): number | undefined {
  if (!raw) return undefined;
  const parts = raw.split(':').map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

/** Parse starting seconds from controls like `600`, `600+5`, `15+10`, or `3+2`. */
export function startingClockFromTimeControl(timeControl?: string): number | undefined {
  if (!timeControl) return undefined;
  const match = timeControl.trim().match(/^(\d+)(?:\+\d+)?$/);
  if (!match) return undefined;
  const base = Number(match[1]);
  if (!Number.isFinite(base) || base <= 0) return undefined;
  // Chess.com often uses seconds; values under 3 minutes written as minutes are rare in PGN.
  return base;
}

export function parseClocksFromPgn(pgn: string): string[] {
  const clocks: string[] = [];
  const regex = /\[%clk\s+([0-9:.]+)\]/g;
  let match;
  while ((match = regex.exec(pgn)) !== null) {
    clocks.push(match[1]);
  }
  return clocks;
}

function formatClock(raw?: string): string | undefined {
  if (!raw) return undefined;
  const seconds = parseClockToSeconds(raw);
  if (seconds === undefined) return raw;
  return formatSeconds(seconds);
}

export function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Phase from material + ply — closer to how reviews split opening/middle/endgame
 * than a pure move-index heuristic.
 */
function phaseForPosition(
  fen: string,
  moveIndex: number,
  totalMoves: number
): 'opening' | 'middlegame' | 'endgame' {
  const board = fen.split(' ')[0] || '';
  let nonPawnMaterial = 0;
  let queens = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    if (lower === 'q') {
      queens += 1;
      nonPawnMaterial += 9;
    } else if (lower === 'r') nonPawnMaterial += 5;
    else if (lower === 'b' || lower === 'n') nonPawnMaterial += 3;
  }

  const earlyCutoff = Math.min(16, Math.floor(totalMoves * 0.28));
  if (moveIndex < earlyCutoff && nonPawnMaterial >= 22) return 'opening';
  if (queens === 0 && nonPawnMaterial <= 14) return 'endgame';
  if (nonPawnMaterial <= 10) return 'endgame';
  if (moveIndex > Math.max(totalMoves - 16, Math.floor(totalMoves * 0.72)) && nonPawnMaterial <= 18) {
    return 'endgame';
  }
  return 'middlegame';
}

function parseUciSquares(uci?: string | null): { from?: string; to?: string } {
  if (!uci || uci.length < 4) return {};
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };
}

type PlayableMove = {
  from: string;
  to: string;
  promotion?: string;
  san?: string;
};

/**
 * Apply a move without passing full verbose Move objects into chess.js.
 * Verbose objects throw noisy "Invalid move: {...}" errors on any desync.
 */
export function playMoveSafe(chess: Chess, move: PlayableMove): Move {
  const payload: { from: string; to: string; promotion?: string } = {
    from: move.from,
    to: move.to,
  };
  if (move.promotion) {
    payload.promotion = move.promotion;
  }

  try {
    return chess.move(payload);
  } catch {
    if (move.san) {
      try {
        return chess.move(move.san);
      } catch {
        // fall through
      }
    }
    throw new Error(
      `Could not play ${move.san || `${move.from}${move.to}`} in the current position.`
    );
  }
}

/**
 * Detect FENs that cannot arise in standard chess (e.g. 6 white knights while
 * 7 pawns remain — often LLM/corrupt data that looks like RNBQKB1R → NNNNKN1N).
 */
export function isImplausibleFen(fen: string): boolean {
  const board = fen.split(' ')[0] || '';
  if (!board) return true;

  const count = (piece: string) =>
    (board.match(new RegExp(piece, 'g')) || []).length;

  const sides: Array<{ piece: string; pawn: string }> = [
    { piece: 'N', pawn: 'P' },
    { piece: 'B', pawn: 'P' },
    { piece: 'R', pawn: 'P' },
    { piece: 'Q', pawn: 'P' },
    { piece: 'n', pawn: 'p' },
    { piece: 'b', pawn: 'p' },
    { piece: 'r', pawn: 'p' },
    { piece: 'q', pawn: 'p' },
  ];

  for (const { piece, pawn } of sides) {
    const pieces = count(piece);
    const pawns = count(pawn);
    const base = piece.toLowerCase() === 'q' ? 1 : 2;
    const maxPromotions = Math.max(0, 8 - pawns);
    if (pieces > base + maxPromotions) return true;
  }

  return count('K') !== 1 || count('k') !== 1;
}

export async function analyzeGameForReview(
  game: ChessGame,
  options?: {
    depth?: number;
    onProgress?: (progress: ReviewProgress) => void;
    signal?: AbortSignal;
  }
): Promise<ReviewAnalysis> {
  const depth = options?.depth ?? STOCKFISH_DEPTH;
  const chess = new Chess();

  try {
    chess.loadPgn(game.pgn);
  } catch {
    // Fall through with empty history if PGN is malformed
  }

  const history = chess.history({ verbose: true }) as Move[];
  const clocks = parseClocksFromPgn(game.pgn);

  chess.reset();
  const moves: ReviewMove[] = [];
  const evalSeries: number[] = [];
  const counts = { white: emptyCounts(), black: emptyCounts() };

  const phaseAccuracies = {
    opening: { white: [] as number[], black: [] as number[] },
    middlegame: { white: [] as number[], black: [] as number[] },
    endgame: { white: [] as number[], black: [] as number[] },
  };

  options?.onProgress?.({
    currentMove: 0,
    totalMoves: history.length,
    progress: 0,
    message: 'Starting Stockfish…',
  });

  await stockfishService.newGame();

  let previousEval = 0;
  let previousBestMove: string | null = null;
  const startClock = startingClockFromTimeControl(game.timeControl);
  let lastWhiteClock: number | undefined = startClock;
  let lastBlackClock: number | undefined = startClock;
  let previousClassification: ReviewClassification | undefined;
  let previousFen = chess.fen();

  for (let index = 0; index <= history.length; index += 1) {
    if (options?.signal?.aborted) {
      throw new Error('Analysis cancelled');
    }

    const fen = chess.fen();
    if (isImplausibleFen(fen)) {
      throw new Error(
        'This game has a corrupted board position and cannot be analyzed. Try refreshing games from your chess account.'
      );
    }

    options?.onProgress?.({
      currentMove: Math.min(index, history.length),
      totalMoves: history.length,
      progress: Math.round((index / Math.max(1, history.length)) * 100),
      message:
        index === 0
          ? 'Stockfish evaluating starting position…'
          : `Analyzing move ${index} of ${history.length} with Stockfish…`,
    });

    const positionEval = await stockfishService.evaluatePosition(fen, depth);
    evalSeries.push(positionEval.evaluation);

    if (index > 0) {
      const move = history[index - 1];
      const isWhite = move.color === 'w';
      let centipawnLoss = 0;
      if (isWhite) {
        centipawnLoss = Math.max(0, previousEval - positionEval.evaluation);
      } else {
        centipawnLoss = Math.max(0, positionEval.evaluation - previousEval);
      }

      const playedUci = `${move.from}${move.to}${move.promotion || ''}`;
      const classification = classifyMove({
        loss: centipawnLoss,
        moveIndex: index - 1,
        playedUci,
        bestMoveUci: previousBestMove,
        move,
        evalBefore: previousEval,
        evalAfter: positionEval.evaluation,
        opponentPreviousClass: previousClassification,
      });
      const bestSquares = parseUciSquares(previousBestMove);
      const moveAccuracy = moveAccuracyScore(previousEval, positionEval.evaluation, move.color);

      const rawClock = clocks[index - 1];
      const clockSeconds = parseClockToSeconds(rawClock);
      let timeSpentSeconds: number | undefined;
      if (clockSeconds !== undefined) {
        const previousClock = isWhite ? lastWhiteClock : lastBlackClock;
        if (previousClock !== undefined) {
          // Ignore increment noise / clock resets; only count sensible spends.
          const spent = previousClock - clockSeconds;
          if (spent >= 0 && spent < 3600) timeSpentSeconds = spent;
        }
        if (isWhite) lastWhiteClock = clockSeconds;
        else lastBlackClock = clockSeconds;
      }

      const fenBefore = previousFen;
      const reviewMove: ReviewMove = {
        index: index - 1,
        moveNumber: Math.floor((index - 1) / 2) + 1,
        san: move.san,
        color: move.color,
        from: move.from,
        to: move.to,
        fenBefore,
        fenAfter: fen,
        evaluation: positionEval.evaluation,
        evalBefore: previousEval,
        centipawnLoss,
        moveAccuracy,
        classification,
        glyph: classificationMeta[classification].glyph,
        clock: formatClock(rawClock),
        clockSeconds,
        timeSpentSeconds,
        isCapture: Boolean(move.captured),
        isCheck: Boolean(move.san.includes('+') || move.san.includes('#')),
        bestMoveUci: previousBestMove,
        bestMoveFrom: bestSquares.from,
        bestMoveTo: bestSquares.to,
      };

      moves.push(reviewMove);
      if (isWhite) counts.white[classification] += 1;
      else counts.black[classification] += 1;

      const phase = phaseForPosition(fenBefore, index - 1, history.length);
      if (isWhite) phaseAccuracies[phase].white.push(moveAccuracy);
      else phaseAccuracies[phase].black.push(moveAccuracy);

      previousClassification = classification;
    }

    previousEval = positionEval.evaluation;
    previousBestMove = positionEval.bestMoveUci;
    previousFen = fen;

    if (index < history.length) {
      playMoveSafe(chess, history[index]);
    }
  }

  const whiteAccuracies = moves.filter((m) => m.color === 'w').map((m) => m.moveAccuracy);
  const blackAccuracies = moves.filter((m) => m.color === 'b').map((m) => m.moveAccuracy);

  const estimatedWhite = avgAccuracy(whiteAccuracies) ?? 0;
  const estimatedBlack = avgAccuracy(blackAccuracies) ?? 0;

  // Prefer platform accuracy when imported; otherwise use engine win% model.
  const whiteAccuracy = game.accuracy?.white ?? estimatedWhite;
  const blackAccuracy = game.accuracy?.black ?? estimatedBlack;

  const whiteRating = game.white.rating || 1200;
  const blackRating = game.black.rating || 1200;
  const whitePerformance = Math.round(whiteRating + (whiteAccuracy - 70) * 8);
  const blackPerformance = Math.round(blackRating + (blackAccuracy - 70) * 8);

  const phaseAccuracy = {
    opening: {
      white: avgAccuracy(phaseAccuracies.opening.white),
      black: avgAccuracy(phaseAccuracies.opening.black),
    },
    middlegame: {
      white: avgAccuracy(phaseAccuracies.middlegame.white),
      black: avgAccuracy(phaseAccuracies.middlegame.black),
    },
    endgame: {
      white: avgAccuracy(phaseAccuracies.endgame.white),
      black: avgAccuracy(phaseAccuracies.endgame.black),
    },
  };

  options?.onProgress?.({
    currentMove: history.length,
    totalMoves: history.length,
    progress: 100,
    message: 'Stockfish analysis complete',
  });

  return {
    moves,
    evalSeries,
    whiteAccuracy,
    blackAccuracy,
    whitePerformance,
    blackPerformance,
    counts,
    phaseAccuracy,
    engine: 'stockfish',
    depth,
  };
}

export function resultLabel(result: ChessGame['result']): string {
  if (result === '1-0') return 'White wins';
  if (result === '0-1') return 'Black wins';
  if (result === '1/2-1/2') return 'Game drawn';
  return 'Game unfinished';
}

export function evalStatusText(evaluation: number): string {
  const pawns = evaluation / 100;
  if (Math.abs(evaluation) >= 90000) {
    return evaluation > 0 ? 'White mating.' : 'Black mating.';
  }
  if (Math.abs(pawns) < 0.4) return 'equal position';
  if (pawns >= 3) return 'White dominating.';
  if (pawns <= -3) return 'Black dominating.';
  if (pawns >= 1.2) return 'White is better.';
  if (pawns <= -1.2) return 'Black is better.';
  if (pawns > 0) return 'White slightly better.';
  return 'Black slightly better.';
}

export function formatEval(evaluation: number): string {
  if (Math.abs(evaluation) >= 90000) {
    const mateIn = Math.max(1, Math.round((100000 - Math.abs(evaluation)) / 100));
    return evaluation > 0 ? `M${mateIn}` : `-M${mateIn}`;
  }
  const pawns = evaluation / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

export interface PlayerMoveTiming {
  moveIndex: number;
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  timeSpentSeconds?: number;
}

/** Walk a PGN and collect the target player's moves with optional think times from `%clk`. */
export function extractPlayerMoveTimings(game: ChessGame, username: string): PlayerMoveTiming[] {
  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch {
    return [];
  }

  const history = chess.history({ verbose: true }) as Move[];
  const clocks = parseClocksFromPgn(game.pgn);
  const startClock = startingClockFromTimeControl(game.timeControl);
  let lastWhiteClock: number | undefined = startClock;
  let lastBlackClock: number | undefined = startClock;

  const normalizedUser = username.trim().toLowerCase();
  const playsWhite = game.white.name.trim().toLowerCase() === normalizedUser;
  const playsBlack = game.black.name.trim().toLowerCase() === normalizedUser;
  if (!playsWhite && !playsBlack) return [];

  chess.reset();
  const timings: PlayerMoveTiming[] = [];

  for (let index = 0; index < history.length; index += 1) {
    const move = history[index];
    const fenBefore = chess.fen();
    if (isImplausibleFen(fenBefore)) break;

    let played: Move;
    try {
      played = playMoveSafe(chess, move);
    } catch {
      break;
    }

    const isWhite = played.color === 'w';
    const rawClock = clocks[index];
    const clockSeconds = parseClockToSeconds(rawClock);
    let timeSpentSeconds: number | undefined;
    if (clockSeconds !== undefined) {
      const previousClock = isWhite ? lastWhiteClock : lastBlackClock;
      if (previousClock !== undefined) {
        const spent = previousClock - clockSeconds;
        if (spent >= 0 && spent < 3600) timeSpentSeconds = spent;
      }
      if (isWhite) lastWhiteClock = clockSeconds;
      else lastBlackClock = clockSeconds;
    }

    const isPlayerMove = (isWhite && playsWhite) || (!isWhite && playsBlack);
    if (isPlayerMove) {
      timings.push({
        moveIndex: index,
        moveNumber: Math.floor(index / 2) + 1,
        color: played.color,
        san: played.san,
        from: played.from,
        to: played.to,
        promotion: played.promotion,
        uci: `${played.from}${played.to}${played.promotion || ''}`,
        fenBefore,
        fenAfter: chess.fen(),
        timeSpentSeconds,
      });
    }
  }

  return timings;
}

export interface CandidateMoveAnalysis {
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  playedUci: string;
  color: 'w' | 'b';
  moveNumber: number;
  moveIndex: number;
  evaluation: number;
  evalBefore: number;
  centipawnLoss: number;
  classification: ReviewClassification;
  bestMoveUci: string | null;
  bestMoveFrom?: string;
  bestMoveTo?: string;
  timeSpentSeconds?: number;
}

/** Stockfish-evaluate a single already-played move (position before → after). */
export async function analyzeCandidateMove(args: {
  fenBefore: string;
  played: {
    from: string;
    to: string;
    promotion?: string;
    san: string;
    color: 'w' | 'b';
  };
  moveIndex: number;
  moveNumber: number;
  depth?: number;
  timeSpentSeconds?: number;
}): Promise<CandidateMoveAnalysis> {
  const depth = args.depth ?? Math.max(8, STOCKFISH_DEPTH - 2);
  const before = await stockfishService.evaluatePosition(args.fenBefore, depth);

  if (isImplausibleFen(args.fenBefore)) {
    throw new Error(`Illegal candidate position for ${args.played.san}`);
  }

  const board = new Chess(args.fenBefore);
  let move: Move;
  try {
    move = playMoveSafe(board, args.played);
  } catch {
    throw new Error(`Illegal candidate move ${args.played.san} in ${args.fenBefore}`);
  }

  const after = await stockfishService.evaluatePosition(board.fen(), depth);
  const isWhite = args.played.color === 'w';
  const centipawnLoss = isWhite
    ? Math.max(0, before.evaluation - after.evaluation)
    : Math.max(0, after.evaluation - before.evaluation);

  const playedUci = `${args.played.from}${args.played.to}${args.played.promotion || ''}`;
  const classification = classifyMove({
    loss: centipawnLoss,
    moveIndex: args.moveIndex,
    playedUci,
    bestMoveUci: before.bestMoveUci,
    move,
    evalBefore: before.evaluation,
    evalAfter: after.evaluation,
  });
  const bestSquares = parseUciSquares(before.bestMoveUci);

  return {
    fenBefore: args.fenBefore,
    fenAfter: board.fen(),
    playedSan: args.played.san,
    playedUci,
    color: args.played.color,
    moveNumber: args.moveNumber,
    moveIndex: args.moveIndex,
    evaluation: after.evaluation,
    evalBefore: before.evaluation,
    centipawnLoss,
    classification,
    bestMoveUci: before.bestMoveUci,
    bestMoveFrom: bestSquares.from,
    bestMoveTo: bestSquares.to,
    timeSpentSeconds: args.timeSpentSeconds,
  };
}
