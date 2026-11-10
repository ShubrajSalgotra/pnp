import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { Arrow } from 'react-chessboard';
import { auth } from '../services/firebase';
import { getPracticeStats, recordPracticeResult } from '../services/practiceService';
import { stockfishService } from '../services/stockfishService';
import type { PracticePuzzle } from '../types/practice';
import { ChessboardView, type ChessArrow } from './chess/ChessboardView';
import { useChessSounds } from '../hooks/useChessSounds';
import {
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  CircleX,
  Lightbulb,
  Lock,
  Palette,
  ScanSearch,
  Undo2,
  X,
} from 'lucide-react';

export type BoardThemeId = 'purple' | 'classic' | 'forest' | 'wood' | 'gold';

export interface BoardThemeConfig {
  id: BoardThemeId;
  name: string;
  subtitle: string;
  requiredCoins: number;
  lightColor: string;
  darkColor: string;
}

export const AVAILABLE_BOARD_THEMES: BoardThemeConfig[] = [
  {
    id: 'purple',
    name: 'Royal Amethyst',
    subtitle: 'Signature vibrant purple',
    requiredCoins: 0,
    lightColor: '#9ea4f6',
    darkColor: '#554de0',
  },
  {
    id: 'classic',
    name: 'Tournament Green',
    subtitle: 'Classic championship match',
    requiredCoins: 0,
    lightColor: '#eeeed2',
    darkColor: '#769656',
  },
  {
    id: 'forest',
    name: 'Emerald Forest',
    subtitle: 'Deep woodland & mint',
    requiredCoins: 400,
    lightColor: '#dee7d9',
    darkColor: '#2d6a4f',
  },
  {
    id: 'wood',
    name: 'Master Walnut',
    subtitle: 'Handcrafted wood finish',
    requiredCoins: 600,
    lightColor: '#f0d9b5',
    darkColor: '#b58863',
  },
  {
    id: 'gold',
    name: 'Obsidian Gold',
    subtitle: 'Grandmaster luxury gold',
    requiredCoins: 800,
    lightColor: '#fef3c7',
    darkColor: '#854d0e',
  },
];

interface PracticePuzzleTrainerProps {
  puzzle: PracticePuzzle;
  puzzleNumber: number;
  totalPuzzles: number;
  hasNextPuzzle: boolean;
  onBack: () => void;
  onNext: () => void;
}

type PuzzleMoveSnapshot = {
  fen: string;
  solutionIndex: number;
  lastMove: { from: string; to: string; toTint?: string } | null;
};

type PuzzleMoveFeedback = {
  status: 'wrong' | 'correct';
  message: string;
};

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
  const [hintMessage, setHintMessage] = useState('');
  const [moveFeedback, setMoveFeedback] = useState<PuzzleMoveFeedback | null>(null);
  const [drawnLineArrows, setDrawnLineArrows] = useState<Arrow[]>([]);
  const [arrowResetKey, setArrowResetKey] = useState(0);
  const [isAnalyzingLine, setIsAnalyzingLine] = useState(false);
  const [lineAnalysisMessage, setLineAnalysisMessage] = useState('');
  const [isOpponentThinking, setIsOpponentThinking] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted] = useState(false);

  // Coins & Theme unlock milestones (0, 400, 600, 800)
  const [totalCoins, setTotalCoins] = useState<number>(() => {
    try {
      const savedCoins = localStorage.getItem('pnp_practice_coins');
      if (savedCoins) {
        const parsed = parseInt(savedCoins, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
      const savedXp = localStorage.getItem('pnp_practice_xp');
      if (savedXp) {
        const parsed = parseInt(savedXp, 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore
    }
    return 25; // Default starter coins
  });

  const [selectedTheme, setSelectedTheme] = useState<BoardThemeId>(() => {
    try {
      const saved = localStorage.getItem('pnp_board_theme');
      if (saved && ['purple', 'classic', 'forest', 'wood', 'gold'].includes(saved)) {
        return saved as BoardThemeId;
      }
    } catch {
      // ignore
    }
    return 'purple';
  });

  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  // Milestone progression for board unlocks (400, 600, 800)
  const { nextMilestone, nextThemeName, progressPercent } = useMemo(() => {
    if (totalCoins < 400) {
      const pct = Math.min(100, Math.max(5, Math.round((totalCoins / 400) * 100)));
      return {
        nextMilestone: 400,
        nextThemeName: 'Emerald Forest',
        progressPercent: pct,
      };
    } else if (totalCoins < 600) {
      const pct = Math.min(100, Math.max(5, Math.round(((totalCoins - 400) / 200) * 100)));
      return {
        nextMilestone: 600,
        nextThemeName: 'Master Walnut',
        progressPercent: pct,
      };
    } else if (totalCoins < 800) {
      const pct = Math.min(100, Math.max(5, Math.round(((totalCoins - 600) / 200) * 100)));
      return {
        nextMilestone: 800,
        nextThemeName: 'Obsidian Gold',
        progressPercent: pct,
      };
    } else {
      return {
        nextMilestone: 800,
        nextThemeName: 'All Themes Unlocked',
        progressPercent: 100,
      };
    }
  }, [totalCoins]);

  const currentThemeObj = useMemo(() => {
    return AVAILABLE_BOARD_THEMES.find((t) => t.id === selectedTheme) || AVAILABLE_BOARD_THEMES[0];
  }, [selectedTheme]);

  const handleEquipTheme = (themeId: BoardThemeId) => {
    const target = AVAILABLE_BOARD_THEMES.find((t) => t.id === themeId);
    if (!target) return;
    if (totalCoins < target.requiredCoins) {
      return;
    }
    setSelectedTheme(themeId);
    try {
      localStorage.setItem('pnp_board_theme', themeId);
    } catch {
      // ignore
    }
  };

  const opponentTimerRef = useRef<number | null>(null);
  const resultSavedRef = useRef(false);
  const completedRewardedRef = useRef(false);
  const engineRequestIdRef = useRef(0);
  const moveHistoryRef = useRef<PuzzleMoveSnapshot[]>([]);
  const [moveHistoryLength, setMoveHistoryLength] = useState(0);

  // Load user streak and points from Firestore
  useEffect(() => {
    async function loadStats() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const stats = await getPracticeStats(user.uid);
        if (typeof stats.points === 'number' && stats.points > 0) {
          setTotalCoins(stats.points);
          try {
            localStorage.setItem('pnp_practice_coins', stats.points.toString());
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
    setHintMessage('');
    setMoveFeedback(null);
    setDrawnLineArrows([]);
    setArrowResetKey((prev) => prev + 1);
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');
    moveHistoryRef.current = [];
    setMoveHistoryLength(0);
    setIsOpponentThinking(false);
    setIsCompleted(false);
    resultSavedRef.current = false;
    completedRewardedRef.current = false;
    engineRequestIdRef.current += 1;

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
      engineRequestIdRef.current += 1;
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
          setTotalCoins(result.stats.points);
          try {
            localStorage.setItem('pnp_practice_coins', result.stats.points.toString());
            localStorage.setItem('pnp_practice_xp', result.stats.points.toString());
          } catch {
            // ignore
          }
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
            setMoveFeedback({ status: 'correct', message: 'Puzzle complete! Great sequence.' });
            if (!completedRewardedRef.current) {
              completedRewardedRef.current = true;
              setTotalCoins((prev) => {
                const nextVal = prev + 10;
                try {
                  localStorage.setItem('pnp_practice_coins', nextVal.toString());
                  localStorage.setItem('pnp_practice_xp', nextVal.toString());
                } catch {
                  // ignore
                }
                return nextVal;
              });
            }
            void saveCompletedPuzzle(wrongAttempts, hintsUsed);
          } else {
            setMoveFeedback({ status: 'correct', message: 'Good! Now continue the combination.' });
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
        setMoveFeedback({ status: 'wrong', message: 'Not quite.' });

        setLastMove({
          from,
          to,
          toTint: 'rgba(239, 68, 68, 0.65)',
        });

        setSelectedSquare(null);
        setLegalMoves([]);

        return false;
      }

      // Correct move
      engineRequestIdRef.current += 1;
      setIsAnalyzingLine(false);
      setDrawnLineArrows([]);
      setLineAnalysisMessage('');
      setMoveFeedback({
        status: 'correct',
        message: 'Correct move!',
      });
      moveHistoryRef.current = [
        ...moveHistoryRef.current,
        {
          fen: game.fen(),
          solutionIndex,
          lastMove: lastMove?.toTint ? null : lastMove,
        },
      ];
      setMoveHistoryLength(moveHistoryRef.current.length);
      setHintStage(0);
      setHintMessage('');

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
        setMoveFeedback({ status: 'correct', message: 'Puzzle complete! Great move.' });
        if (!completedRewardedRef.current) {
          completedRewardedRef.current = true;
          setTotalCoins((prev) => {
            const nextVal = prev + 10;
            try {
              localStorage.setItem('pnp_practice_coins', nextVal.toString());
              localStorage.setItem('pnp_practice_xp', nextVal.toString());
            } catch {
              // ignore
            }
            return nextVal;
          });
        }
        void saveCompletedPuzzle(wrongAttempts, hintsUsed);
        return true;
      }

      // Correct move, now opponent replies
      setMoveFeedback({ status: 'correct', message: 'Correct! Your opponent is responding…' });
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
      lastMove,
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

  const handleDrawnArrowsChange = (arrows: Arrow[]) => {
    setDrawnLineArrows(arrows);
    engineRequestIdRef.current += 1;
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');
  };

  const handleHintClick = () => {
    if (isCompleted || isOpponentThinking) return;

    engineRequestIdRef.current += 1;
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');

    if (hintStage === 0) {
      setHintsUsed((prev) => prev + 1);
      setHintStage(1);
      setHintMessage(
        puzzle.hint1 ||
          puzzle.hint2 ||
          `Look for a move starting from ${hintFromSquare?.toUpperCase() || 'the key square'}.`
      );
    } else {
      setHintStage(2);
      setHintMessage(
        `The solution starts with ${hintFromSquare?.toUpperCase()} to ${hintToSquare?.toUpperCase()}. Play the move!`
      );
    }
  };

  const handleClearLine = () => {
    engineRequestIdRef.current += 1;
    setDrawnLineArrows([]);
    setArrowResetKey((prev) => prev + 1);
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');
  };

  const handleUndo = () => {
    const previousPosition = moveHistoryRef.current.pop();
    if (!previousPosition) return;

    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }

    engineRequestIdRef.current += 1;
    setGame(new Chess(previousPosition.fen));
    setSolutionIndex(previousPosition.solutionIndex);
    setLastMove(previousPosition.lastMove);
    setSelectedSquare(null);
    setLegalMoves([]);
    setIsOpponentThinking(false);
    setIsCompleted(false);
    setHintStage(0);
    setHintMessage('');
    setMoveFeedback(null);
    setDrawnLineArrows([]);
    setArrowResetKey((prev) => prev + 1);
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');
    setMoveHistoryLength(moveHistoryRef.current.length);
  };

  const handleReset = () => {
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    engineRequestIdRef.current += 1;
    setGame(new Chess(puzzle.fen));
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setSolutionIndex(0);
    setHintStage(0);
    setHintMessage('');
    setMoveFeedback(null);
    setDrawnLineArrows([]);
    setArrowResetKey((prev) => prev + 1);
    setIsAnalyzingLine(false);
    setLineAnalysisMessage('');
    moveHistoryRef.current = [];
    setMoveHistoryLength(0);
    setIsOpponentThinking(false);
    setIsCompleted(false);
  };

  // Hint arrows are overlays; students draw their own line directly on the board.
  const customArrows = useMemo((): ChessArrow[] => {
    if (hintStage === 2 && hintFromSquare && hintToSquare) {
      return [{ startSquare: hintFromSquare, endSquare: hintToSquare, color: '#34d399' }];
    }
    return [];
  }, [hintFromSquare, hintStage, hintToSquare]);

  const handleAnalyzeLine = async () => {
    if (isCompleted || isOpponentThinking || isAnalyzingLine) return;

    if (drawnLineArrows.length === 0) {
      setLineAnalysisMessage('Draw a move line on the board first.');
      return;
    }

    const analysisGame = new Chess(game.fen());
    const lineUci: string[] = [];
    const lineSan: string[] = [];

    try {
      drawnLineArrows.forEach(({ startSquare, endSquare }) => {
        const move = analysisGame.move({
          from: startSquare as Square,
          to: endSquare as Square,
          promotion: 'q',
        });
        lineUci.push(`${move.from}${move.to}${move.promotion || ''}`);
        lineSan.push(move.san);
      });
    } catch {
      setLineAnalysisMessage('That arrow line is not a legal sequence from this position.');
      return;
    }

    const requestId = ++engineRequestIdRef.current;
    const finalFen = analysisGame.fen();
    setLineAnalysisMessage('');
    setIsAnalyzingLine(true);

    try {
      const { evaluation } = await stockfishService.evaluatePosition(finalFen, 12);
      if (requestId !== engineRequestIdRef.current) return;

      const expectedLine = puzzle.requiredSolutionUci.slice(
        solutionIndex,
        solutionIndex + lineUci.length
      );
      const followsSolution =
        expectedLine.length === lineUci.length &&
        lineUci.every((move, index) => move === expectedLine[index]);
      let positionEvaluation: string;

      if (Math.abs(evaluation) >= 99000) {
        const mateIn =
          evaluation > 0
            ? Math.max(1, Math.round((100000 - evaluation) / 100))
            : Math.max(1, Math.round((-100000 - evaluation) / 100));
        positionEvaluation = `The position leads to mate in ${mateIn} for ${
          evaluation > 0 ? 'White' : 'Black'
        }.`;
      } else if (Math.abs(evaluation) < 25) {
        positionEvaluation = 'The position is roughly equal.';
      } else {
        positionEvaluation = `${evaluation > 0 ? 'White' : 'Black'} is ahead by about ${(
          Math.abs(evaluation) / 100
        ).toFixed(1)} pawns after this line.`;
      }

      setLineAnalysisMessage(
        `Your line: ${lineSan.join(' ')}. ${
          followsSolution
            ? 'It matches the puzzle solution so far.'
            : 'It does not match the puzzle solution.'
        } ${positionEvaluation}`
      );
    } catch (error: unknown) {
      if (requestId !== engineRequestIdRef.current) return;
      console.error('Puzzle line analysis failed:', error);
      setLineAnalysisMessage('This line could not be analyzed right now. Please try again.');
    } finally {
      if (requestId === engineRequestIdRef.current) {
        setIsAnalyzingLine(false);
      }
    }
  };

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
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 transition shadow-xs cursor-pointer"
          title="Back to menu"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
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
              onArrowsChange={handleDrawnArrowsChange}
              allowDrawingArrows={!isCompleted && !isOpponentThinking && !isAnalyzingLine}
              clearArrowsOnClick={false}
              arrowResetKey={arrowResetKey}
              lastMove={lastMove}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              customArrows={customArrows}
              customSquareStyles={hintSquareStyles}
              showNotation={true}
              showExternalCoordinates={false}
              theme={selectedTheme}
            />
          </div>
        </div>

        {/* Right: Minimalist Controls, Coin Card & Theme Unlocker */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4 pt-1">
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs leading-relaxed text-slate-600 dark:border-white/10 dark:bg-[#1e2025] dark:text-white/65">
            Draw a line on the board by right-clicking and dragging from square to square, then analyze your line.
            {drawnLineArrows.length > 0 && (
              <span className="ml-1 font-semibold text-slate-800 dark:text-white">
                {drawnLineArrows.length} {drawnLineArrows.length === 1 ? 'move' : 'moves'} drawn
              </span>
            )}
          </div>

          {/* Puzzle controls */}
          {!isCompleted ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={moveHistoryLength === 0}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                title="Go back one solution step"
              >
                <Undo2 className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleHintClick}
                disabled={isOpponentThinking || hintStage === 2}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>{hintStage === 0 ? 'Hint' : hintStage === 1 ? 'Show Move' : 'Move Shown'}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleAnalyzeLine()}
                disabled={isOpponentThinking || isAnalyzingLine}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/15"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{isAnalyzingLine ? 'Analyzing line…' : 'Analyze line'}</span>
              </button>
              {drawnLineArrows.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearLine}
                  disabled={isAnalyzingLine}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
                  title="Clear your drawn line"
                >
                  <X className="h-4 w-4" />
                  <span>Clear line</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 animate-in fade-in duration-300">
              <button
                type="button"
                onClick={handleUndo}
                disabled={moveHistoryLength === 0}
                title="Go back one solution step"
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-slate-700 shadow-md transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
              >
                <Undo2 className="h-4 w-4" />
                <span className="text-sm font-semibold">Back</span>
              </button>

              {/* Reset/Inspect Icon Button */}
              <button
                type="button"
                onClick={handleReset}
                title="Review / Reset position"
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 transition cursor-pointer shadow-md"
              >
                <ScanSearch className="h-5 w-5" />
              </button>

              {/* Purple Pill Next Puzzle CTA */}
              <button
                type="button"
                onClick={onNext}
                className="flex-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 shadow-lg shadow-indigo-950/20 dark:shadow-indigo-950/40 cursor-pointer transition text-center text-sm"
              >
                Next puzzle
              </button>
            </div>
          )}

          {hintMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
              <div className="mb-1 flex items-center gap-2 font-bold">
                <Lightbulb className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{hintStage === 2 ? 'Solution hint' : 'Hint'}</span>
              </div>
              <p>{hintMessage}</p>
            </div>
          )}

          {moveFeedback && (
            <div
              role="status"
              aria-live="polite"
              className={`rounded-xl border p-3.5 text-sm shadow-sm transition-colors ${
                moveFeedback.status === 'wrong'
                  ? 'border-rose-200 bg-white text-slate-800 dark:border-rose-400/25 dark:bg-[#1e2025] dark:text-white'
                  : 'border-emerald-200 bg-white text-slate-800 dark:border-emerald-400/25 dark:bg-[#1e2025] dark:text-white'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    moveFeedback.status === 'wrong'
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300'
                  }`}
                >
                  {moveFeedback.status === 'wrong' ? (
                    <CircleX className="h-[18px] w-[18px]" />
                  ) : (
                    <CheckCircle2 className="h-[18px] w-[18px]" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-5">
                    {moveFeedback.status === 'wrong' ? 'Not quite' : moveFeedback.message}
                  </p>
                  {moveFeedback.status === 'wrong' && (
                    <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-white/65">
                      That move doesn’t match the solution. Try again.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {(isAnalyzingLine || lineAnalysisMessage) && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs leading-relaxed text-slate-600 shadow-sm dark:border-white/10 dark:bg-[#1e2025] dark:text-white/65"
            >
              {isAnalyzingLine ? 'Analyzing the position after your line…' : lineAnalysisMessage}
            </div>
          )}

          {/* Coin Card with Milestones towards Board Unlocks */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-slate-900 shadow-sm space-y-3 dark:border-white/10 dark:bg-[#1e2025] dark:text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-extrabold">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span>Coins</span>
                </span>
                {isCompleted && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs animate-in zoom-in-75 duration-300">
                    +10 🪙
                  </span>
                )}
              </div>

              {/* Total Coin Badge */}
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-300/80 dark:bg-black/50 dark:border-white/15 px-2.5 py-0.5 text-xs font-extrabold text-amber-800 dark:text-amber-300 shadow-xs">
                <span>🪙</span>
                <span className="tabular-nums font-mono">{totalCoins}</span>
              </div>
            </div>

            {/* Glowing Emerald-Gold Progress Bar toward Next Board Unlock */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#12281a] p-0.5 border border-slate-200/60 dark:border-transparent">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                }}
              />
            </div>

            {/* Bottom Range: Current coins & Next milestone */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-white/60 pt-0.5">
              <span className="transition-all duration-300 text-slate-900 dark:text-white font-bold">
                {totalCoins} 🪙
              </span>
              <span className="text-right">
                {totalCoins < 800 ? (
                  <>
                    Next unlock: <strong className="text-emerald-600 dark:text-emerald-400">{nextMilestone} 🪙</strong> ({nextThemeName})
                  </>
                ) : (
                  <span className="text-amber-600 dark:text-amber-300 font-bold">All Boards Unlocked! 🏆</span>
                )}
              </span>
            </div>
          </div>

          {/* Board Themes Unlock & Equip Selector */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-slate-900 shadow-sm dark:border-white/10 dark:bg-[#1e2025] dark:text-white space-y-3">
            <button
              type="button"
              onClick={() => setIsThemePickerOpen((prev) => !prev)}
              className="flex w-full items-center justify-between cursor-pointer text-left outline-none group"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-white/10 dark:text-emerald-400">
                  <Palette className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/90">
                      Board Themes
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-white/70">
                      {AVAILABLE_BOARD_THEMES.filter((t) => totalCoins >= t.requiredCoins).length}/{AVAILABLE_BOARD_THEMES.length}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-white/60">
                    Active: <strong className="text-primary-700 dark:text-emerald-400 font-semibold">{currentThemeObj.name}</strong>
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 dark:text-white/50 transition-transform duration-200 ${
                  isThemePickerOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* List of Board Themes with 400, 600, 800 Unlock Milestones */}
            {isThemePickerOpen && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/10 animate-in fade-in duration-200">
                {AVAILABLE_BOARD_THEMES.map((item) => {
                  const isUnlocked = totalCoins >= item.requiredCoins;
                  const isActive = selectedTheme === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isActive
                          ? 'border-emerald-500/50 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-500/40'
                          : isUnlocked
                          ? 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/80 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/10'
                          : 'border-dashed border-slate-200 bg-slate-50/30 dark:border-white/5 dark:bg-white/[0.02] opacity-75'
                      }`}
                    >
                      {/* Theme Preview & Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* 2x2 board color preview swatch */}
                        <div className="grid grid-cols-2 h-7 w-7 rounded-lg overflow-hidden shrink-0 border border-black/10 dark:border-white/20 shadow-xs">
                          <div style={{ backgroundColor: item.lightColor }} />
                          <div style={{ backgroundColor: item.darkColor }} />
                          <div style={{ backgroundColor: item.darkColor }} />
                          <div style={{ backgroundColor: item.lightColor }} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-white/60 truncate">
                            {isUnlocked
                              ? item.subtitle
                              : `Unlocks at ${item.requiredCoins} 🪙 (need ${item.requiredCoins - totalCoins} more)`}
                          </p>
                        </div>
                      </div>

                      {/* Action: Active / Equip / Locked */}
                      <div className="shrink-0 ml-2">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        ) : isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleEquipTheme(item.id)}
                            className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white dark:bg-white/15 dark:hover:bg-white/25 px-2.5 py-1 text-[11px] font-bold cursor-pointer transition shadow-xs"
                          >
                            Equip
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 dark:bg-black/40 px-2 py-1 text-[10px] font-bold text-slate-500 dark:text-white/40">
                            <Lock className="h-3 w-3" />
                            <span>{item.requiredCoins} 🪙</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PracticePuzzleTrainer;