export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'child' | 'parent' | 'coach' | 'admin';
  isPremium: boolean;
  createdAt: Date;
}

export interface Game {
  id: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  timeControl: string;
  opening: string;
  analysis?: GameAnalysis;
}

export interface GameAnalysis {
  id: string;
  gameId: string;
  engine: 'stockfish' | 'lc0' | 'komodo';
  moves: MoveAnalysis[];
  accuracy: {
    white: number;
    black: number;
  };
  mistakes: Mistake[];
  createdAt: Date;
}

export interface MoveAnalysis {
  moveNumber: number;
  move: string;
  evaluation: number;
  bestMove?: string;
  classification: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  centipawnLoss: number;
}

export interface Mistake {
  moveNumber: number;
  type: 'tactical' | 'positional' | 'endgame' | 'opening';
  severity: 'inaccuracy' | 'mistake' | 'blunder';
  explanation: string;
  suggestion: string;
}

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  explanation?: string;
  gameId?: string;
}

export interface PlayerProfile {
  userId: string;
  playingStyle: 'aggressive' | 'tactical' | 'positional';
  strengths: string[];
  weaknesses: string[];
  averageAccuracy: number;
  preferredOpenings: string[];
  improvementAreas: string[];
}

export interface WeeklyReport {
  id: string;
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  gamesPlayed: number;
  averageAccuracy: number;
  improvementAreas: string[];
  achievements: string[];
  recommendedPuzzles: Puzzle[];
  openingRecommendations: string[];
}

// Re-export report types
export * from './report';