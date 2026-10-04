import React, { useEffect, useMemo, useState } from "react";

import { Chess } from "chess.js";

import { PuzzleDocument } from "../types/puzzleLibrary";

interface PracticePuzzleTrainerProps {
  puzzle: PuzzleDocument;

  puzzleNumber: number;
  totalPuzzles: number;

  hasNextPuzzle: boolean;

  onBack: () => void;
  onNext: () => void;
}

type Square = string;

type FeedbackType = "correct" | "wrong" | "complete" | null;

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const WHITE_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const BLACK_RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const PIECES: Record<string, string> = {
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

const PracticePuzzleTrainer: React.FC<PracticePuzzleTrainerProps> = ({
  puzzle,
  puzzleNumber,
  totalPuzzles,
  hasNextPuzzle,
  onBack,
  onNext,
}) => {
  const [game, setGame] = useState(() => new Chess(puzzle.fen));

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [solutionIndex, setSolutionIndex] = useState(0);

  const [status, setStatus] = useState<"playing" | "wrong" | "complete">(
    "playing",
  );

  const [feedbackType, setFeedbackType] = useState<FeedbackType>(null);

  const [feedbackMessage, setFeedbackMessage] = useState("");

  /*
   * Reset trainer whenever a new puzzle
   * is passed from PracticePage.
   */
  useEffect(() => {
    const newGame = new Chess(puzzle.fen);

    setGame(newGame);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setSolutionIndex(0);

    setStatus("playing");

    setFeedbackType(null);
    setFeedbackMessage("");
  }, [puzzle]);

  /*
   * Board orientation
   */
  const isBlackOrientation = puzzle.sideToMove === "black";

  const boardRanks = isBlackOrientation ? BLACK_RANKS : WHITE_RANKS;

  const boardFiles = isBlackOrientation ? [...FILES].reverse() : FILES;

  const boardSquares = useMemo(() => {
    return boardRanks.flatMap((rank) =>
      boardFiles.map((file) => `${file}${rank}`),
    );
  }, [boardRanks, boardFiles]);

  /*
   * Get piece
   */
  const getPiece = (square: Square) => {
    const piece = game.get(square as any);

    if (!piece) {
      return null;
    }

    return PIECES[`${piece.color}${piece.type.toUpperCase()}`];
  };

  /*
   * Floating feedback
   */
  const showFeedback = (type: FeedbackType, message: string) => {
    setFeedbackType(type);
    setFeedbackMessage(message);
  };

  /*
   * Handle square click
   */
  const handleSquareClick = (square: Square) => {
    if (status === "complete") {
      return;
    }

    const piece = game.get(square as any);

    /*
     * If a piece is already selected
     * and destination is legal,
     * try the move.
     */
    if (selectedSquare && legalMoves.includes(square)) {
      handleMove(selectedSquare, square);

      return;
    }

    /*
     * Empty square
     */
    if (!piece) {
      setSelectedSquare(null);
      setLegalMoves([]);

      return;
    }

    /*
     * Wrong side
     */
    if (piece.color !== game.turn()) {
      showFeedback(
        "wrong",
        `It's ${game.turn() === "w" ? "White" : "Black"}'s turn.`,
      );

      setTimeout(() => {
        setFeedbackType(null);
        setFeedbackMessage("");
      }, 900);

      return;
    }

    /*
     * Get legal moves
     */
    const moves = game.moves({
      square: square as any,
      verbose: true,
    });

    setSelectedSquare(square);

    setLegalMoves(moves.map((move) => move.to));

    /*
     * Remove old feedback
     * while selecting a piece.
     */
    setFeedbackType(null);
    setFeedbackMessage("");
  };

  /*
   * Handle move
   */
  const handleMove = (from: Square, to: Square) => {
    const expectedMove = puzzle.solutionMoves[solutionIndex];

    if (!expectedMove) {
      return;
    }

    const attemptedMove = `${from}${to}`;

    /*
     * Compare UCI base move.
     *
     * Example:
     * e2e4
     * e7e8q
     */
    const expectedBase = expectedMove.slice(0, 4);

    const isCorrect = attemptedMove === expectedBase;

    /*
     * =========================
     * WRONG MOVE
     * =========================
     */
    if (!isCorrect) {
      setStatus("wrong");

      showFeedback("wrong", "Wrong move — try again");

      setSelectedSquare(null);
      setLegalMoves([]);

      setTimeout(() => {
        setStatus("playing");

        setFeedbackType(null);
        setFeedbackMessage("");
      }, 900);

      return;
    }

    /*
     * =========================
     * CORRECT MOVE
     * =========================
     */

    const newGame = new Chess(game.fen());

    try {
      const promotion = expectedMove[4] || "q";

      const move = newGame.move({
        from,
        to,
        promotion,
      });

      setGame(newGame);

      setLastMove({
        from,
        to,
      });

      setSelectedSquare(null);
      setLegalMoves([]);

      const nextIndex = solutionIndex + 1;

      /*
       * Puzzle complete
       */
      if (nextIndex >= puzzle.solutionMoves.length) {
        setSolutionIndex(nextIndex);

        setStatus("complete");

        showFeedback("complete", "Puzzle completed!");

        return;
      }

      /*
       * More solution moves remain.
       */
      setSolutionIndex(nextIndex);

      showFeedback("correct", `Correct! ${move.san}`);

      /*
       * Let opponent play the
       * next solution move.
       */
      setTimeout(() => {
        playOpponentMove(newGame, nextIndex);
      }, 600);
    } catch (error) {
      console.error("Failed to apply move:", error);

      showFeedback("wrong", "Unable to make that move.");
    }
  };

  /*
   * Automatic opponent move
   */
  const playOpponentMove = (currentGame: Chess, index: number) => {
    const opponentMove = puzzle.solutionMoves[index];

    if (!opponentMove) {
      return;
    }

    const from = opponentMove.slice(0, 2);

    const to = opponentMove.slice(2, 4);

    const promotion = opponentMove[4] || undefined;

    try {
      const nextGame = new Chess(currentGame.fen());

      const move = nextGame.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });

      setGame(nextGame);

      setLastMove({
        from,
        to,
      });

      const nextIndex = index + 1;

      setSolutionIndex(nextIndex);

      /*
       * Opponent's move finishes
       * the entire solution.
       */
      if (nextIndex >= puzzle.solutionMoves.length) {
        setStatus("complete");

        showFeedback("complete", "Puzzle completed!");

        return;
      }

      /*
       * User can continue.
       */
      setStatus("playing");

      showFeedback("correct", `Correct — ${move.san}`);

      setTimeout(() => {
        setFeedbackType(null);
        setFeedbackMessage("");
      }, 1000);
    } catch (error) {
      console.error("Failed to play opponent move:", error);
    }
  };

  /*
   * Board square classes
   */
  const getSquareClass = (square: Square) => {
    const fileIndex = FILES.indexOf(square[0]);

    const rankIndex = WHITE_RANKS.indexOf(square[1]);

    const isDark = (fileIndex + rankIndex) % 2 === 1;

    const classes = [
      "relative",
      "flex",
      "aspect-square",
      "items-center",
      "justify-center",
      "cursor-pointer",
      "select-none",
      "overflow-hidden",
      "transition-colors",
      "duration-150",
    ];

    /*
     * Screenshot-like
     * brown / cream board
     */
    classes.push(isDark ? "bg-[#b58a63]" : "bg-[#f0d9b5]");

    /*
     * Last move
     */
    if (lastMove && (lastMove.from === square || lastMove.to === square)) {
      classes.push(isDark ? "bg-[#c49a6c]" : "bg-[#f4e3bd]");
    }

    /*
     * Selected piece
     */
    if (selectedSquare === square) {
      classes.push("ring-4", "ring-inset", "ring-yellow-400");
    }

    return classes.join(" ");
  };

  /*
   * Feedback classes
   */
  const getFeedbackClasses = () => {
    if (feedbackType === "wrong") {
      return "border-red-400/40 bg-red-500/15 text-red-300";
    }

    if (feedbackType === "complete") {
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300";
    }

    if (feedbackType === "correct") {
      return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300";
    }

    return "";
  };

  /*
   * Feedback icon
   */
  const getFeedbackIcon = () => {
    if (feedbackType === "wrong") {
      return "✕";
    }

    return "✓";
  };

  /*
   * Progress percentage
   */
  const progress =
    puzzle.solutionMoves.length > 0
      ? Math.min(100, (solutionIndex / puzzle.solutionMoves.length) * 100)
      : 0;

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full items-center justify-center bg-[#071712] text-white p-4">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* =========================
            TOP BAR
           ========================= */}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-transparent px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-800"
          >
            <span>←</span>
            <span>Change training</span>
          </button>

          <div className="text-right">
            <p className="text-sm font-semibold text-white">
              {puzzle.topicName || "Puzzle Practice"}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Puzzle {puzzleNumber} of {totalPuzzles}
            </p>
          </div>
        </div>

        {/* =========================
            MAIN GRID
           ========================= */}

        <div className="grid gap-5 lg:grid-cols-[500px_365px]">
          {/* =========================
              LEFT BOARD CARD
             ========================= */}

          <section className="rounded-2xl border border-slate-700 bg-[#0d1824] p-5 shadow-xl sm:p-6">
            {/* Board heading */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-lg">
                ◎
              </div>

              <div>
                <h1 className="text-lg font-semibold text-white">
                  {puzzle.title || `Problem #${puzzleNumber}`}
                </h1>

                <p className="text-xs text-slate-400">
                  {puzzle.topicName || "Chess Puzzle"}
                </p>
              </div>
            </div>

            {/* Instruction */}
            <div className="mb-3 rounded-xl bg-[#12352f] px-4 py-2.5 text-center text-sm font-medium text-slate-200">
              Find the correct move in this position.
            </div>

            {/* Board wrapper */}
            <div className="relative mx-auto w-full max-w-[700px]">
              {/* Floating feedback */}
              {feedbackType && (
                <div
                  className={`
                    absolute
                    left-1/2
                    top-0
                    z-50
                    -translate-x-1/2
                    -translate-y-1/2
                    whitespace-nowrap
                    rounded-full
                    border
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    shadow-xl
                    backdrop-blur-sm
                    ${getFeedbackClasses()}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{getFeedbackIcon()}</span>

                    <span>{feedbackMessage}</span>
                  </div>
                </div>
              )}

              {/* Chess board */}
              <div className="overflow-hidden rounded-md border border-slate-600 shadow-2xl">
                <div className="grid grid-cols-8">
                  {boardSquares.map((square) => {
                    const piece = getPiece(square);

                    const isLegal = legalMoves.includes(square);

                    const fileIndex = boardFiles.indexOf(square[0]);

                    const rankIndex = boardRanks.indexOf(square[1]);

                    const showFileLabel = rankIndex === 7;

                    const showRankLabel = fileIndex === 0;

                    const isDark =
                      (FILES.indexOf(square[0]) +
                        WHITE_RANKS.indexOf(square[1])) %
                        2 ===
                      1;

                    return (
                      <button
                        key={square}
                        type="button"
                        onClick={() => handleSquareClick(square)}
                        aria-label={`Square ${square}`}
                        className={getSquareClass(square)}
                      >
                        {/* Piece */}
                        {piece && (
                          <span
                            className={`
                                relative
                                z-10
                                font-serif
                                text-[clamp(2rem,7vw,4.6rem)]
                                leading-none
                                ${
                                  piece === "♔" ||
                                  piece === "♕" ||
                                  piece === "♖" ||
                                  piece === "♗" ||
                                  piece === "♘" ||
                                  piece === "♙"
                                    ? "text-white"
                                    : "text-black"
                                }
                              `}
                            style={{
                              textShadow:
                                piece === "♔" ||
                                piece === "♕" ||
                                piece === "♖" ||
                                piece === "♗" ||
                                piece === "♘" ||
                                piece === "♙"
                                  ? "0 2px 2px rgba(0,0,0,0.65)"
                                  : "0 1px 1px rgba(255,255,255,0.55)",
                            }}
                          >
                            {piece}
                          </span>
                        )}

                        {/* Legal move */}
                        {isLegal && (
                          <span
                            className={`
                                pointer-events-none
                                absolute
                                z-20
                                rounded-full
                                ${
                                  piece
                                    ? "inset-[12%] border-[4px] border-emerald-500/90"
                                    : "h-[22%] w-[22%] bg-emerald-600/85"
                                }
                              `}
                          />
                        )}

                        {/* Rank */}
                        {showRankLabel && (
                          <span
                            className={`
                                absolute
                                left-1
                                top-1
                                z-30
                                text-[10px]
                                font-bold
                                ${isDark ? "text-[#f0d9b5]" : "text-[#b58a63]"}
                              `}
                          >
                            {square[1]}
                          </span>
                        )}

                        {/* File */}
                        {showFileLabel && (
                          <span
                            className={`
                                absolute
                                bottom-1
                                right-1
                                z-30
                                text-[10px]
                                font-bold
                                ${isDark ? "text-[#f0d9b5]" : "text-[#b58a63]"}
                              `}
                          >
                            {square[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom board information */}
            <div className="mx-auto mt-4 flex max-w-[700px] items-center justify-between gap-4 text-sm">
              <div>
                <span className="text-slate-500">Side to move:</span>{" "}
                <span className="font-semibold text-slate-200">
                  {puzzle.sideToMove}
                </span>
              </div>

              <div>
                <span className="text-slate-500">Progress:</span>{" "}
                <span className="font-semibold text-slate-200">
                  {Math.min(solutionIndex, puzzle.solutionMoves.length)} /{" "}
                  {puzzle.solutionMoves.length}
                </span>
              </div>
            </div>
          </section>

          {/* =========================
              RIGHT PANEL
             ========================= */}

          <aside className="space-y-5">
            {/* =========================
                PUZZLE CARD
               ========================= */}

            <div className="rounded-2xl border border-slate-700 bg-[#0d1824] p-5 shadow-xl">
              <h2 className="text-base font-semibold text-white">Puzzle</h2>

              {/* Info */}
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-400">Side to move</span>

                  <span className="text-sm font-semibold capitalize text-white">
                    {puzzle.sideToMove}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-400">Solution moves</span>

                  <span className="text-sm font-semibold text-white">
                    {puzzle.solutionMoves.length}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-slate-400">Progress</span>

                  <span className="text-sm font-semibold text-white">
                    {Math.min(solutionIndex, puzzle.solutionMoves.length)} /{" "}
                    {puzzle.solutionMoves.length}
                  </span>
                </div>
              </div>

              {/* Task box */}
              <div className="mt-5 rounded-xl bg-[#17243a] px-4 py-3 text-sm text-slate-200">
                Find the correct tactical move.
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              {/* Next puzzle */}
              <button
                type="button"
                disabled={!(status === "complete" && hasNextPuzzle)}
                onClick={onNext}
                className={`
                  mt-5
                  w-full
                  rounded-xl
                  px-4
                  py-3
                  text-sm
                  font-semibold
                  transition
                  ${
                    status === "complete" && hasNextPuzzle
                      ? "bg-emerald-700 text-white hover:bg-emerald-600"
                      : "cursor-not-allowed bg-slate-800 text-slate-500"
                  }
                `}
              >
                {hasNextPuzzle ? "Next Puzzle →" : "No More Puzzles"}
              </button>
            </div>

            {/* =========================
                HOW TO PLAY
               ========================= */}

            <div className="rounded-2xl border border-slate-700 bg-[#0d1824] p-5 shadow-xl">
              <h2 className="text-base font-semibold text-white">
                How to play
              </h2>

              <div className="mt-4 space-y-3">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    1
                  </span>

                  <p className="text-sm leading-6 text-slate-400">
                    Click a piece to select it.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    2
                  </span>

                  <p className="text-sm leading-6 text-slate-400">
                    Green markers show legal moves.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    3
                  </span>

                  <p className="text-sm leading-6 text-slate-400">
                    Find the correct tactical move.
                  </p>
                </div>

                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                    4
                  </span>

                  <p className="text-sm leading-6 text-slate-400">
                    Complete the solution.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PracticePuzzleTrainer;
