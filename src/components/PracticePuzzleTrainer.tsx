import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Chess } from "chess.js";

import { auth } from "../services/firebase";

import {
  getPracticeStats,
  recordPracticeResult,
} from "../services/practiceService";

import type {
  PracticePuzzle,
  PracticeStats,
} from "../types/practice";

/* =========================================================
   TYPES
========================================================= */

interface PracticePuzzleTrainerProps {
  puzzle: PracticePuzzle;

  puzzleNumber: number;

  totalPuzzles: number;

  hasNextPuzzle: boolean;

  onBack: () => void;

  onNext: () => void;
}

type Square = string;

type Status =
  | "playing"
  | "wrong"
  | "complete";

type FeedbackType =
  | "correct"
  | "wrong"
  | "complete"
  | null;

type HintLevel = 0 | 1 | 2 | 3;

/* =========================================================
   CONSTANTS
========================================================= */

const FILES = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
];

const WHITE_RANKS = [
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
  "1",
];

const BLACK_RANKS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
];

const PIECES: Record<
  string,
  string
> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",

  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

/* =========================================================
   COMPONENT
========================================================= */

const PracticePuzzleTrainer: React.FC<
  PracticePuzzleTrainerProps
> = ({
  puzzle,
  puzzleNumber,
  totalPuzzles,
  hasNextPuzzle,
  onBack,
  onNext,
}) => {
  /* =======================================================
     GAME
  ======================================================== */

  const [game, setGame] =
    useState(
      () => new Chess(puzzle.fen),
    );

  const [selectedSquare, setSelectedSquare] =
    useState<Square | null>(
      null,
    );

  const [legalMoves, setLegalMoves] =
    useState<Square[]>([]);

  const [lastMove, setLastMove] =
    useState<{
      from: Square;
      to: Square;
    } | null>(null);

  const [solutionIndex, setSolutionIndex] =
    useState(0);

  const [wrongAttempts, setWrongAttempts] =
    useState(0);

  const [hintsUsed, setHintsUsed] =
    useState(0);

  const [hintLevel, setHintLevel] =
    useState<HintLevel>(0);

  const [status, setStatus] =
    useState<Status>("playing");

  const [feedbackType, setFeedbackType] =
    useState<FeedbackType>(null);

  const [feedbackMessage, setFeedbackMessage] =
    useState("");

  const [isOpponentThinking, setIsOpponentThinking] =
    useState(false);

  /* =======================================================
     STATS
  ======================================================== */

  const [practiceStats, setPracticeStats] =
    useState<PracticeStats>({
      attempted: 0,
      solved: 0,
      accuracy: 0,
      points: 0,
      currentStreak: 0,
      bestStreak: 0,
      dailyGoal: 5,
      dailyCompleted: 0,
      lastSolvedDate: null,
    });

  const [weeklyRank, setWeeklyRank] =
    useState<number | null>(null);

  const [pointsEarned, setPointsEarned] =
    useState<number | null>(null);

  const [isSavingResult, setIsSavingResult] =
    useState(false);

  /*
   * Prevent duplicate writes.
   */
  const resultSavedRef =
    useRef(false);

  /*
   * Timers.
   */
  const feedbackTimerRef =
    useRef<number | null>(null);

  const opponentTimerRef =
    useRef<number | null>(null);

  /* =======================================================
     LOAD STATS
  ======================================================== */

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    let mounted = true;

    const loadStats =
      async () => {
        try {
          const stats =
            await getPracticeStats(
              user.uid,
            );

          if (mounted) {
            setPracticeStats(
              stats,
            );
          }
        } catch (error) {
          console.error(
            "Could not load Practice stats:",
            error,
          );
        }
      };

    void loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     RESET PUZZLE
  ======================================================== */

  useEffect(() => {
    const newGame =
      new Chess(puzzle.fen);

    setGame(newGame);

    setSelectedSquare(null);

    setLegalMoves([]);

    setLastMove(null);

    setSolutionIndex(0);

    setWrongAttempts(0);

    setHintsUsed(0);

    setHintLevel(0);

    setStatus("playing");

    setFeedbackType(null);

    setFeedbackMessage("");

    setIsOpponentThinking(false);

    setPointsEarned(null);

    setIsSavingResult(false);

    resultSavedRef.current = false;

    if (
      feedbackTimerRef.current
    ) {
      window.clearTimeout(
        feedbackTimerRef.current,
      );
    }

    if (
      opponentTimerRef.current
    ) {
      window.clearTimeout(
        opponentTimerRef.current,
      );
    }
  }, [puzzle]);

  /* =======================================================
     CLEANUP
  ======================================================== */

  useEffect(() => {
    return () => {
      if (
        feedbackTimerRef.current
      ) {
        window.clearTimeout(
          feedbackTimerRef.current,
        );
      }

      if (
        opponentTimerRef.current
      ) {
        window.clearTimeout(
          opponentTimerRef.current,
        );
      }
    };
  }, []);

  /* =======================================================
     BOARD
  ======================================================== */

  const isBlackOrientation =
    puzzle.toMove === "black";

  const boardRanks =
    isBlackOrientation
      ? BLACK_RANKS
      : WHITE_RANKS;

  const boardFiles =
    isBlackOrientation
      ? [...FILES].reverse()
      : FILES;

  const boardSquares =
    useMemo(() => {
      return boardRanks.flatMap(
        (rank) =>
          boardFiles.map(
            (file) =>
              `${file}${rank}`,
          ),
      );
    }, [
      boardRanks,
      boardFiles,
    ]);

  /* =======================================================
     PIECE
  ======================================================== */

  const getPiece = (
    square: Square,
  ) => {
    const piece =
      game.get(
        square as never,
      );

    if (!piece) {
      return null;
    }

    return {
      symbol:
        PIECES[
          `${piece.color}${piece.type.toUpperCase()}`
        ],

      color: piece.color,

      type: piece.type,
    };
  };

  /* =======================================================
     STUDENT COLOR
  ======================================================== */

  const studentColor =
    puzzle.toMove === "white"
      ? "w"
      : "b";

  const isStudentPiece = (
    square: Square,
  ) => {
    const piece =
      game.get(
        square as never,
      );

    return (
      Boolean(piece) &&
      piece?.color ===
        studentColor
    );
  };

  /* =======================================================
     SELECTION
  ======================================================== */

  const selectPiece = (
    square: Square,
  ) => {
    if (
      status === "complete" ||
      isOpponentThinking
    ) {
      return;
    }

    if (
      !isStudentPiece(square)
    ) {
      return;
    }

    const moves =
      game.moves({
        square:
          square as never,
        verbose: true,
      });

    setSelectedSquare(
      square,
    );

    setLegalMoves(
      moves.map(
        (move) =>
          move.to,
      ),
    );
  };

  const clearSelection =
    () => {
      setSelectedSquare(
        null,
      );

      setLegalMoves([]);
    };

  /* =======================================================
     FEEDBACK
  ======================================================== */

  const showFeedback = (
    type: FeedbackType,
    message: string,
    duration = 1000,
  ) => {
    setFeedbackType(type);

    setFeedbackMessage(
      message,
    );

    if (
      feedbackTimerRef.current
    ) {
      window.clearTimeout(
        feedbackTimerRef.current,
      );
    }

    if (duration > 0) {
      feedbackTimerRef.current =
        window.setTimeout(
          () => {
            setFeedbackType(
              null,
            );

            setFeedbackMessage(
              "",
            );
          },
          duration,
        );
    }
  };

  /* =======================================================
     SAVE RESULT
  ======================================================== */

  const saveCompletedPuzzle =
    async () => {
      if (
        resultSavedRef.current
      ) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        console.warn(
          "Cannot save Practice result: user not authenticated.",
        );

        return;
      }

      resultSavedRef.current =
        true;

      setIsSavingResult(true);

      try {
        const result =
          await recordPracticeResult(
            user.uid,
            puzzle,
            wrongAttempts,
            hintsUsed,
          );

        setPracticeStats(
          result.stats,
        );

        setPointsEarned(
          result.pointsEarned,
        );

        setWeeklyRank(
          result.weeklyRank,
        );
      } catch (error) {
        /*
         * Allow retry if Firestore
         * failed.
         */
        resultSavedRef.current =
          false;

        console.error(
          "Could not save Practice result:",
          error,
        );
      } finally {
        setIsSavingResult(
          false,
        );
      }
    };

  /* =======================================================
     OPPONENT MOVE
  ======================================================== */

  const playOpponentMove =
    (
      currentGame: Chess,
      currentIndex: number,
    ) => {
      const opponentUci =
        puzzle
          .requiredSolutionUci[
            currentIndex
          ];

      if (!opponentUci) {
        setIsOpponentThinking(
          false,
        );

        return;
      }

      const from =
        opponentUci.slice(0, 2);

      const to =
        opponentUci.slice(2, 4);

      const nextGame =
        new Chess(
          currentGame.fen(),
        );

      try {
        nextGame.move({
          from: from as never,
          to: to as never,
          promotion: "q",
        });
      } catch (error) {
        console.error(
          "Opponent move failed:",
          error,
        );

        setIsOpponentThinking(
          false,
        );

        return;
      }

      setGame(nextGame);

      setLastMove({
        from,
        to,
      });

      const nextIndex =
        currentIndex + 1;

      setSolutionIndex(
        nextIndex,
      );

      setIsOpponentThinking(
        false,
      );

      /*
       * Solution ended after
       * opponent's move.
       */
      if (
        nextIndex >=
        puzzle
          .requiredSolutionUci
          .length
      ) {
        setStatus(
          "complete",
        );

        showFeedback(
          "complete",
          "Excellent. You found the idea.",
          0,
        );

        void saveCompletedPuzzle();
      }
    };

  /* =======================================================
     PLAY MOVE
  ======================================================== */

  const playMove = (
    from: Square,
    to: Square,
  ) => {
    if (
      status === "complete" ||
      isOpponentThinking
    ) {
      return;
    }

    const expected =
      puzzle
        .requiredSolutionUci[
        solutionIndex
      ];

    const attemptedUci =
      `${from}${to}`;

    /*
     * WRONG MOVE
     */
    if (
      attemptedUci !== expected
    ) {
      setWrongAttempts(
        (value) => value + 1,
      );

      setStatus("wrong");

      showFeedback(
        "wrong",
        "Not quite. Look for a stronger idea.",
        850,
      );

      clearSelection();

      window.setTimeout(
        () => {
          setStatus(
            "playing",
          );
        },
        850,
      );

      return;
    }

    /*
     * CORRECT MOVE
     */
    const nextGame =
      new Chess(
        game.fen(),
      );

    try {
      nextGame.move({
        from: from as never,
        to: to as never,
        promotion: "q",
      });
    } catch (error) {
      console.error(
        "Student move failed:",
        error,
      );

      return;
    }

    setGame(nextGame);

    setLastMove({
      from,
      to,
    });

    clearSelection();

    const nextIndex =
      solutionIndex + 1;

    setSolutionIndex(
      nextIndex,
    );

    /*
     * COMPLETE
     */
    if (
      nextIndex >=
      puzzle
        .requiredSolutionUci
        .length
    ) {
      setStatus(
        "complete",
      );

      showFeedback(
        "complete",
        "Excellent. You found the idea.",
        0,
      );

      void saveCompletedPuzzle();

      return;
    }

    /*
     * Correct but solution
     * continues.
     */
    showFeedback(
      "correct",
      "Correct",
      700,
    );

    setIsOpponentThinking(
      true,
    );

    if (
      opponentTimerRef.current
    ) {
      window.clearTimeout(
        opponentTimerRef.current,
      );
    }

    opponentTimerRef.current =
      window.setTimeout(
        () => {
          playOpponentMove(
            nextGame,
            nextIndex,
          );
        },
        420,
      );
  };

  /* =======================================================
     BOARD CLICK
  ======================================================== */

  const handleSquareClick =
    (
      square: Square,
    ) => {
      if (
        status === "complete" ||
        status === "wrong" ||
        isOpponentThinking
      ) {
        return;
      }

      /*
       * Nothing selected.
       */
      if (
        !selectedSquare
      ) {
        selectPiece(square);

        return;
      }

      /*
       * Select another own piece.
       */
      if (
        isStudentPiece(square)
      ) {
        selectPiece(square);

        return;
      }

      /*
       * Legal destination.
       */
      if (
        legalMoves.includes(
          square,
        )
      ) {
        playMove(
          selectedSquare,
          square,
        );

        return;
      }

      clearSelection();
    };

  /* =======================================================
     HINT SYSTEM
  ======================================================== */

  const handleHint = () => {
    if (
      status === "complete" ||
      isOpponentThinking
    ) {
      return;
    }

    if (
      hintLevel >= 3
    ) {
      return;
    }

    const nextLevel =
      Math.min(
        hintLevel + 1,
        3,
      ) as HintLevel;

    setHintLevel(
      nextLevel,
    );

    setHintsUsed(
      (value) => value + 1,
    );
  };

  /* =======================================================
     NEXT PUZZLE
  ======================================================== */

  const handleNext = () => {
    /*
     * Student must solve the
     * current puzzle first.
     */
    if (
      status !== "complete"
    ) {
      return;
    }

    /*
     * Wait until the result
     * has finished saving.
     */
    if (
      isSavingResult
    ) {
      return;
    }

    /*
     * No next puzzle available.
     */
    if (
      !hasNextPuzzle
    ) {
      return;
    }

    onNext();
  };

  /* =======================================================
     PROGRESS
  ======================================================== */

  const solutionLength =
    puzzle
      .requiredSolutionUci
      .length;

  const progress =
    solutionLength > 0
      ? Math.min(
          100,
          Math.round(
            (solutionIndex /
              solutionLength) *
              100,
          ),
        )
      : 0;

  /* =======================================================
     DIFFICULTY
  ======================================================== */

  const difficulty =
    puzzle.estRating < 1200
      ? "Focused"
      : puzzle.estRating < 1500
        ? "Challenging"
        : "Stretch";

  /* =======================================================
     RENDER
  ======================================================== */

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-950 text-white">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b border-slate-900 bg-slate-950/95">

        <div className="mx-auto flex h-[60px] max-w-[1450px] items-center justify-between px-3 sm:px-5">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-white"
              aria-label="Back"
            >
              ←
            </button>

            <div className="min-w-0">

              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Practice
              </p>

              <h1 className="truncate text-sm font-semibold text-white">
                Find the best move
              </h1>

            </div>

          </div>

          <div className="text-right">

            <p className="text-[9px] uppercase tracking-wider text-slate-600">
              Challenge
            </p>

            <p className="text-sm font-semibold text-slate-300">
              #{puzzleNumber}
            </p>

          </div>

        </div>

      </header>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="mx-auto max-w-[1450px] px-3 py-3 sm:px-5">

        {/* Progress */}

        <div className="mb-3 flex items-center gap-3">

          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900">

            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

          <span className="w-9 text-right text-[10px] text-slate-500">
            {progress}%
          </span>

        </div>

        {/* ===================================================
            CONTENT
        ==================================================== */}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] xl:grid-cols-[minmax(0,1fr)_350px]">

          {/* =================================================
              BOARD
          ================================================== */}

          <section className="flex min-w-0 justify-center">

            <div className="relative w-full max-w-[min(680px,calc(100vh-135px))]">

              {/* Feedback */}

              {feedbackType && (
                <div
                  className={[
                    "absolute left-1/2 top-2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold shadow-xl",
                    feedbackType ===
                    "wrong"
                      ? "bg-red-500 text-white"
                      : "bg-emerald-400 text-slate-950",
                  ].join(" ")}
                >
                  {feedbackMessage}
                </div>
              )}

              {/* Board */}

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-1 shadow-[0_20px_70px_rgba(0,0,0,0.35)] sm:p-1.5">

                <div className="grid aspect-square grid-cols-8 overflow-hidden rounded-xl">

                  {boardSquares.map(
                    (
                      square,
                      index,
                    ) => {
                      const fileIndex =
                        index % 8;

                      const rankIndex =
                        Math.floor(
                          index / 8,
                        );

                      const isDark =
                        (fileIndex +
                          rankIndex) %
                          2 ===
                        1;

                      const piece =
                        getPiece(
                          square,
                        );

                      const selected =
                        selectedSquare ===
                        square;

                      const legal =
                        legalMoves.includes(
                          square,
                        );

                      const last =
                        lastMove?.from ===
                          square ||
                        lastMove?.to ===
                          square;

                      const capture =
                        legal &&
                        Boolean(
                          piece,
                        );

                      const showFile =
                        rankIndex ===
                        7;

                      const showRank =
                        fileIndex ===
                        0;

                      return (
                        <button
                          key={square}
                          type="button"
                          onClick={() =>
                            handleSquareClick(
                              square,
                            )
                          }
                          className={[
                            "relative flex aspect-square items-center justify-center overflow-hidden",
                            isDark
                              ? "bg-[#78945f]"
                              : "bg-[#eee8d0]",
                            selected
                              ? "ring-4 ring-inset ring-emerald-300"
                              : "",
                            last
                              ? "after:absolute after:inset-0 after:bg-amber-300/20"
                              : "",
                          ].join(" ")}
                          aria-label={`Square ${square}`}
                        >

                          {/* File */}

                          {showFile && (
                            <span
                              className={[
                                "absolute bottom-1 left-1 z-30 text-[9px] font-bold opacity-60",
                                isDark
                                  ? "text-white"
                                  : "text-[#526142]",
                              ].join(" ")}
                            >
                              {square[0]}
                            </span>
                          )}

                          {/* Rank */}

                          {showRank && (
                            <span
                              className={[
                                "absolute right-1 top-1 z-30 text-[9px] font-bold opacity-60",
                                isDark
                                  ? "text-white"
                                  : "text-[#526142]",
                              ].join(" ")}
                            >
                              {square[1]}
                            </span>
                          )}

                          {/* Piece */}

                          {piece && (
                            <span
                              className={[
                                "relative z-10 select-none font-serif text-[clamp(2rem,6vw,4.4rem)] leading-none",
                                piece.color ===
                                "w"
                                  ? "text-[#fffdf5] drop-shadow-[0_3px_2px_rgba(0,0,0,0.5)]"
                                  : "text-[#20231f] drop-shadow-[0_3px_2px_rgba(255,255,255,0.25)]",
                                selected
                                  ? "scale-105"
                                  : "",
                              ].join(" ")}
                            >
                              {piece.symbol}
                            </span>
                          )}

                          {/* Legal move */}

                          {legal &&
                            !capture && (
                              <span className="pointer-events-none absolute z-20 h-[18%] w-[18%] rounded-full bg-emerald-500/80" />
                            )}

                          {/* Capture */}

                          {capture && (
                            <span className="pointer-events-none absolute inset-[5%] z-20 rounded-full border-[3px] border-emerald-300/80 sm:border-4" />
                          )}

                        </button>
                      );
                    },
                  )}

                </div>

              </div>

              <div className="mt-2 flex justify-between px-1 text-[10px] text-slate-600">

                <span>
                  Playing as{" "}
                  <span className="font-semibold text-slate-400">
                    {puzzle.toMove ===
                    "white"
                      ? "White"
                      : "Black"}
                  </span>
                </span>

                <span>
                  {difficulty}
                </span>

              </div>

            </div>

          </section>

          {/* =================================================
              RIGHT PANEL
          ================================================== */}

          <aside className="space-y-3">

            {/* Challenge */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    Your challenge
                  </p>

                  <h2 className="mt-1.5 text-lg font-semibold">
                    Find the best move
                  </h2>

                </div>

                <div className="rounded-xl bg-slate-950 px-3 py-2 text-right">

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Rating
                  </p>

                  <p className="text-sm font-bold text-slate-200">
                    {puzzle.estRating}
                  </p>

                </div>

              </div>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Take your time. Look for checks,
                captures and forcing ideas.
              </p>

              {/* Move stats */}

              <div className="mt-3 grid grid-cols-2 gap-2">

                <div className="rounded-xl bg-slate-950 p-3">

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Moves
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {solutionIndex} /{" "}
                    {solutionLength}
                  </p>

                </div>

                <div className="rounded-xl bg-slate-950 p-3">

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Attempts
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {wrongAttempts}
                  </p>

                </div>

              </div>

              {/* Opponent */}

              {isOpponentThinking && (
                <div className="mt-3 rounded-xl bg-slate-950 px-3 py-2.5 text-center text-xs text-slate-500">
                  Opponent is responding…
                </div>
              )}

              {/* =================================================
                  HINTS
              ================================================== */}

              <div className="mt-3">

                {hintLevel ===
                  0 && (
                  <button
                    type="button"
                    onClick={
                      handleHint
                    }
                    disabled={
                      status ===
                        "complete" ||
                      isOpponentThinking
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                  >
                    Need a hint?
                  </button>
                )}

                {/* Hint 1 */}

                {hintLevel >=
                  1 && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">

                    <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                      Hint 1
                    </p>

                    <p className="mt-1.5 text-xs leading-5 text-slate-300">
                      {puzzle.hint1 ||
                        "Look for checks, captures and forcing moves first."}
                    </p>

                    {hintLevel <
                      2 && (
                      <button
                        type="button"
                        onClick={
                          handleHint
                        }
                        className="mt-3 text-[10px] font-semibold text-emerald-400"
                      >
                        Show stronger hint →
                      </button>
                    )}

                  </div>
                )}

                {/* Hint 2 */}

                {hintLevel >=
                  2 && (
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950 p-3">

                    <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">
                      Hint 2
                    </p>

                    <p className="mt-1.5 text-xs leading-5 text-slate-300">
                      {puzzle.hint2 ||
                        "Calculate the opponent's strongest reply before committing."}
                    </p>

                    {hintLevel <
                      3 && (
                      <button
                        type="button"
                        onClick={
                          handleHint
                        }
                        className="mt-3 text-[10px] font-semibold text-amber-400"
                      >
                        Reveal key idea →
                      </button>
                    )}

                  </div>
                )}

                {/* Key Idea */}

                {hintLevel >=
                  3 && (
                  <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">

                    <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                      Key idea
                    </p>

                    <p className="mt-1.5 text-xs leading-5 text-slate-300">
                      {puzzle.keyIdea ||
                        "Find the move that best exploits the tactical idea in the position."}
                    </p>

                  </div>
                )}

              </div>

              {/* =================================================
                  COMPLETION
              ================================================== */}

              {status ===
                "complete" && (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">

                  <div className="flex items-center gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-bold text-slate-950">
                      ✓
                    </div>

                    <div>

                      <p className="text-xs font-semibold">
                        Nicely done.
                      </p>

                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {isSavingResult
                          ? "Saving your progress…"
                          : pointsEarned !==
                              null
                            ? `+${pointsEarned} points earned`
                            : "Progress saved"}
                      </p>

                    </div>

                  </div>

                </div>
              )}

            </div>

            {/* =================================================
                NEXT
            ================================================== */}

            <button
              type="button"
              onClick={
                handleNext
              }
              disabled={
                status !== "complete" ||
                isSavingResult ||
                !hasNextPuzzle
              }
              className={[
                "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left transition",
                status === "complete" &&
                !isSavingResult &&
                hasNextPuzzle
                  ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  : "cursor-not-allowed bg-slate-800 text-slate-500",
              ].join(" ")}
            >

              <span>

                <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] opacity-60">
                  Continue
                </span>

                <span className="mt-0.5 block text-sm font-bold">
                  {isSavingResult
                    ? "Saving progress…"
                    : status === "complete"
                      ? "Next challenge"
                      : "Solve this challenge first"}
                </span>

              </span>

              <span className="text-lg">
                →
              </span>

            </button>

            {/* =================================================
                TRAINING STATS
            ================================================== */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">

              <div className="grid grid-cols-3 gap-2">

                <div>

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Streak
                  </p>

                  <p className="mt-1 text-lg font-bold text-emerald-400">
                    {practiceStats.currentStreak}
                  </p>

                  <p className="text-[9px] text-slate-600">
                    days
                  </p>

                </div>

                <div>

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Points
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    {practiceStats.points}
                  </p>

                  <p className="text-[9px] text-slate-600">
                    total
                  </p>

                </div>

                <div>

                  <p className="text-[9px] uppercase tracking-wider text-slate-600">
                    Rank
                  </p>

                  <p className="mt-1 text-lg font-bold text-white">
                    {weeklyRank
                      ? `#${weeklyRank}`
                      : "—"}
                  </p>

                  <p className="text-[9px] text-slate-600">
                    weekly
                  </p>

                </div>

              </div>

              {/* Daily goal */}

              <div className="mt-4">

                <div className="flex items-center justify-between">

                  <p className="text-[10px] text-slate-500">
                    Today's training
                  </p>

                  <p className="text-[10px] text-slate-500">
                    {
                      practiceStats.dailyCompleted
                    }{" "}
                    /{" "}
                    {
                      practiceStats.dailyGoal
                    }
                  </p>

                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950">

                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (practiceStats.dailyCompleted /
                          Math.max(
                            1,
                            practiceStats.dailyGoal,
                          )) *
                          100,
                      )}%`,
                    }}
                  />

                </div>

              </div>

              {/* Accuracy */}

              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">

                <span className="text-[10px] text-slate-600">
                  Accuracy
                </span>

                <span className="text-xs font-semibold text-slate-300">
                  {
                    practiceStats.accuracy
                  }
                  %
                </span>

              </div>

            </div>

            {/* =================================================
                HOW TO PLAY
            ================================================== */}

            <div className="hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 xl:block">

              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                How to play
              </p>

              <div className="mt-3 space-y-2.5">

                <div className="flex gap-2.5">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">
                    1
                  </span>

                  <p className="text-[11px] leading-5 text-slate-500">
                    Select one of your pieces.
                  </p>

                </div>

                <div className="flex gap-2.5">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">
                    2
                  </span>

                  <p className="text-[11px] leading-5 text-slate-500">
                    Green markers show legal moves.
                  </p>

                </div>

                <div className="flex gap-2.5">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">
                    3
                  </span>

                  <p className="text-[11px] leading-5 text-slate-500">
                    Find the strongest move.
                  </p>

                </div>

                <div className="flex gap-2.5">

                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold">
                    4
                  </span>

                  <p className="text-[11px] leading-5 text-slate-500">
                    Continue until the full solution is complete.
                  </p>

                </div>

              </div>

            </div>

          </aside>

        </div>

      </main>
    </div>
  );
};

export default PracticePuzzleTrainer;