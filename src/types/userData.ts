import { PuzzleTrainingCategory } from './puzzle';

export type ThemePreference = 'light' | 'dark';

export interface UserPreferences {
  theme: ThemePreference;
}

export interface PuzzleProgress {
  userId: string;
  solved: number;
  streak: number;
  bestStreak: number;
  lastCategory: PuzzleTrainingCategory | null;
  targetRating: number | null;
  updatedAt: string;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'light',
};

export const DEFAULT_PUZZLE_PROGRESS = (userId: string): PuzzleProgress => ({
  userId,
  solved: 0,
  streak: 0,
  bestStreak: 0,
  lastCategory: null,
  targetRating: null,
  updatedAt: new Date().toISOString(),
});
