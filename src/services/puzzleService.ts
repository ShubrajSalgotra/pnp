import { GameAnalysis } from '../types/analysis';
import { ChessGame } from '../types/game';
import {
  LichessPuzzleResponse,
  PuzzleDifficulty,
  PuzzleTrainingCategory,
  PuzzleTrainingConfig,
  TrainerPuzzle,
  WeaknessMiningProgress
} from '../types/puzzle';
import { weaknessPuzzleService } from './weaknessPuzzleService';

const LICHESS_API_BASE = 'https://lichess.org/api';
const CHESS_COM_API_BASE = 'https://api.chess.com/pub';

/** Anonymous Lichess puzzle selection is centered on 1500 + difficulty delta. */
const ANONYMOUS_BASELINE_RATING = 1500;
const DEFAULT_PUZZLE_RATING = 1500;
const STREAK_LEVEL_UP = 3;
const RATING_BUMP = 100;
const BATCH_SIZE = 12;

const CATEGORY_LABELS: Record<PuzzleTrainingCategory, string> = {
  'fix-weakness': 'Fix My Weaknesses',
  'master-opening': 'Master My Openings',
  'master-endgames': 'Master My Endgames'
};

const DIFFICULTY_DELTAS: Record<PuzzleDifficulty, number> = {
  easiest: -600,
  easier: -300,
  normal: 0,
  harder: 300,
  hardest: 600
};

export interface PuzzleSessionContext {
  analysis?: GameAnalysis | null;
  platform?: 'lichess' | 'chess.com';
  username?: string;
  games?: ChessGame[];
  rated?: boolean;
  onWeaknessProgress?: (progress: WeaknessMiningProgress) => void;
  signal?: AbortSignal;
}

class PuzzleService {
  getCategoryLabel(category: PuzzleTrainingCategory): string {
    return CATEGORY_LABELS[category];
  }

  getStreakLevelUp(): number {
    return STREAK_LEVEL_UP;
  }

  /** Preview config for category cards (no network). */
  buildTrainingConfig(category: PuzzleTrainingCategory, analysis?: GameAnalysis | null): PuzzleTrainingConfig {
    const averageAccuracy = analysis ? (analysis.whiteAccuracy + analysis.blackAccuracy) / 2 : 70;
    const fallbackRating = this.estimateRatingFromAccuracy(averageAccuracy);

    return {
      category,
      difficulty: this.difficultyForTargetRating(fallbackRating),
      angle: this.getAngleForCategory(category, analysis),
      targetRating: fallbackRating
    };
  }

  /** Session start: openings/endgames begin at the player's Chess.com / Lichess puzzle rating. */
  async createTrainingConfig(
    category: PuzzleTrainingCategory,
    context: PuzzleSessionContext = {}
  ): Promise<PuzzleTrainingConfig> {
    const preview = this.buildTrainingConfig(category, context.analysis);
    if (category === 'fix-weakness') {
      return preview;
    }

    const puzzleRating = await this.fetchPlayerPuzzleRating(context.platform, context.username, context.signal);
    const targetRating = puzzleRating ?? preview.targetRating;

    return {
      ...preview,
      targetRating,
      basePuzzleRating: puzzleRating ?? undefined,
      difficulty: this.difficultyForTargetRating(targetRating)
    };
  }

  withRaisedTargetRating(config: PuzzleTrainingConfig, bump = RATING_BUMP): PuzzleTrainingConfig {
    const targetRating = Math.min(3000, config.targetRating + bump);
    return {
      ...config,
      targetRating,
      difficulty: this.difficultyForTargetRating(targetRating)
    };
  }

  shouldRaiseDifficulty(streak: number): boolean {
    return streak > 0 && streak % STREAK_LEVEL_UP === 0;
  }

  async getNextPuzzle(
    config: PuzzleTrainingConfig,
    context: PuzzleSessionContext = {}
  ): Promise<TrainerPuzzle> {
    if (config.category === 'fix-weakness') {
      return this.getWeaknessPuzzle(context);
    }

    const lichessPuzzle = await this.fetchLichessPuzzleNearRating(config, context.signal);
    return this.toTrainerPuzzle(lichessPuzzle);
  }

  async fetchPlayerPuzzleRating(
    platform?: 'lichess' | 'chess.com',
    username?: string,
    signal?: AbortSignal
  ): Promise<number | null> {
    if (!platform || !username) return null;

    try {
      if (platform === 'chess.com') {
        const response = await fetch(
          `${CHESS_COM_API_BASE}/player/${encodeURIComponent(username)}/stats`,
          { signal }
        );
        if (!response.ok) return null;
        const data = await response.json();
        const tactics = data?.tactics;
        const last = tactics?.last?.rating;
        const highest = tactics?.highest?.rating;
        const lowest = tactics?.lowest?.rating;
        // Chess.com leaves unused tactics accounts at 400/400 — treat as missing.
        const unusedDefault = highest === 400 && lowest === 400;
        if (typeof last === 'number' && last > 0) return Math.round(last);
        if (!unusedDefault && typeof highest === 'number' && highest > 0) return Math.round(highest);
        if (!unusedDefault && typeof lowest === 'number' && lowest > 0) return Math.round(lowest);
        return null;
      }

      const response = await fetch(
        `${LICHESS_API_BASE}/user/${encodeURIComponent(username)}`,
        { signal }
      );
      if (!response.ok) return null;
      const data = await response.json();
      const rating = data?.perfs?.puzzle?.rating;
      return typeof rating === 'number' && rating > 0 ? Math.round(rating) : null;
    } catch (error) {
      if (signal?.aborted) throw error;
      console.warn('Could not load player puzzle rating:', error);
      return null;
    }
  }

  difficultyForTargetRating(targetRating: number): PuzzleDifficulty {
    const delta = targetRating - ANONYMOUS_BASELINE_RATING;
    if (delta <= -450) return 'easiest';
    if (delta <= -150) return 'easier';
    if (delta <= 150) return 'normal';
    if (delta <= 450) return 'harder';
    return 'hardest';
  }

  private estimateRatingFromAccuracy(accuracy: number): number {
    if (accuracy < 55) return ANONYMOUS_BASELINE_RATING + DIFFICULTY_DELTAS.easier;
    if (accuracy < 72) return DEFAULT_PUZZLE_RATING;
    if (accuracy < 86) return ANONYMOUS_BASELINE_RATING + DIFFICULTY_DELTAS.harder;
    return ANONYMOUS_BASELINE_RATING + DIFFICULTY_DELTAS.hardest;
  }

  private async getWeaknessPuzzle(context: PuzzleSessionContext): Promise<TrainerPuzzle> {
    if (!context.platform || !context.username) {
      throw new Error('Connect and sync a chess account first so we can mine puzzles from your recent games.');
    }

    return weaknessPuzzleService.getNextWeaknessPuzzle({
      platform: context.platform,
      username: context.username,
      games: context.games,
      rated: context.rated,
      onProgress: context.onWeaknessProgress,
      signal: context.signal
    });
  }

  private async fetchLichessPuzzleNearRating(
    config: PuzzleTrainingConfig,
    signal?: AbortSignal
  ): Promise<LichessPuzzleResponse> {
    const candidates = await this.fetchLichessPuzzleBatch(config, signal);
    if (candidates.length === 0) {
      throw new Error('Could not load a Lichess puzzle for this training target.');
    }

    let best = candidates[0];
    let bestDistance = Math.abs(best.puzzle.rating - config.targetRating);

    for (let i = 1; i < candidates.length; i += 1) {
      const distance = Math.abs(candidates[i].puzzle.rating - config.targetRating);
      if (distance < bestDistance) {
        best = candidates[i];
        bestDistance = distance;
      }
    }

    return best;
  }

  private async fetchLichessPuzzleBatch(
    config: PuzzleTrainingConfig,
    signal?: AbortSignal
  ): Promise<LichessPuzzleResponse[]> {
    const params = new URLSearchParams({
      nb: String(BATCH_SIZE),
      difficulty: config.difficulty
    });

    if (config.color) {
      params.set('color', config.color);
    }

    const response = await fetch(
      `${LICHESS_API_BASE}/puzzle/batch/${encodeURIComponent(config.angle)}?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        signal
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Lichess puzzle rate limit reached. Please wait a minute before requesting more puzzles.');
      }

      // Fall back to single-puzzle endpoint if batch fails.
      const single = await this.fetchLichessPuzzle(config, signal);
      return [single];
    }

    const data = await response.json();
    const puzzles = Array.isArray(data?.puzzles) ? data.puzzles : [];
    return puzzles.filter(
      (item: LichessPuzzleResponse) => item?.puzzle?.id && typeof item.puzzle.rating === 'number'
    );
  }

  private async fetchLichessPuzzle(
    config: PuzzleTrainingConfig,
    signal?: AbortSignal
  ): Promise<LichessPuzzleResponse> {
    const params = new URLSearchParams({
      angle: config.angle,
      difficulty: config.difficulty
    });

    if (config.color) {
      params.set('color', config.color);
    }

    const response = await fetch(`${LICHESS_API_BASE}/puzzle/next?${params.toString()}`, {
      headers: {
        Accept: 'application/json'
      },
      signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Lichess puzzle rate limit reached. Please wait a minute before requesting more puzzles.');
      }

      throw new Error('Could not load a Lichess puzzle for this training target.');
    }

    return response.json();
  }

  private toTrainerPuzzle(response: LichessPuzzleResponse): TrainerPuzzle {
    return {
      id: response.puzzle.id,
      fen: '',
      solution: response.puzzle.solution,
      rating: response.puzzle.rating,
      themes: response.puzzle.themes,
      lichessPgn: response.game.pgn,
      lichessGameId: response.game.id
    };
  }

  private getAngleForCategory(category: PuzzleTrainingCategory, analysis?: GameAnalysis | null): string {
    switch (category) {
      case 'fix-weakness':
        return analysis ? 'from your games' : 'your recent games';
      case 'master-opening':
        return 'opening';
      case 'master-endgames':
        return 'endgame';
      default:
        return 'mix';
    }
  }
}

export const puzzleService = new PuzzleService();
