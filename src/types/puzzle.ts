export type PuzzleTrainingCategory =
  | 'fix-weakness'
  | 'learn-mistakes'
  | 'master-opening'
  | 'master-endgames';

export type PuzzleDifficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest';

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

export interface PuzzleTrainingConfig {
  category: PuzzleTrainingCategory;
  angle: string;
  difficulty: PuzzleDifficulty;
  color?: 'white' | 'black';
}
