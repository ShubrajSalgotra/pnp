import { Chess } from 'chess.js';
import { ChessGame } from '../types/game';

/**
 * Local, engine-free move-level analysis of a player's games.
 *
 * The AI report used to receive nothing but raw SAN dumps, so it had no choice but to
 * emit themes that fit any club player. This module extracts concrete, checkable
 * evidence (real positions, real material swings, real missed captures) so the prompt
 * can demand citations instead of generalities — and so the payload stays small.
 */

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Analysis is heuristic, so only swings big enough to be unambiguous are reported. */
const MATERIAL_LOSS_THRESHOLD = 2;
const MISSED_MATERIAL_THRESHOLD = 2;
const MAX_GAMES_SCANNED = 40;
const MAX_PLIES_PER_GAME = 160;
const MAX_MOMENTS_RETURNED = 14;
/** Plies to follow a capture sequence before judging the material result. */
const MAX_SEQUENCE_LOOKAHEAD = 6;
/** Replay runs on the UI thread, so cap the work it may do. */
const SCAN_TIME_BUDGET_MS = 2500;

export type MomentKind =
  | 'missed_mate'
  | 'dropped_material'
  | 'missed_material'
  | 'threw_won_position';

export interface CriticalMoment {
  gameId: string;
  /** Full move number as a player would cite it. */
  moveNumber: number;
  color: 'white' | 'black';
  phase: 'opening' | 'middlegame' | 'endgame';
  opening: string;
  result: 'win' | 'loss' | 'draw';
  /** Position immediately before the player's move. */
  fen: string;
  movePlayed: string;
  /** Origin/target of the played move, for board arrows. */
  fromSquare: string;
  toSquare: string;
  kind: MomentKind;
  /** Material swing in pawns (positive number = pawns worth of damage). */
  swing: number;
  /** A concretely better move found locally, when one exists. */
  bestAlternative?: string;
  detail: string;
}

export interface EvidenceProfile {
  gamesScanned: number;
  /** Where things actually go wrong, as a share of all detected errors. */
  errorsByPhase: { opening: number; middlegame: number; endgame: number };
  blundersPerGame: number;
  missedWinsPerGame: number;
  averageFirstErrorMove: number | null;
  /** Games where the player was ≥3 pawns up at some point and still failed to win. */
  thrownWonPositions: number;
  /** Games where the player was ≥3 pawns down and still saved or won. */
  savedLostPositions: number;
  castledShare: number;
  neverCastledLosses: number;
  averageCastlingMove: number | null;
  earlyQueenGames: number;
  timeLossShare: number;
  averageLengthInWins: number | null;
  averageLengthInLosses: number | null;
  capturesPerGame: number;
  /** Share of the player's own moves that were captures — trade-happy vs trade-shy. */
  tradeTendency: number;
  endgamesReached: number;
  endgameWinRate: number | null;
}

export interface GameEvidence {
  moments: CriticalMoment[];
  profile: EvidenceProfile;
}

function materialFromFen(fen: string): { white: number; black: number; nonPawn: number } {
  const board = fen.split(' ')[0] || '';
  let white = 0;
  let black = 0;
  let nonPawn = 0;

  for (const char of board) {
    const lower = char.toLowerCase();
    const value = PIECE_VALUE[lower];
    if (value === undefined) continue;
    if (char === char.toUpperCase()) white += value;
    else black += value;
    if (lower !== 'p' && lower !== 'k') nonPawn += value;
  }

  return { white, black, nonPawn };
}

function playerBalance(fen: string, color: 'white' | 'black'): number {
  const material = materialFromFen(fen);
  return color === 'white' ? material.white - material.black : material.black - material.white;
}

function phaseFor(fen: string, moveNumber: number): CriticalMoment['phase'] {
  const { nonPawn } = materialFromFen(fen);
  if (nonPawn <= 20) return 'endgame';
  if (moveNumber <= 12) return 'opening';
  return 'middlegame';
}

function resultFor(game: ChessGame, color: 'white' | 'black'): 'win' | 'loss' | 'draw' {
  if (game.result === '1/2-1/2') return 'draw';
  if (game.result === '1-0') return color === 'white' ? 'win' : 'loss';
  if (game.result === '0-1') return color === 'black' ? 'win' : 'loss';
  return 'draw';
}

function playerColor(game: ChessGame, username: string): 'white' | 'black' | null {
  const target = username.trim().toLowerCase();
  if (game.white?.name?.trim().toLowerCase() === target) return 'white';
  if (game.black?.name?.trim().toLowerCase() === target) return 'black';
  return null;
}

function openingLabel(game: ChessGame): string {
  const name = game.opening?.name?.trim() || 'Unknown opening';
  const eco = game.opening?.eco?.trim();
  return eco ? `${name} (${eco})` : name;
}

function moveList(game: ChessGame): string[] {
  if (game.moves?.length) return game.moves;
  if (!game.pgn) return [];
  try {
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    return chess.history();
  } catch {
    return [];
  }
}

/**
 * Greedy 2-ply material check: the best capture available, net of an immediate
 * recapture on the same square. Good enough to catch free pieces without an engine.
 *
 * Uses the `after` FEN that chess.js attaches to verbose moves plus `isAttacked`, so no
 * move/undo or extra move generation is needed — this runs on the UI thread.
 */
function bestCaptureNet(
  legalMoves: any[],
  scratch: Chess,
  mover: 'w' | 'b'
): { san: string; net: number } | null {
  const opponent = mover === 'w' ? 'b' : 'w';
  const captures = legalMoves
    .filter((move) => move.captured)
    .sort((a, b) => (PIECE_VALUE[b.captured] ?? 0) - (PIECE_VALUE[a.captured] ?? 0));

  let best: { san: string; net: number } | null = null;

  for (const capture of captures) {
    const gained = PIECE_VALUE[capture.captured] ?? 0;
    // Captures are ordered by value won, and net can never exceed it.
    if (best && gained <= best.net) break;

    let net = gained;
    try {
      scratch.load(capture.after);
      if (scratch.isAttacked(capture.to, opponent)) {
        net = gained - (PIECE_VALUE[capture.piece] ?? 0);
      }
    } catch {
      continue;
    }

    if (!best || net > best.net) best = { san: capture.san, net };
  }

  return best;
}

/** chess.js marks mating moves with '#' in SAN, so no simulation is needed. */
function findMateInOne(legalMoves: any[]): string | null {
  return legalMoves.find((move) => move.san.endsWith('#'))?.san || null;
}

/**
 * Index of the ply at which the capture sequence started by our move at `ply` has
 * resolved. Always settles on our turn so recaptures are counted as trades.
 */
function settledPlyIndex(
  ply: number,
  moves: string[],
  totalPlies: number,
  ownParity: number
): number {
  let index = ply;
  let cursor = ply + 1;
  let steps = 0;

  while (cursor < totalPlies && steps < MAX_SEQUENCE_LOOKAHEAD) {
    const nextIsOurs = cursor % 2 === ownParity;
    const previousWasCapture = moves[cursor - 1]?.includes('x') ?? false;
    if (nextIsOurs && !previousWasCapture) break;
    index = cursor;
    cursor += 1;
    steps += 1;
  }

  return index;
}

interface GameScan {
  moments: CriticalMoment[];
  ownMoves: number;
  ownCaptures: number;
  firstErrorMove: number | null;
  castlingMove: number | null;
  earlyQueen: boolean;
  peakAdvantage: number;
  worstDeficit: number;
  reachedEndgame: boolean;
  plies: number;
}

function scanGame(game: ChessGame, color: 'white' | 'black'): GameScan | null {
  const moves = moveList(game).slice(0, MAX_PLIES_PER_GAME);
  if (moves.length < 8) return null;

  const scan: GameScan = {
    moments: [],
    ownMoves: 0,
    ownCaptures: 0,
    firstErrorMove: null,
    castlingMove: null,
    earlyQueen: false,
    peakAdvantage: 0,
    worstDeficit: 0,
    reachedEndgame: false,
    plies: moves.length,
  };

  const opening = openingLabel(game);
  const result = resultFor(game, color);
  const ownParity = color === 'white' ? 0 : 1;

  interface Candidate {
    ply: number;
    moveNumber: number;
    phase: CriticalMoment['phase'];
    fenBefore: string;
    played: string;
    fromSquare: string;
    toSquare: string;
    balanceBefore: number;
    mate: string | null;
    capture: { san: string; net: number } | null;
    wasCapture: boolean;
  }

  const chess = new Chess();
  const scratch = new Chess();
  /** FEN after each successfully applied ply, so material can be judged without undo. */
  const fenAfterPly: string[] = [];
  const candidates: Candidate[] = [];

  for (let ply = 0; ply < moves.length; ply++) {
    const isOwnMove = ply % 2 === ownParity;
    const fenBefore = chess.fen();
    const moveNumber = Math.floor(ply / 2) + 1;

    // One move generation per own turn serves both the mate and capture checks.
    const legalMoves: any[] | null = isOwnMove ? chess.moves({ verbose: true }) : null;

    let played: any;
    try {
      played = chess.move(moves[ply]);
    } catch {
      break;
    }
    fenAfterPly.push(chess.fen());

    if (!isOwnMove || !legalMoves) continue;

    scan.ownMoves += 1;
    if (played.captured) scan.ownCaptures += 1;
    if ((played.san === 'O-O' || played.san === 'O-O-O') && scan.castlingMove === null) {
      scan.castlingMove = moveNumber;
    }
    if (played.piece === 'q' && moveNumber <= 6) scan.earlyQueen = true;

    const balanceBefore = playerBalance(fenBefore, color);
    scan.peakAdvantage = Math.max(scan.peakAdvantage, balanceBefore);
    scan.worstDeficit = Math.min(scan.worstDeficit, balanceBefore);

    const phase = phaseFor(fenBefore, moveNumber);
    if (phase === 'endgame') scan.reachedEndgame = true;

    candidates.push({
      ply,
      moveNumber,
      phase,
      fenBefore,
      played: played.san,
      fromSquare: played.from,
      toSquare: played.to,
      balanceBefore,
      mate: findMateInOne(legalMoves),
      capture: bestCaptureNet(legalMoves, scratch, played.color),
      wasCapture: Boolean(played.captured),
    });
  }

  const totalPlies = fenAfterPly.length;
  scan.plies = totalPlies;

  for (const candidate of candidates) {
    const settled = settledPlyIndex(candidate.ply, moves, totalPlies, ownParity);
    const drop = candidate.balanceBefore - playerBalance(fenAfterPly[settled], color);
    const shared = {
      gameId: game.id,
      moveNumber: candidate.moveNumber,
      color,
      phase: candidate.phase,
      opening,
      result,
      fen: candidate.fenBefore,
      movePlayed: candidate.played,
      fromSquare: candidate.fromSquare,
      toSquare: candidate.toSquare,
    };

    let moment: CriticalMoment | null = null;

    if (candidate.mate && !candidate.played.endsWith('#')) {
      moment = {
        ...shared,
        kind: 'missed_mate',
        swing: 10,
        bestAlternative: candidate.mate,
        detail: `Mate in one was available with ${candidate.mate}; played ${candidate.played} instead.`,
      };
    } else if (drop >= MATERIAL_LOSS_THRESHOLD) {
      const rounded = Math.round(drop * 10) / 10;
      const alternative =
        candidate.capture && candidate.capture.net > 0 && candidate.capture.san !== candidate.played
          ? candidate.capture.san
          : undefined;
      moment = {
        ...shared,
        kind: 'dropped_material',
        swing: rounded,
        bestAlternative: alternative,
        detail: `After ${candidate.played} the sequence starting ${
          moves[candidate.ply + 1] || '(end of game)'
        } left them ${rounded} pawns worse off.`,
      };
    } else if (
      candidate.capture &&
      candidate.capture.net >= MISSED_MATERIAL_THRESHOLD &&
      candidate.played !== candidate.capture.san &&
      !candidate.wasCapture
    ) {
      moment = {
        ...shared,
        kind: 'missed_material',
        swing: candidate.capture.net,
        bestAlternative: candidate.capture.san,
        detail: `${candidate.capture.san} won ${candidate.capture.net} pawns of material; played ${candidate.played} instead.`,
      };
    }

    if (moment) {
      scan.moments.push(moment);
      if (scan.firstErrorMove === null) scan.firstErrorMove = moment.moveNumber;
    }
  }

  return scan;
}

/** Rank moments so the prompt sees the most instructive ones first. */
function momentPriority(moment: CriticalMoment): number {
  const kindWeight =
    moment.kind === 'missed_mate' ? 40 : moment.kind === 'threw_won_position' ? 30 : 0;
  const phaseWeight = moment.phase === 'endgame' ? 4 : moment.phase === 'middlegame' ? 6 : 2;
  const resultWeight = moment.result === 'loss' ? 8 : moment.result === 'draw' ? 3 : 0;
  return kindWeight + moment.swing + phaseWeight + resultWeight;
}

export function buildGameEvidence(games: ChessGame[], username: string): GameEvidence {
  const scanned = games.slice(0, MAX_GAMES_SCANNED);
  const allMoments: CriticalMoment[] = [];

  let gamesScanned = 0;
  let ownMoves = 0;
  let ownCaptures = 0;
  let castledGames = 0;
  let castlingMoveSum = 0;
  let neverCastledLosses = 0;
  let earlyQueenGames = 0;
  let timeLosses = 0;
  let thrownWonPositions = 0;
  let savedLostPositions = 0;
  let winLengthSum = 0;
  let winCount = 0;
  let lossLengthSum = 0;
  let lossCount = 0;
  let endgamesReached = 0;
  let endgameWins = 0;
  let endgameDecided = 0;
  const firstErrorMoves: number[] = [];
  const phaseErrors = { opening: 0, middlegame: 0, endgame: 0 };

  const deadline = Date.now() + SCAN_TIME_BUDGET_MS;

  for (const game of scanned) {
    const color = playerColor(game, username);
    if (!color) continue;
    if (Date.now() > deadline) break;

    let scan: GameScan | null = null;
    try {
      scan = scanGame(game, color);
    } catch (error) {
      console.warn(`Evidence scan failed for game ${game.id}:`, error);
      continue;
    }
    if (!scan) continue;

    gamesScanned += 1;
    ownMoves += scan.ownMoves;
    ownCaptures += scan.ownCaptures;

    const result = resultFor(game, color);

    if (scan.castlingMove !== null) {
      castledGames += 1;
      castlingMoveSum += scan.castlingMove;
    } else if (result === 'loss') {
      neverCastledLosses += 1;
    }

    if (scan.earlyQueen) earlyQueenGames += 1;
    if (/time|abandon/i.test(game.termination || '') && result === 'loss') timeLosses += 1;

    if (scan.peakAdvantage >= 3 && result !== 'win') thrownWonPositions += 1;
    if (scan.worstDeficit <= -3 && result !== 'loss') savedLostPositions += 1;

    if (result === 'win') {
      winLengthSum += Math.ceil(scan.plies / 2);
      winCount += 1;
    } else if (result === 'loss') {
      lossLengthSum += Math.ceil(scan.plies / 2);
      lossCount += 1;
    }

    if (scan.reachedEndgame) {
      endgamesReached += 1;
      if (result !== 'draw') {
        endgameDecided += 1;
        if (result === 'win') endgameWins += 1;
      }
    }

    if (scan.firstErrorMove !== null) firstErrorMoves.push(scan.firstErrorMove);
    for (const moment of scan.moments) phaseErrors[moment.phase] += 1;

    // Surface thrown wins as their own citable moment using the worst error of that game.
    if (scan.peakAdvantage >= 3 && result === 'loss' && scan.moments.length > 0) {
      const worst = [...scan.moments].sort((a, b) => b.swing - a.swing)[0];
      allMoments.push({
        ...worst,
        kind: 'threw_won_position',
        detail: `Was ${Math.round(scan.peakAdvantage)} pawns up in this game and still lost; ${worst.movePlayed} at move ${worst.moveNumber} was the biggest swing.`,
      });
    }

    allMoments.push(...scan.moments);
  }

  const totalErrors = phaseErrors.opening + phaseErrors.middlegame + phaseErrors.endgame;
  const pct = (value: number) => (totalErrors > 0 ? Math.round((value / totalErrors) * 100) : 0);

  // Deduplicate (thrown-win moments clone an existing one) and keep the most instructive.
  const seen = new Set<string>();
  const moments = allMoments
    .sort((a, b) => momentPriority(b) - momentPriority(a))
    .filter((moment) => {
      const key = `${moment.gameId}:${moment.moveNumber}:${moment.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_MOMENTS_RETURNED);

  return {
    moments,
    profile: {
      gamesScanned,
      errorsByPhase: {
        opening: pct(phaseErrors.opening),
        middlegame: pct(phaseErrors.middlegame),
        endgame: pct(phaseErrors.endgame),
      },
      blundersPerGame:
        gamesScanned > 0
          ? Math.round(
              (allMoments.filter((m) => m.kind === 'dropped_material').length / gamesScanned) * 10
            ) / 10
          : 0,
      missedWinsPerGame:
        gamesScanned > 0
          ? Math.round(
              (allMoments.filter((m) => m.kind === 'missed_material' || m.kind === 'missed_mate')
                .length /
                gamesScanned) *
                10
            ) / 10
          : 0,
      averageFirstErrorMove:
        firstErrorMoves.length > 0
          ? Math.round(firstErrorMoves.reduce((a, b) => a + b, 0) / firstErrorMoves.length)
          : null,
      thrownWonPositions,
      savedLostPositions,
      castledShare: gamesScanned > 0 ? Math.round((castledGames / gamesScanned) * 100) : 0,
      neverCastledLosses,
      averageCastlingMove:
        castledGames > 0 ? Math.round((castlingMoveSum / castledGames) * 10) / 10 : null,
      earlyQueenGames,
      timeLossShare: gamesScanned > 0 ? Math.round((timeLosses / gamesScanned) * 100) : 0,
      averageLengthInWins: winCount > 0 ? Math.round(winLengthSum / winCount) : null,
      averageLengthInLosses: lossCount > 0 ? Math.round(lossLengthSum / lossCount) : null,
      capturesPerGame:
        gamesScanned > 0 ? Math.round((ownCaptures / gamesScanned) * 10) / 10 : 0,
      tradeTendency: ownMoves > 0 ? Math.round((ownCaptures / ownMoves) * 100) : 0,
      endgamesReached,
      endgameWinRate:
        endgameDecided > 0 ? Math.round((endgameWins / endgameDecided) * 100) : null,
    },
  };
}

/** Compact, promptable rendering of the aggregate behavioural profile. */
export function formatEvidenceProfile(profile: EvidenceProfile): string {
  if (profile.gamesScanned === 0) return 'MOVE-LEVEL SCAN: unavailable (no replayable games).';

  const lines = [
    `MOVE-LEVEL SCAN (${profile.gamesScanned} games replayed locally, engine-free):`,
    `Error location: opening ${profile.errorsByPhase.opening}% / middlegame ${profile.errorsByPhase.middlegame}% / endgame ${profile.errorsByPhase.endgame}%`,
    `Material blunders per game: ${profile.blundersPerGame} | Missed free material or mate per game: ${profile.missedWinsPerGame}`,
    profile.averageFirstErrorMove
      ? `First serious error typically at move ${profile.averageFirstErrorMove}`
      : 'First serious error: no clear pattern',
    `Threw winning positions (≥3 pawns up, did not win): ${profile.thrownWonPositions} | Saved losing positions: ${profile.savedLostPositions}`,
    `Castled in ${profile.castledShare}% of games${
      profile.averageCastlingMove ? ` (avg move ${profile.averageCastlingMove})` : ''
    } | Losses without castling: ${profile.neverCastledLosses}`,
    `Games with queen out before move 7: ${profile.earlyQueenGames} | Losses on time/abandon: ${profile.timeLossShare}%`,
    `Avg game length — wins: ${profile.averageLengthInWins ?? 'n/a'} moves, losses: ${
      profile.averageLengthInLosses ?? 'n/a'
    } moves`,
    `Captures per game: ${profile.capturesPerGame} (${profile.tradeTendency}% of own moves are captures)`,
    `Reached an endgame in ${profile.endgamesReached} games${
      profile.endgameWinRate !== null ? ` — decisive endgame win rate ${profile.endgameWinRate}%` : ''
    }`,
  ];

  return lines.join('\n');
}

/** Compact, promptable rendering of citable positions. */
export function formatCriticalMoments(moments: CriticalMoment[]): string {
  if (moments.length === 0) {
    return 'CITABLE MOMENTS: none detected — ground claims in the fingerprint stats instead.';
  }

  const rows = moments.map((moment, index) => {
    const parts = [
      `M${index + 1}`,
      `gameId=${moment.gameId}`,
      `move=${moment.moveNumber}`,
      `as=${moment.color}`,
      `phase=${moment.phase}`,
      `result=${moment.result}`,
      `opening=${moment.opening}`,
      `played=${moment.movePlayed}`,
      `type=${moment.kind}`,
      `swing=${moment.swing}p`,
    ];
    if (moment.bestAlternative) parts.push(`better=${moment.bestAlternative}`);
    return `${parts.join(' | ')}\n   fen=${moment.fen}\n   note=${moment.detail}`;
  });

  return `CITABLE MOMENTS (verified by local replay — use ONLY these for examples):\n${rows.join('\n')}`;
}
