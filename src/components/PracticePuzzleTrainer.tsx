import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { auth } from '../services/firebase';
import { getPracticeStats, recordPracticeResult } from '../services/practiceService';
import type { PracticePuzzle } from '../types/practice';
import { ChessboardView, type ChessArrow } from './chess/ChessboardView';
import { useChessSounds } from '../hooks/useChessSounds';
import { ArrowLeft, Lightbulb, ScanSearch } from 'lucide-react';

interface PracticePuzzleTrainerProps {
  puzzle: PracticePuzzle;
  puzzleNumber: number;
  totalPuzzles: number;
  hasNextPuzzle: boolean;
  onBack: () => void;
  onNext: () => void;
}

// Minimalist Mascot Icon matching screenshots (dark rounded square with two white capsule eyes)
const RobotMascot: React.FC<{ isCelebrating?: boolean }> = ({ isCelebrating }) => (
  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/15 shadow-sm">
    <div className="flex items-center justify-center gap-1.5">
      <span
        className={`w-1.5 rounded-full bg-white transition-all duration-300 ${
          isCelebrating ? 'h-1.5' : 'h-3.5'
        }`}
      />
      <span
        className={`w-1.5 rounded-full bg-white transition-all duration-300 ${
          isCelebrating ? 'h-1.5' : 'h-3.5'
        }`}
      />
    </div>
  </div>
);

const PracticePuzzleTrainer: React.FC<PracticePuzzleTrainerProps> = ({
  puzzle,
  puzzleNumber: _puzzleNumber,
  hasNextPuzzle: _hasNextPuzzle,
  onBack,
  onNext,
}) => {
  const { playMove: playSoundMove, playCapture, playCheck, playIllegal } = useChessSounds();

  const [game, setGame] = useState(() => new Chess(puzzle.fen));
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>(
    puzzle.toMove === 'black' ? 'black' : 'white'
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string; toTint?: string } | null>(
    null
  );
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintStage, setHintStage] = useState<0 | 1 | 2>(0); // 0 = none, 1 = text hint, 2 = show move arrow
  const [coachMessage, setCoachMessage] = useState<string>('');
  const [isOpponentThinking, setIsOpponentThinking] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted] = useState(false);

  const XP_PER_LEVEL = 75;

  const [totalPoints, setTotalPoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pnp_practice_xp');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore
    }
    return 25; // Default 25 XP matching the screenshot
  });

  const { level, currentLevelXp, targetLevelXp, progressPercent } = useMemo(() => {
    const lvl = Math.floor(totalPoints / XP_PER_LEVEL) + 1;
    const current = totalPoints % XP_PER_LEVEL;
    const target = XP_PER_LEVEL;
    const pct = Math.min(100, Math.max(6, Math.round((current / target) * 100)));
    return {
      level: lvl,
      currentLevelXp: current,
      targetLevelXp: target,
      progressPercent: pct,
    };
  }, [totalPoints]);

  const opponentTimerRef = useRef<number | null>(null);
  const resultSavedRef = useRef(false);

  // Initial coach message
  const defaultCoachPrompt = useMemo(() => {
    return (
      puzzle.hint1 ||
      (puzzle.toMove === 'white'
        ? 'Find the best move for White.'
        : 'Find the best move for Black.')
    );
  }, [puzzle.hint1, puzzle.toMove]);

  // Load user streak and points from Firestore
  useEffect(() => {
    async function loadStats() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const stats = await getPracticeStats(user.uid);
        if (typeof stats.points === 'number' && stats.points > 0) {
          setTotalPoints(stats.points);
          try {
            localStorage.setItem('pnp_practice_xp', stats.points.toString());
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Failed to load practice stats:', err);
      }
    }
    void loadStats();
  }, []);

  // Sync state whenever puzzle changes
  useEffect(() => {
    const chess = new Chess(puzzle.fen);
    setGame(chess);
    setBoardOrientation(puzzle.toMove === 'black' ? 'black' : 'white');
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setSolutionIndex(0);
    setWrongAttempts(0);
    setHintsUsed(0);
    setHintStage(0);
    setCoachMessage(
      puzzle.hint1 ||
        (puzzle.toMove === 'white'
          ? 'Not every puzzle ends in checkmate. Can you win a piece here?'
          : 'Find the best move for Black.')
    );
    setIsOpponentThinking(false);
    setIsCompleted(false);
    resultSavedRef.current = false;

    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
    }
  }, [puzzle]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
      }
    };
  }, []);

  // Save results to Firestore
  const saveCompletedPuzzle = useCallback(
    async (attempts: number, hints: number) => {
      if (resultSavedRef.current) return;
      const user = auth.currentUser;
      if (!user) return;

      resultSavedRef.current = true;
      try {
        const result = await recordPracticeResult(user.uid, puzzle, attempts, hints);
        if (result.stats?.points) {
          setTotalPoints(result.stats.points);
        }
      } catch (err) {
        console.error('Error saving practice result:', err);
        resultSavedRef.current = false;
      }
    },
    [puzzle]
  );

  // Play opponent response move
  const playOpponentReply = useCallback(
    (currentGame: Chess, nextIndex: number) => {
      const replyUci = puzzle.requiredSolutionUci[nextIndex];
      if (!replyUci) {
        setIsOpponentThinking(false);
        return;
      }

      const from = replyUci.slice(0, 2);
      const to = replyUci.slice(2, 4);
      const promotion = replyUci[4] || 'q';

      const nextGame = new Chess(currentGame.fen());
      try {
        const move = nextGame.move({ from, to, promotion });
        if (move) {
          if (!isMuted) {
            if (move.captured) playCapture();
            else if (nextGame.inCheck()) playCheck();
            else playSoundMove();
          }

          setGame(nextGame);
          setLastMove({ from, to });
          const updatedIndex = nextIndex + 1;
          setSolutionIndex(updatedIndex);

          // Check if solution complete after opponent move
          if (updatedIndex >= puzzle.requiredSolutionUci.length) {
            setIsCompleted(true);
            setCoachMessage('Nice, keep that pattern in mind.');
            setTotalPoints((prev) => {
              const nextVal = prev + 5;
              try {
                localStorage.setItem('pnp_practice_xp', nextVal.toString());
              } catch {
                // ignore
              }
              return nextVal;
            });
            void saveCompletedPuzzle(wrongAttempts, hintsUsed);
          } else {
            // Opponent finished move: Clear thinking status, prompt user to continue
            setCoachMessage('Your turn to continue the attack!');
          }
        }
      } catch (err) {
        console.error('Opponent move execution failed:', err);
      } finally {
        setIsOpponentThinking(false);
      }
    },
    [
      hintsUsed,
      isMuted,
      playCapture,
      playCheck,
      playSoundMove,
      puzzle.requiredSolutionUci,
      saveCompletedPuzzle,
      wrongAttempts,
    ]
  );

  // Move validation logic
  const handleMoveAttempt = useCallback(
    (from: string, to: string): boolean => {
      if (isCompleted || isOpponentThinking) return false;

      const expectedUci = puzzle.requiredSolutionUci[solutionIndex];
      if (!expectedUci) return false;

      const expectedFrom = expectedUci.slice(0, 2);
      const expectedTo = expectedUci.slice(2, 4);

      // Check if candidate matches legal rules and solution
      const nextGame = new Chess(game.fen());
      let playedMove: Move | null = null;
      try {
        playedMove = nextGame.move({
          from,
          to,
          promotion: expectedUci[4] || 'q',
        });
      } catch {
        return false;
      }

      if (!playedMove) return false;

      const isCorrect = from === expectedFrom && to === expectedTo;

      if (!isCorrect) {
        // Wrong move
        setWrongAttempts((prev) => prev + 1);
        if (!isMuted) playIllegal();

        setCoachMessage('Not quite. Try another move.');

        setLastMove({
          from,
          to,
          toTint: 'rgba(239, 68, 68, 0.65)',
        });

        setSelectedSquare(null);
        setLegalMoves([]);

        window.setTimeout(() => {
          setCoachMessage(defaultCoachPrompt);
        }, 1500);

        return false;
      }

      // Correct move
      if (!isMuted) {
        if (playedMove.captured) playCapture();
        else if (nextGame.inCheck()) playCheck();
        else playSoundMove();
      }

      setGame(nextGame);
      setLastMove({ from, to });
      setSelectedSquare(null);
      setLegalMoves([]);

      const nextIndex = solutionIndex + 1;
      setSolutionIndex(nextIndex);

      if (nextIndex >= puzzle.requiredSolutionUci.length) {
        // Puzzle fully completed!
        setIsCompleted(true);
        setCoachMessage('Nice, keep that pattern in mind.');
        setTotalPoints((prev) => {
          const nextVal = prev + 5;
          try {
            localStorage.setItem('pnp_practice_xp', nextVal.toString());
          } catch {
            // ignore
          }
          return nextVal;
        });
        void saveCompletedPuzzle(wrongAttempts, hintsUsed);
        return true;
      }

      // Correct move, now opponent replies
      setCoachMessage('Opponent is responding…');
      setIsOpponentThinking(true);

      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
      }
      opponentTimerRef.current = window.setTimeout(() => {
        playOpponentReply(nextGame, nextIndex);
      }, 420);

      return true;
    },
    [
      defaultCoachPrompt,
      game,
      hintsUsed,
      isCompleted,
      isMuted,
      isOpponentThinking,
      playCapture,
      playCheck,
      playIllegal,
      playOpponentReply,
      playSoundMove,
      puzzle.requiredSolutionUci,
      saveCompletedPuzzle,
      solutionIndex,
      wrongAttempts,
    ]
  );

  // Square click selection
  const handleSquareClick = useCallback(
    (square: string) => {
      if (isCompleted || isOpponentThinking) return;

      const currentPiece = game.get(square as Square);
      const studentColor = puzzle.toMove === 'white' ? 'w' : 'b';

      if (!selectedSquare) {
        if (currentPiece && currentPiece.color === studentColor) {
          setSelectedSquare(square);
          const moves = game.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map((m) => m.to));
        }
        return;
      }

      // If clicking own piece again, switch selection
      if (currentPiece && currentPiece.color === studentColor) {
        if (square === selectedSquare) {
          setSelectedSquare(null);
          setLegalMoves([]);
        } else {
          setSelectedSquare(square);
          const moves = game.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map((m) => m.to));
        }
        return;
      }

      // Try playing move from selectedSquare to square
      if (legalMoves.includes(square)) {
        handleMoveAttempt(selectedSquare, square);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    },
    [game, handleMoveAttempt, isCompleted, isOpponentThinking, legalMoves, puzzle.toMove, selectedSquare]
  );

  // Expected move coordinates for hints/arrows
  const currentExpectedUci = puzzle.requiredSolutionUci[solutionIndex];
  const hintFromSquare = currentExpectedUci ? currentExpectedUci.slice(0, 2) : null;
  const hintToSquare = currentExpectedUci ? currentExpectedUci.slice(2, 4) : null;

  // Hint button click behavior:
  // Click 1: Display text hint at the top
  // Click 2: "Show" displays arrow on the board and "There it is. Play the move!" at the top
  const handleHintClick = () => {
    if (isCompleted || isOpponentThinking) return;

    if (hintStage === 0) {
      setHintsUsed((prev) => prev + 1);
      setHintStage(1);
      setCoachMessage(
        puzzle.hint2 ||
          `Look closely at the square ${hintFromSquare?.toUpperCase() || ''}. Can you spot the idea?`
      );
    } else {
      setHintStage(2);
      setCoachMessage('There it is. Play the move!');
    }
  };

  const handleReset = () => {
    setGame(new Chess(puzzle.fen));
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setSolutionIndex(0);
    setHintStage(0);
    setCoachMessage(defaultCoachPrompt);
    setIsOpponentThinking(false);
    setIsCompleted(false);
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
    }
  };

  // Custom arrows on board: When hintStage === 2 (Show), render vibrant green arrow
  const customArrows = useMemo((): ChessArrow[] => {
    if (hintStage === 2 && hintFromSquare && hintToSquare) {
      return [{ startSquare: hintFromSquare, endSquare: hintToSquare, color: '#34d399' }];
    }
    return [];
  }, [hintFromSquare, hintStage, hintToSquare]);

  // Custom square styles for hints
  const hintSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (hintStage >= 1 && hintFromSquare) {
      styles[hintFromSquare] = {
        backgroundColor: 'rgba(56, 189, 248, 0.45)',
        boxShadow: 'inset 0 0 10px rgba(14, 165, 233, 0.85)',
      };
    }
    if (hintStage === 2 && hintToSquare) {
      styles[hintToSquare] = {
        backgroundColor: 'rgba(52, 211, 153, 0.45)',
        boxShadow: 'inset 0 0 10px rgba(16, 185, 129, 0.85)',
      };
    }
    return styles;
  }, [hintFromSquare, hintStage, hintToSquare]);

  const legalTargets = useMemo(() => {
    return legalMoves.map((to) => ({
      to,
      isCapture: Boolean(game.get(to as Square)),
    }));
  }, [game, legalMoves]);

  return (
    <div className="mx-auto w-full max-w-5xl py-2 sm:py-4">
      {/* Back button link */}
      <div className="mb-4 flex items-center">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition shadow-xs cursor-pointer"
          title="Back to menu"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Top Coach Banner matching reference images */}
      <div className="mb-5 flex items-center gap-3.5">
        <RobotMascot isCelebrating={isCompleted} />
        <p className="text-sm sm:text-base font-medium text-white/95 leading-snug">
          {coachMessage}
        </p>
      </div>

      {/* Main Grid: Prominent Board on Left, Minimalist Card on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left: The Chessboard */}
        <div className="lg:col-span-8 xl:col-span-8">
          <div className="relative">
            <ChessboardView
              fen={game.fen()}
              boardOrientation={boardOrientation}
              isInteractive={!isCompleted && !isOpponentThinking}
              onPieceDrop={handleMoveAttempt}
              onSquareClick={handleSquareClick}
              lastMove={lastMove}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              customArrows={customArrows}
              customSquareStyles={hintSquareStyles}
              showNotation={true}
              showExternalCoordinates={false}
              theme="purple"
            />
          </div>
        </div>

        {/* Right: Minimalist Controls & XP Card matching reference images */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4 pt-1">
          {/* Top Actions: Hint button or Completed Next button */}
          {!isCompleted ? (
            <div>
              <button
                type="button"
                onClick={handleHintClick}
                disabled={isOpponentThinking}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Lightbulb className="h-4 w-4 text-amber-400" />
                <span>{hintStage === 0 ? 'Hint' : hintStage === 1 ? 'Show Move' : 'Hint'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              {/* Reset/Inspect Icon Button */}
              <button
                type="button"
                onClick={handleReset}
                title="Review / Reset position"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white hover:bg-white/15 transition cursor-pointer shadow-md"
              >
                <ScanSearch className="h-5 w-5" />
              </button>

              {/* Purple Pill Next Puzzle CTA */}
              <button
                type="button"
                onClick={onNext}
                className="flex-1 rounded-2xl bg-[#6366f1] hover:bg-[#5255e4] text-white font-bold py-3.5 px-6 shadow-lg shadow-indigo-950/40 cursor-pointer transition text-center text-sm"
              >
                Next puzzle
              </button>
            </div>
          )}

          {/* XP Card matching reference images */}
          <div className="rounded-2xl border border-white/10 bg-[#1e2025] p-4 text-white shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/90">
                <span>XP</span>
                {isCompleted && (
                  <span className="text-emerald-400 font-extrabold text-xs animate-in zoom-in-75 duration-300">
                    +5
                  </span>
                )}
              </div>

              {/* Level Flag Badge */}
              <div className="relative flex items-center justify-center">
                <span className="rounded bg-black/50 px-2 py-0.5 text-xs font-bold text-white border border-white/15 shadow-inner">
                  {level}
                </span>
              </div>
            </div>

            {/* Glowing Emerald Progress Bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#12281a] p-0.5">
              <div
                className="h-full rounded-full bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.7)] transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>

            {/* Bottom Range */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/60 pt-0.5">
              <span className="transition-all duration-300 text-white font-bold">{currentLevelXp}</span>
              <span>{targetLevelXp}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePuzzleTrainer;