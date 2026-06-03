import { GameAnalysis } from '../types/analysis';
import {
  LichessPuzzleResponse,
  PuzzleDifficulty,
  PuzzleTrainingCategory,
  PuzzleTrainingConfig
} from '../types/puzzle';

const LICHESS_API_BASE = 'https://lichess.org/api';

const CATEGORY_LABELS: Record<PuzzleTrainingCategory, string> = {
  'fix-weakness': 'Fix My Weaknesses',
  'learn-mistakes': 'Learn From My Mistakes',
  'master-opening': 'Master My Openings',
  'master-endgames': 'Master My Endgames'
};

class PuzzleService {
  getCategoryLabel(category: PuzzleTrainingCategory): string {
    return CATEGORY_LABELS[category];
  }

  buildTrainingConfig(category: PuzzleTrainingCategory, analysis?: GameAnalysis | null): PuzzleTrainingConfig {
    const averageAccuracy = analysis ? (analysis.whiteAccuracy + analysis.blackAccuracy) / 2 : 70;
    const difficulty = this.getDifficultyForAccuracy(averageAccuracy);

    return {
      category,
      difficulty,
      angle: this.getAngleForCategory(category, analysis)
    };
  }

  async getNextPuzzle(config: PuzzleTrainingConfig): Promise<LichessPuzzleResponse> {
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
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Lichess puzzle rate limit reached. Please wait a minute before requesting more puzzles.');
      }

      throw new Error('Could not load a Lichess puzzle for this training target.');
    }

    return response.json();
  }

  private getDifficultyForAccuracy(accuracy: number): PuzzleDifficulty {
    if (accuracy < 55) return 'easier';
    if (accuracy < 72) return 'normal';
    if (accuracy < 86) return 'harder';
    return 'hardest';
  }

  private getAngleForCategory(category: PuzzleTrainingCategory, analysis?: GameAnalysis | null): string {
    switch (category) {
      case 'fix-weakness':
        return analysis ? this.getWeaknessAngle(analysis) : 'mix';
      case 'learn-mistakes':
        return 'advantage';
      case 'master-opening':
        return 'opening';
      case 'master-endgames':
        return 'endgame';
      default:
        return 'mix';
    }
  }

  private getWeaknessAngle(analysis: GameAnalysis): string {
    const blunders = analysis.totalMistakes.white.blunders + analysis.totalMistakes.black.blunders;
    const mistakes = analysis.totalMistakes.white.mistakes + analysis.totalMistakes.black.mistakes;
    const inaccuracies = analysis.totalMistakes.white.inaccuracies + analysis.totalMistakes.black.inaccuracies;

    if (blunders >= Math.max(mistakes, inaccuracies)) return 'hangingPiece';
    if (mistakes >= inaccuracies) return 'defensiveMove';
    return 'advantage';
  }
}

export const puzzleService = new PuzzleService();
