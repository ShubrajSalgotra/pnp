import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "./firebase";

import type {
  LeaderboardEntry,
  PracticePuzzle,
  PracticeResult,
  PracticeStats,
} from "../types/practice";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_DAILY_GOAL = 5;

const BASE_POINTS = 10;

const RECENT_HISTORY_LIMIT = 50;

/* =========================================================
   DATE HELPERS
========================================================= */

function getDateKey(date = new Date()): string {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getYesterdayKey(): string {
  const date = new Date();

  date.setDate(date.getDate() - 1);

  return getDateKey(date);
}

/* =========================================================
   LEAGUE
========================================================= */

export function getPracticeLeague(
  rating: number,
): "Beginner" | "Intermediate" | "Advanced" {
  if (rating < 1000) {
    return "Beginner";
  }

  if (rating < 1500) {
    return "Intermediate";
  }

  return "Advanced";
}

/* =========================================================
   DEFAULT STATS
========================================================= */

function getDefaultStats(): PracticeStats {
  return {
    attempted: 0,
    solved: 0,
    accuracy: 0,
    points: 0,
    currentStreak: 0,
    bestStreak: 0,
    dailyGoal: DEFAULT_DAILY_GOAL,
    dailyCompleted: 0,
    lastSolvedDate: null,
  };
}

/* =========================================================
   LOAD PRACTICE STATS
========================================================= */

export async function getPracticeStats(
  userId: string,
): Promise<PracticeStats> {
  const statsRef = doc(
    db,
    "users",
    userId,
    "practiceStats",
    "summary",
  );

  const snapshot = await getDoc(statsRef);

  if (!snapshot.exists()) {
    return getDefaultStats();
  }

  return {
    ...getDefaultStats(),
    ...snapshot.data(),
  } as PracticeStats;
}

/* =========================================================
   LOAD PUZZLE RATING

   Existing dashboard saves live ratings at:

   users/{uid}/stats/current

   with:

   ratings.puzzle
========================================================= */

export async function getUserPuzzleRating(
  userId: string,
): Promise<number> {
  const statsRef = doc(
    db,
    "users",
    userId,
    "stats",
    "current",
  );

  const snapshot = await getDoc(statsRef);

  if (!snapshot.exists()) {
    return 1200;
  }

  const data = snapshot.data();

  const rating = data?.ratings?.puzzle;

  if (
    typeof rating === "number" &&
    Number.isFinite(rating) &&
    rating > 0
  ) {
    return Math.round(rating);
  }

  return 1200;
}

/* =========================================================
   LOAD RECENT PRACTICE HISTORY
========================================================= */

export async function getRecentPracticePuzzleIds(
  userId: string,
): Promise<string[]> {
  const historyRef = collection(
    db,
    "users",
    userId,
    "practiceHistory",
  );

  const historyQuery = query(
    historyRef,
    orderBy("completedAt", "desc"),
    limit(RECENT_HISTORY_LIMIT),
  );

  const snapshot = await getDocs(historyQuery);

  return snapshot.docs
    .map(
      (document) =>
        document.data()?.puzzleId,
    )
    .filter(
      (value): value is string =>
        typeof value === "string",
    );
}

/* =========================================================
   LOAD ALL PRACTICE PUZZLES
========================================================= */

export async function getPracticePuzzles(): Promise<
  PracticePuzzle[]
> {
  const puzzlesRef = collection(
    db,
    "puzzles",
  );

  const snapshot = await getDocs(puzzlesRef);

  const puzzles: PracticePuzzle[] = [];

  snapshot.docs.forEach((documentSnapshot) => {
    const data = documentSnapshot.data();

    /*
     * requiredSolutionUci
     *
     * Firestore can return unknown values,
     * so explicitly keep only strings.
     */
    const requiredSolution = Array.isArray(
      data.requiredSolutionUci,
    )
      ? data.requiredSolutionUci.filter(
          (move): move is string =>
            typeof move === "string",
        )
      : [];

    /*
     * ratedMoves
     *
     * Keep only valid string moves.
     */
    const ratedMoves = Array.isArray(
      data.ratedMoves,
    )
      ? data.ratedMoves.filter(
          (move): move is string =>
            typeof move === "string",
        )
      : [];

    /*
     * Normalize side to move.
     */
    const toMove: "white" | "black" =
      data.toMove === "black"
        ? "black"
        : "white";

    /*
     * Normalize estimated rating.
     */
    const estRating = Number(
      data.estRating,
    );

    /*
     * Ignore malformed Firestore documents.
     */
    if (
      !documentSnapshot.id ||
      typeof data.fen !== "string" ||
      !Number.isFinite(estRating) ||
      requiredSolution.length === 0
    ) {
      return;
    }

    const puzzle: PracticePuzzle = {
      puzzleId:
        typeof data.puzzleId === "string"
          ? data.puzzleId
          : documentSnapshot.id,

      fen: data.fen,

      toMove,

      requiredSolutionUci:
        requiredSolution,

      ratedMoves,

      estRating,

      hint1:
        typeof data.hint1 === "string"
          ? data.hint1
          : undefined,

      hint2:
        typeof data.hint2 === "string"
          ? data.hint2
          : undefined,

      keyIdea:
        typeof data.keyIdea === "string"
          ? data.keyIdea
          : undefined,

      source:
        typeof data.source === "string"
          ? data.source
          : undefined,

      chapter:
        typeof data.chapter === "string"
          ? data.chapter
          : undefined,

      level:
        typeof data.level === "string"
          ? data.level
          : undefined,

      updatedAt: data.updatedAt,
    };

    puzzles.push(puzzle);
  });

  return puzzles;
}

/* =========================================================
   WEIGHTED RANDOM PUZZLE SELECTION
========================================================= */

export function selectPracticePuzzle(
  puzzles: PracticePuzzle[],
  userRating: number,
  recentPuzzleIds: string[],
  usedPuzzleIds: string[] = [],
): PracticePuzzle | null {
  const recentSet = new Set(
    recentPuzzleIds,
  );

  const usedSet = new Set(
    usedPuzzleIds,
  );

  /*
   * Only puzzles above the student's rating.
   */
  let eligible = puzzles.filter(
    (puzzle) =>
      puzzle.estRating > userRating &&
      !usedSet.has(puzzle.puzzleId),
  );

  /*
   * Prefer puzzles not recently solved.
   */
  const freshEligible =
    eligible.filter(
      (puzzle) =>
        !recentSet.has(
          puzzle.puzzleId,
        ),
    );

  if (freshEligible.length > 0) {
    eligible = freshEligible;
  }

  /*
   * If everything is exhausted, allow
   * recent puzzles again but still respect
   * rating.
   */
  if (eligible.length === 0) {
    eligible = puzzles.filter(
      (puzzle) =>
        puzzle.estRating > userRating &&
        !usedSet.has(puzzle.puzzleId),
    );
  }

  if (eligible.length === 0) {
    return null;
  }

  /*
   * Weight:
   *
   * close to rating = higher probability
   * much harder = lower probability
   *
   * But harder puzzles still have a chance.
   */
  const weighted = eligible.map(
    (puzzle) => {
      const difference =
        puzzle.estRating -
        userRating;

      let weight = 1;

      if (difference <= 100) {
        weight = 8;
      } else if (difference <= 200) {
        weight = 6;
      } else if (difference <= 350) {
        weight = 4;
      } else if (difference <= 500) {
        weight = 2.5;
      } else {
        weight = 1;
      }

      return {
        puzzle,
        weight,
      };
    },
  );

  const totalWeight =
    weighted.reduce(
      (sum, item) =>
        sum + item.weight,
      0,
    );

  let random =
    Math.random() *
    totalWeight;

  for (const item of weighted) {
    random -= item.weight;

    if (random <= 0) {
      return item.puzzle;
    }
  }

  return weighted[
    weighted.length - 1
  ].puzzle;
}

/* =========================================================
   POINT CALCULATION
========================================================= */

function calculateDifficultyBonus(
  puzzleRating: number,
  userRating: number,
): number {
  const difference =
    puzzleRating -
    userRating;

  if (difference >= 500) {
    return 15;
  }

  if (difference >= 350) {
    return 10;
  }

  if (difference >= 200) {
    return 5;
  }

  return 0;
}

function calculateStreakBonus(
  nextStreak: number,
): number {
  if (nextStreak >= 10) {
    return 25;
  }

  if (nextStreak >= 5) {
    return 10;
  }

  if (nextStreak >= 3) {
    return 5;
  }

  return 0;
}

/* =========================================================
   RECORD COMPLETED PUZZLE

   IMPORTANT:

   Stats + history + leaderboard are written
   inside one Firestore transaction.
========================================================= */

export async function recordPracticeResult(
  userId: string,
  puzzle: PracticePuzzle,
  wrongAttempts: number,
  hintsUsed: number,
): Promise<PracticeResult> {
  const statsRef = doc(
    db,
    "users",
    userId,
    "practiceStats",
    "summary",
  );

  const historyRef = doc(
    collection(
      db,
      "users",
      userId,
      "practiceHistory",
    ),
  );

  const profileRef = doc(
    db,
    "users",
    userId,
  );

  const oldStats =
    await getPracticeStats(userId);

  const userPuzzleRating =
    await getUserPuzzleRating(userId);

  /*
   * Read display name separately.
   */
  const profileSnapshot =
    await getDoc(profileRef);

  const profileData =
    profileSnapshot.data();

  const displayName =
    typeof profileData?.displayName ===
      "string" &&
    profileData.displayName.trim()
      ? profileData.displayName.trim()
      : "Player";

  const league =
    getPracticeLeague(
      userPuzzleRating,
    );

  const today = getDateKey();

  const yesterday =
    getYesterdayKey();

  /*
   * Calculate streak.
   */
  let nextStreak =
    oldStats.currentStreak;

  if (
    oldStats.lastSolvedDate === today
  ) {
    /*
     * Solving multiple puzzles on the
     * same day does NOT increase the
     * day streak.
     */
    nextStreak =
      oldStats.currentStreak;
  } else if (
    oldStats.lastSolvedDate ===
    yesterday
  ) {
    nextStreak =
      oldStats.currentStreak + 1;
  } else {
    nextStreak = 1;
  }

  const streakBonus =
    calculateStreakBonus(
      nextStreak,
    );

  const difficultyBonus =
    calculateDifficultyBonus(
      puzzle.estRating,
      userPuzzleRating,
    );

  const pointsEarned =
    BASE_POINTS +
    difficultyBonus +
    streakBonus;

  const nextAttempted =
    oldStats.attempted + 1;

  const nextSolved =
    oldStats.solved + 1;

  const nextAccuracy =
    nextAttempted > 0
      ? Math.round(
          (nextSolved /
            nextAttempted) *
            100,
        )
      : 0;

  const nextBestStreak =
    Math.max(
      oldStats.bestStreak,
      nextStreak,
    );

  const previousDailyCompleted =
    oldStats.lastSolvedDate === today
      ? oldStats.dailyCompleted
      : 0;

  const nextDailyCompleted =
    previousDailyCompleted + 1;

  const nextPoints =
    oldStats.points +
    pointsEarned;

  const nextStats: PracticeStats = {
    attempted: nextAttempted,
    solved: nextSolved,
    accuracy: nextAccuracy,
    points: nextPoints,
    currentStreak: nextStreak,
    bestStreak: nextBestStreak,
    dailyGoal:
      oldStats.dailyGoal ||
      DEFAULT_DAILY_GOAL,
    dailyCompleted:
      nextDailyCompleted,
    lastSolvedDate: today,
  };

  /*
   * Leaderboard references.
   */
  const weeklyRef = doc(
    db,
    "leaderboards",
    "weekly",
    "entries",
    userId,
  );

  const monthlyRef = doc(
    db,
    "leaderboards",
    "monthly",
    "entries",
    userId,
  );

  const allTimeRef = doc(
    db,
    "leaderboards",
    "allTime",
    "entries",
    userId,
  );

  let weeklyRank: number | null =
    null;

  await runTransaction(
    db,
    async (transaction) => {
      /*
       * Read all leaderboard entries
       * before writes.
       */
      const [
        weeklySnapshot,
        monthlySnapshot,
        allTimeSnapshot,
      ] = await Promise.all([
        transaction.get(weeklyRef),
        transaction.get(monthlyRef),
        transaction.get(allTimeRef),
      ]);

      const oldWeekly =
        weeklySnapshot.exists()
          ? weeklySnapshot.data()
          : {};

      const oldMonthly =
        monthlySnapshot.exists()
          ? monthlySnapshot.data()
          : {};

      const oldAllTime =
        allTimeSnapshot.exists()
          ? allTimeSnapshot.data()
          : {};

      const weeklyPoints =
        Number(
          oldWeekly.points || 0,
        ) + pointsEarned;

      const monthlyPoints =
        Number(
          oldMonthly.points || 0,
        ) + pointsEarned;

      const allTimePoints =
        Number(
          oldAllTime.points || 0,
        ) + pointsEarned;

      /*
       * Practice stats.
       */
      transaction.set(
        statsRef,
        {
          ...nextStats,
          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      /*
       * Practice history.
       */
      transaction.set(historyRef, {
        puzzleId:
          puzzle.puzzleId,

        puzzleRating:
          puzzle.estRating,

        startedAt:
          serverTimestamp(),

        completedAt:
          serverTimestamp(),

        solved: true,

        wrongAttempts,

        hintsUsed,

        pointsEarned,

        difficultyBonus,

        streakBonus,

        streakAfter:
          nextStreak,
      });

      /*
       * Weekly leaderboard.
       */
      transaction.set(
        weeklyRef,
        {
          userId,

          displayName,

          rating:
            userPuzzleRating,

          league,

          points:
            weeklyPoints,

          solved:
            Number(
              oldWeekly.solved || 0,
            ) + 1,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      /*
       * Monthly leaderboard.
       */
      transaction.set(
        monthlyRef,
        {
          userId,

          displayName,

          rating:
            userPuzzleRating,

          league,

          points:
            monthlyPoints,

          solved:
            Number(
              oldMonthly.solved || 0,
            ) + 1,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );

      /*
       * All-time leaderboard.
       */
      transaction.set(
        allTimeRef,
        {
          userId,

          displayName,

          rating:
            userPuzzleRating,

          league,

          points:
            allTimePoints,

          solved:
            Number(
              oldAllTime.solved || 0,
            ) + 1,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        },
      );
    },
  );
  console.log("🔥 Leaderboard write completed");

const debugLeaderboard = await getDoc(
  weeklyRef,
);

console.log(
  "🔥 WEEKLY LEADERBOARD DOCUMENT:",
  debugLeaderboard.exists()
    ? debugLeaderboard.data()
    : "DOCUMENT DOES NOT EXIST",
);

  /*
   * We cannot calculate a complete leaderboard
   * rank inside the transaction without reading
   * the whole collection again.
   *
   * Calculate after successful write.
   */
  try {
    weeklyRank =
      await getUserLeaderboardRank(
        "weekly",
        userId,
      );
  } catch (error) {
    console.error(
      "Could not calculate leaderboard rank:",
      error,
    );
  }

  return {
    stats: nextStats,
    pointsEarned,
    streakBonus,
    difficultyBonus,
    weeklyRank,
  };
}

/* =========================================================
   LEADERBOARD
========================================================= */

export async function getLeaderboard(
  period:
    | "weekly"
    | "monthly"
    | "allTime",
  maxResults = 50,
): Promise<LeaderboardEntry[]> {
  const entriesRef = collection(
    db,
    "leaderboards",
    period,
    "entries",
  );

  const leaderboardQuery = query(
    entriesRef,
    orderBy("points", "desc"),
    limit(maxResults),
  );

  const snapshot =
    await getDocs(
      leaderboardQuery,
    );

  return snapshot.docs.map(
    (document) =>
      document.data() as LeaderboardEntry,
  );
}

/* =========================================================
   USER RANK
========================================================= */

export async function getUserLeaderboardRank(
  period:
    | "weekly"
    | "monthly"
    | "allTime",
  userId: string,
): Promise<number | null> {
  const entries =
    await getLeaderboard(
      period,
      1000,
    );

  const index =
    entries.findIndex(
      (entry) =>
        entry.userId === userId,
    );

  if (index === -1) {
    return null;
  }

  return index + 1;
}