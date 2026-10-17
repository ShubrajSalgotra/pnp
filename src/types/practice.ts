
export interface PracticePuzzle {
  puzzleId: string;

  fen: string;

  toMove: "white" | "black";

  requiredSolutionUci: string[];

  ratedMoves?: string[];

  estRating: number;

  hint1?: string;

  hint2?: string;

  keyIdea?: string;

  source?: string;

  chapter?: string;

  level?: string;

  updatedAt?: unknown;
}

export interface PracticeStats {
  attempted: number;

  solved: number;

  accuracy: number;

  points: number;

  currentStreak: number;

  bestStreak: number;

  dailyGoal: number;

  dailyCompleted: number;

  lastSolvedDate: string | null;

  updatedAt?: unknown;
}

export interface LeaderboardEntry {
  userId: string;

  displayName: string;

  rating: number;

  league: "Beginner" | "Intermediate" | "Advanced";

  points: number;

  solved: number;

  updatedAt?: unknown;
}

export interface PracticeResult {
  stats: PracticeStats;

  pointsEarned: number;

  streakBonus: number;

  difficultyBonus: number;

  weeklyRank: number | null;
}
