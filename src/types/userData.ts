import { PuzzleTrainingCategory } from './puzzle';
import { ReviewAnalysis } from '../utils/gameReviewAnalysis';

export type ThemePreference = 'light' | 'dark';

export interface UserPreferences {
  theme: ThemePreference;
}

export interface PuzzleProgress {
  userId: string;
  solved: number;
  failed: number;
  streak: number;
  bestStreak: number;
  lastCategory: PuzzleTrainingCategory | null;
  targetRating: number | null;
  byCategory?: Partial<Record<PuzzleTrainingCategory, number>>;
  updatedAt: string;
}

export interface PuzzleHistoryEntry {
  id: string;
  userId: string;
  puzzleId: string;
  category: PuzzleTrainingCategory | null;
  rating: number | null;
  solved: boolean;
  streakAfter: number;
  createdAt: string;
}

export interface PlayerStatsSnapshot {
  userId: string;
  platform: 'lichess' | 'chess.com' | null;
  username: string | null;
  ratings: {
    rapid: number | null;
    blitz: number | null;
    bullet: number | null;
    puzzle: number | null;
  };
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  gamesCount: number;
  averageAccuracy: number | null;
  lastReportId: string | null;
  updatedAt: string;
}

export interface StoredGameReview {
  gameId: string;
  userId: string;
  depth: number;
  analyzedAt: string;
  whiteAccuracy: number;
  blackAccuracy: number;
  analysis: ReviewAnalysis;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'light',
};

export const DEFAULT_PUZZLE_PROGRESS = (userId: string): PuzzleProgress => ({
  userId,
  solved: 0,
  failed: 0,
  streak: 0,
  bestStreak: 0,
  lastCategory: null,
  targetRating: null,
  byCategory: {},
  updatedAt: new Date().toISOString(),
});
