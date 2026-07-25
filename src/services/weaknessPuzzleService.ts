import { ChessGame } from '../types/game';
import {
  TrainerPuzzle,
  WeaknessMiningProgress,
  WeaknessPuzzleSource,
  WeaknessSelectionReason
} from '../types/puzzle';
import {
  analyzeCandidateMove,
  classificationMeta,
  extractPlayerMoveTimings,
  formatSeconds,
  isImplausibleFen,
  PlayerMoveTiming,
  startingClockFromTimeControl
} from '../utils/gameReviewAnalysis';
import { gameImportService } from './gameImport';
import { stockfishService } from './stockfishService';

const GAME_LIMIT = 20;
const SCAN_DEPTH = 10;
const MAX_CANDIDATES_PER_GAME = 7;
const MAX_PUZZLES = 36;
const MIN_PLY = 8;

export interface WeaknessMiningRequest {
  platform: 'lichess' | 'chess.com';
  username: string;
  /** Optional cached games; re-imported when missing clocks or too few. */
  games?: ChessGame[];
  rated?: boolean;
  onProgress?: (progress: WeaknessMiningProgress) => void;
  signal?: AbortSignal;
}

interface ScoredCandidate {
  puzzle: TrainerPuzzle;
  score: number;
}

class WeaknessPuzzleService {
  private cache = new Map<string, TrainerPuzzle[]>();
  private cursor = new Map<string, number>();

  private cacheKey(platform: string, username: string) {
    return `${platform}:${username.trim().toLowerCase()}`;
  }

  clearCache(platform?: string, username?: string) {
    if (platform && username) {
      const key = this.cacheKey(platform, username);
      this.cache.delete(key);
      this.cursor.delete(key);
      return;
    }
    this.cache.clear();
    this.cursor.clear();
  }

  async getNextWeaknessPuzzle(request: WeaknessMiningRequest): Promise<TrainerPuzzle> {
    const key = this.cacheKey(request.platform, request.username);
    let puzzles = this.cache.get(key);

    if (!puzzles || puzzles.length === 0) {
      puzzles = await this.mineWeaknessPuzzles(request);
      this.cache.set(key, puzzles);
      this.cursor.set(key, 0);
    }

    if (puzzles.length === 0) {
      throw new Error(
        'No weakness puzzles found in your last 20 games. Try games with clock data, or play more decisive middlegame mistakes.'
      );
    }

    const index = this.cursor.get(key) || 0;
    const puzzle = puzzles[index % puzzles.length];
    this.cursor.set(key, index + 1);
    return puzzle;
  }

  async mineWeaknessPuzzles(request: WeaknessMiningRequest): Promise<TrainerPuzzle[]> {
    const { username, onProgress, signal } = request;

    onProgress?.({
      phase: 'loading-games',
      gamesTotal: GAME_LIMIT,
      gamesDone: 0,
      candidatesTotal: 0,
      candidatesDone: 0,
      puzzlesFound: 0,
      message: 'Loading your last 20 games (with clocks)…'
    });

    const games = await this.resolveGames(request);
    if (signal?.aborted) throw new Error('Weakness analysis cancelled');

    if (games.length === 0) {
      throw new Error('No recent games found for this account.');
    }

    const candidatePlan: Array<{
      game: ChessGame;
      move: PlayerMoveTiming;
      thinkThreshold: number;
    }> = [];

    for (const game of games) {
      const moves = extractPlayerMoveTimings(game, username);
      const thinkThreshold = this.longThinkThresholdSeconds(game, moves);
      const selected = this.selectCandidateMoves(moves, thinkThreshold);
      selected.forEach(move => candidatePlan.push({ game, move, thinkThreshold }));
    }

    onProgress?.({
      phase: 'scanning',
      gamesTotal: games.length,
      gamesDone: 0,
      candidatesTotal: candidatePlan.length,
      candidatesDone: 0,
      puzzlesFound: 0,
      message: `Evaluating ${candidatePlan.length} critical moments with Stockfish…`
    });

    await stockfishService.newGame();

    const scored: ScoredCandidate[] = [];
    let gamesDone = 0;
    let lastGameId: string | null = null;

    for (let i = 0; i < candidatePlan.length; i += 1) {
      if (signal?.aborted) throw new Error('Weakness analysis cancelled');

      const { game, move, thinkThreshold } = candidatePlan[i];
      if (lastGameId !== game.id) {
        if (lastGameId !== null) gamesDone += 1;
        lastGameId = game.id;
      }

      try {
        const analysis = await analyzeCandidateMove({
          fenBefore: move.fenBefore,
          played: {
            from: move.from,
            to: move.to,
            promotion: move.promotion,
            san: move.san,
            color: move.color
          },
          moveIndex: move.moveIndex,
          moveNumber: move.moveNumber,
          depth: SCAN_DEPTH,
          timeSpentSeconds: move.timeSpentSeconds
        });

        const built = this.buildPuzzleIfSelected(game, username, analysis, thinkThreshold);
        if (built) scored.push(built);
      } catch (error) {
        console.warn('Skipped weakness candidate', game.id, move.moveNumber, error);
      }

      onProgress?.({
        phase: 'scanning',
        gamesTotal: games.length,
        gamesDone: Math.min(games.length, gamesDone + (lastGameId ? 1 : 0)),
        candidatesTotal: candidatePlan.length,
        candidatesDone: i + 1,
        puzzlesFound: scored.length,
        message: `Analyzing ${game.white.name} vs ${game.black.name} · move ${move.moveNumber}`
      });
    }

    scored.sort((a, b) => b.score - a.score);
    const puzzles = scored.slice(0, MAX_PUZZLES).map(item => item.puzzle);

    onProgress?.({
      phase: 'complete',
      gamesTotal: games.length,
      gamesDone: games.length,
      candidatesTotal: candidatePlan.length,
      candidatesDone: candidatePlan.length,
      puzzlesFound: puzzles.length,
      message: puzzles.length
        ? `Found ${puzzles.length} positions from your recent games.`
        : 'Finished scanning — no qualifying weakness positions found.'
    });

    return puzzles;
  }

  private async resolveGames(request: WeaknessMiningRequest): Promise<ChessGame[]> {
    const cached = (request.games || []).slice(0, GAME_LIMIT);
    const hasUsefulClocks = cached.some(game => /\[%clk\s+/i.test(game.pgn));

    // Prefer a fresh import so Lichess PGNs include clock comments.
    try {
      const imported = await gameImportService.importGames({
        platform: request.platform,
        username: request.username,
        count: GAME_LIMIT,
        rated: request.rated
      });
      if (imported.games.length > 0) return imported.games.slice(0, GAME_LIMIT);
    } catch (error) {
      console.warn('Weakness puzzle import failed, falling back to cached games', error);
    }

    if (cached.length > 0) {
      if (!hasUsefulClocks) {
        console.warn('Cached games lack clock data; blunder detection will drive selection.');
      }
      return cached;
    }

    return [];
  }

  private longThinkThresholdSeconds(game: ChessGame, moves: PlayerMoveTiming[]): number {
    const spends = moves
      .map(move => move.timeSpentSeconds)
      .filter((value): value is number => typeof value === 'number' && value > 0)
      .sort((a, b) => a - b);

    if (spends.length >= 3) {
      const p75 = spends[Math.floor(spends.length * 0.75)];
      return Math.max(5, p75);
    }

    const start = startingClockFromTimeControl(game.timeControl);
    // Imported controls may be minutes (`10+0`) or seconds (`600+0`).
    if (start === undefined) return 15;
    if (start <= 3 || (start > 60 && start <= 180)) return 5;
    if (start <= 10 || (start > 180 && start <= 600)) return 12;
    return 20;
  }

  private selectCandidateMoves(
    moves: PlayerMoveTiming[],
    threshold: number
  ): PlayerMoveTiming[] {
    const eligible = moves.filter(move => move.moveIndex >= MIN_PLY);
    if (eligible.length === 0) return [];

    const withClocks = eligible.filter(move => typeof move.timeSpentSeconds === 'number');

    const selected: PlayerMoveTiming[] = [];
    const seen = new Set<number>();

    const push = (move: PlayerMoveTiming) => {
      if (seen.has(move.moveIndex) || selected.length >= MAX_CANDIDATES_PER_GAME) return;
      seen.add(move.moveIndex);
      selected.push(move);
    };

    withClocks
      .filter(move => (move.timeSpentSeconds || 0) >= threshold)
      .sort((a, b) => (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0))
      .forEach(push);

    // Always include the longest thinks even if below absolute threshold.
    withClocks
      .slice()
      .sort((a, b) => (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0))
      .slice(0, 3)
      .forEach(push);

    // Without clocks (or to catch quick blunders), sample middlegame moves.
    if (selected.length < MAX_CANDIDATES_PER_GAME) {
      const mid = eligible.filter(move => move.moveIndex >= 12 && move.moveIndex <= 60);
      const step = Math.max(1, Math.floor(mid.length / Math.max(1, MAX_CANDIDATES_PER_GAME - selected.length)));
      for (let i = 0; i < mid.length && selected.length < MAX_CANDIDATES_PER_GAME; i += step) {
        push(mid[i]);
      }
    }

    return selected;
  }

  private buildPuzzleIfSelected(
    game: ChessGame,
    username: string,
    analysis: Awaited<ReturnType<typeof analyzeCandidateMove>>,
    thinkThreshold: number
  ): ScoredCandidate | null {
    if (!analysis.bestMoveUci || analysis.bestMoveUci === analysis.playedUci) {
      return null;
    }

    if (isImplausibleFen(analysis.fenBefore)) {
      return null;
    }

    const timeSpent = analysis.timeSpentSeconds;
    const longThink = typeof timeSpent === 'number' && timeSpent >= thinkThreshold;
    const isBlunder = analysis.classification === 'blunder';
    const isMiss = analysis.classification === 'miss';
    const isMistake = analysis.classification === 'mistake';

    // Keep: blunder/miss, or long thinks that still missed the best move meaningfully.
    const keep =
      isBlunder ||
      isMiss ||
      (longThink && (isMistake || analysis.centipawnLoss >= 40));

    if (!keep) return null;

    const reasons: WeaknessSelectionReason[] = [];
    if (longThink) reasons.push('long-think');
    if (isBlunder) reasons.push('blunder');
    if (isMiss) reasons.push('miss');
    if (isMistake) reasons.push('mistake');

    const normalizedUser = username.trim().toLowerCase();
    const playsWhite = game.white.name.trim().toLowerCase() === normalizedUser;
    const opponent = playsWhite ? game.black.name : game.white.name;
    const playerColor = playsWhite ? 'white' : 'black';

    const whySelected = this.buildWhySelected({
      reasons,
      classification: analysis.classification,
      timeSpentSeconds: timeSpent,
      playedSan: analysis.playedSan,
      centipawnLoss: analysis.centipawnLoss
    });

    const source: WeaknessPuzzleSource = {
      gameId: game.id,
      gameUrl: game.url,
      opponent,
      opening: game.opening?.name,
      date: game.date,
      site: game.site,
      moveNumber: analysis.moveNumber,
      playerColor,
      playedMoveSan: analysis.playedSan,
      playedMoveUci: analysis.playedUci,
      classification: analysis.classification,
      timeSpentSeconds: timeSpent,
      centipawnLoss: analysis.centipawnLoss,
      reasons,
      whySelected
    };

    let score = analysis.centipawnLoss;
    if (isBlunder) score += 120;
    if (isMiss) score += 100;
    if (isMistake) score += 40;
    if (longThink) score += Math.min(timeSpent || 0, 90);

    const themes = [
      analysis.classification,
      ...(longThink ? ['long-think'] : []),
      game.opening?.eco || game.opening?.name || 'from-your-games'
    ].filter(Boolean) as string[];

    const puzzle: TrainerPuzzle = {
      id: `weakness-${game.id}-${analysis.moveIndex}`,
      fen: analysis.fenBefore,
      solution: [analysis.bestMoveUci],
      rating: Math.round(
        ((playsWhite ? game.white.rating : game.black.rating) || 1200) +
          Math.min(analysis.centipawnLoss, 300) / 3
      ),
      themes,
      weakness: source
    };

    return { puzzle, score };
  }

  private buildWhySelected(args: {
    reasons: WeaknessSelectionReason[];
    classification: WeaknessPuzzleSource['classification'];
    timeSpentSeconds?: number;
    playedSan: string;
    centipawnLoss: number;
  }): string {
    const label = classificationMeta[args.classification].label;
    const think =
      typeof args.timeSpentSeconds === 'number'
        ? ` after thinking ${formatSeconds(args.timeSpentSeconds)}`
        : '';
    const loss = args.centipawnLoss >= 40
      ? ` (~${Math.round(args.centipawnLoss)} cp loss)`
      : '';

    if (args.reasons.includes('blunder') || args.reasons.includes('miss')) {
      return `${label}${think}: you played ${args.playedSan}${loss}. Find the stronger move.`;
    }

    if (args.reasons.includes('long-think')) {
      return `Long think${think}: you spent extra time and still missed the best move with ${args.playedSan}${loss}.`;
    }

    return `${label}: you played ${args.playedSan}${loss}. Replay the critical moment.`;
  }
}

export const weaknessPuzzleService = new WeaknessPuzzleService();
