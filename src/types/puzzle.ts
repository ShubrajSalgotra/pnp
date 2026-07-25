import { ReviewClassification } from '../utils/gameReviewAnalysis';

export type PuzzleTrainingCategory =
  | 'fix-weakness'
  | 'master-opening'
  | 'master-endgames';

export type PuzzleDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

export type WeaknessSelectionReason = 'long-think' | 'blunder' | 'miss' | 'mistake';

export interface LichessPuzzleGame {
  id: string;
  pgn: string;
  clock?: string;
}

export interface LichessPuzzle {
  id: string;
  rating: number;
  plays: number;
  initialPly: number;
  solution: string[];
  themes: string[];
}

export interface LichessPuzzleResponse {
  game: LichessPuzzleGame;
  puzzle: LichessPuzzle;
}

export interface WeaknessPuzzleSource {
  gameId: string;
  gameUrl?: string;
  opponent: string;
  opening?: string;
  date: string;
  site: 'lichess' | 'chess.com';
  moveNumber: number;
  playerColor: 'white' | 'black';
  playedMoveSan: string;
  playedMoveUci: string;
  classification: ReviewClassification;
  timeSpentSeconds?: number;
  centipawnLoss: number;
  reasons: WeaknessSelectionReason[];
  whySelected: string;
}

export interface TrainerPuzzle {
  id: string;
  /** Starting FEN. Empty when `lichessPgn` should be loaded instead. */
  fen: string;
  solution: string[];
  rating?: number;
  themes: string[];
  /** Lichess cloud puzzles provide a truncated PGN up to the start position. */
  lichessPgn?: string;
  lichessGameId?: string;
  /** Present for Fix My Weaknesses puzzles mined from the user's games. */
  weakness?: WeaknessPuzzleSource;
}

export interface PuzzleTrainingConfig {
  category: PuzzleTrainingCategory;
  angle: string;
  difficulty: PuzzleDifficulty;
  color?: 'white' | 'black';
  /** Desired Lichess puzzle rating for openings/endgames. */
  targetRating: number;
  /** Player puzzle rating used to start the session (Chess.com tactics / Lichess puzzle). */
  basePuzzleRating?: number;
}

export interface WeaknessMiningProgress {
  phase: 'loading-games' | 'scanning' | 'complete';
  gamesTotal: number;
  gamesDone: number;
  candidatesTotal: number;
  candidatesDone: number;
  puzzlesFound: number;
  message: string;
}
