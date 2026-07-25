import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Clock3,
  ExternalLink,
  Eye,
  Flag,
  Lightbulb,
  PartyPopper,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Target,
  Trophy
} from 'lucide-react';
import { GameAnalysis } from '../types/analysis';
import { ChessGame } from '../types/game';
import {
  PuzzleTrainingCategory,
  PuzzleTrainingConfig,
  TrainerPuzzle,
  WeaknessMiningProgress
} from '../types/puzzle';
import { useAuth } from '../contexts/AuthContext';
import { useChessboardInteraction } from '../hooks/useChessboardInteraction';
import { useChessSounds } from '../hooks/useChessSounds';
import { puzzleService } from '../services/puzzleService';
import { userDataService } from '../services/userDataService';
import { DEFAULT_PUZZLE_PROGRESS } from '../types/userData';
import { classificationMeta, formatSeconds, isImplausibleFen } from '../utils/gameReviewAnalysis';
import {
  BoardLastMove,
  HINT_SQUARE_TINT,
  WRONG_MOVE_TINT,
} from '../utils/chessboardTheme';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

const OPPONENT_REPLY_DELAY_MS = 420;
const CONFETTI_COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#f472b6', '#a78bfa', '#fb7185'];

interface PuzzleTrainerProps {
  analysis?: GameAnalysis | null;
  platform?: 'lichess' | 'chess.com';
  username?: string;
  games?: ChessGame[];
  rated?: boolean;
}

const trainingCategories: Array<{
  id: PuzzleTrainingCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'fix-weakness',
    title: 'Fix My Weaknesses',
    description: 'Replays critical moments from your last 20 games — long thinks and blunders.',
    icon: <ShieldAlert className="h-5 w-5" />
  },
  {
    id: 'master-opening',
    title: 'Master My Openings',
    description: 'Opening-phase puzzles to improve early plans, development, and punishment patterns.',
    icon: <BookOpen className="h-5 w-5" />
  },
  {
    id: 'master-endgames',
    title: 'Master My Endgames',
    description: 'Endgame puzzles for technique, calculation, and clean conversion.',
    icon: <Flag className="h-5 w-5" />
  }
];

const PuzzleTrainer: React.FC<PuzzleTrainerProps> = ({
  analysis,
  platform,
  username,
  games,
  rated
}) => {
  const { currentUser } = useAuth();
  const sounds = useChessSounds();
  const chessRef = useRef(new Chess());
  const sessionRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bestStreakRef = useRef(0);
  const failedRef = useRef(0);
  const byCategoryRef = useRef<Partial<Record<PuzzleTrainingCategory, number>>>({});
  const wrongFlashTimerRef = useRef<number | null>(null);
  const replyTimerRef = useRef<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PuzzleTrainingCategory | null>(null);
  const [trainingConfig, setTrainingConfig] = useState<PuzzleTrainingConfig | null>(null);
  const [currentPuzzle, setCurrentPuzzle] = useState<TrainerPuzzle | null>(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [status, setStatus] = useState('Choose a training target to begin.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [solved, setSolved] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  /** 0 = none, 1 = highlight piece square, 2 = green arrow */
  const [hintLevel, setHintLevel] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const [miningProgress, setMiningProgress] = useState<WeaknessMiningProgress | null>(null);
  const [lastMove, setLastMove] = useState<BoardLastMove | null>(null);
  const [wrongSquare, setWrongSquare] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      if (!currentUser?.id) {
        setSolved(0);
        setStreak(0);
        setBestStreak(0);
        bestStreakRef.current = 0;
        failedRef.current = 0;
        byCategoryRef.current = {};
        return;
      }

      const progress = await userDataService.loadPuzzleProgress(currentUser.id);
      if (cancelled) return;

      setSolved(progress.solved);
      setStreak(progress.streak);
      setBestStreak(progress.bestStreak);
      bestStreakRef.current = progress.bestStreak;
      failedRef.current = progress.failed || 0;
      byCategoryRef.current = progress.byCategory || {};
    };

    void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const persistProgress = (
    nextSolved: number,
    nextStreak: number,
    category: PuzzleTrainingCategory | null,
    targetRating: number | null,
    options?: { failed?: boolean; puzzleId?: string; rating?: number | null }
  ) => {
    if (!currentUser?.id) return;

    bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);
    setBestStreak(bestStreakRef.current);
    if (options?.failed) {
      failedRef.current += 1;
    } else if (category) {
      byCategoryRef.current = {
        ...byCategoryRef.current,
        [category]: (byCategoryRef.current[category] || 0) + 1,
      };
    }

    void userDataService.savePuzzleProgress({
      ...DEFAULT_PUZZLE_PROGRESS(currentUser.id),
      solved: nextSolved,
      failed: failedRef.current,
      streak: nextStreak,
      bestStreak: bestStreakRef.current,
      lastCategory: category,
      targetRating,
      byCategory: byCategoryRef.current,
    });

    if (options?.puzzleId) {
      void userDataService.recordPuzzleAttempt({
        userId: currentUser.id,
        puzzleId: options.puzzleId,
        category,
        rating: options.rating ?? null,
        solved: !options.failed,
        streakAfter: nextStreak,
      });
    }
  };

  const clearReplyTimer = () => {
    if (replyTimerRef.current != null) {
      window.clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
    setIsAwaitingReply(false);
  };

  const syncLastMoveFromBoard = () => {
    const history = chessRef.current.history({ verbose: true });
    const previous = history[history.length - 1];
    setLastMove(previous ? { from: previous.from, to: previous.to } : null);
  };

  const activeCategory = useMemo(
    () => trainingCategories.find(category => category.id === selectedCategory),
    [selectedCategory]
  );
  const sideToMove = fen.split(' ')[1] === 'b' ? 'Black' : 'White';
  const isWeaknessMode = selectedCategory === 'fix-weakness';
  const weakness = currentPuzzle?.weakness;

  useEffect(() => {
    if (!selectedCategory) return;

    let cancelled = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const startSession = async () => {
      setIsLoading(true);
      setError(null);
      setMiningProgress(null);
      setStatus(
        selectedCategory === 'fix-weakness'
          ? 'Mining weakness positions from your recent games…'
          : 'Loading your puzzle rating…'
      );

      try {
        const config = await puzzleService.createTrainingConfig(selectedCategory, {
          analysis,
          platform,
          username,
          signal: controller.signal
        });

        if (cancelled || controller.signal.aborted) return;

        setTrainingConfig(config);
        setStreak(0);
        await loadPuzzle(config, controller);
      } catch (startError) {
        if (cancelled || controller.signal.aborted) return;
        if (startError instanceof DOMException && startError.name === 'AbortError') return;
        const message =
          startError instanceof Error ? startError.message : 'Could not start puzzle training.';
        setError(message);
        setStatus('Puzzle loading failed.');
        setIsLoading(false);
      }
    };

    void startSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, analysis, platform, username]);

  useEffect(() => {
    if (!selectedCategory || !sessionRef.current) return;

    sessionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedCategory]);

  const loadPuzzle = async (
    config = trainingConfig,
    existingController?: AbortController
  ) => {
    if (!config) return;

    const controller = existingController ?? new AbortController();
    if (!existingController) {
      abortRef.current?.abort();
      abortRef.current = controller;
    }

    clearReplyTimer();
    setIsLoading(true);
    setError(null);
    setHintLevel(0);
    setIsSolved(false);
    setShowCelebration(false);
    setMiningProgress(null);
    setStatus(
      config.category === 'fix-weakness'
        ? 'Mining weakness positions from your recent games…'
        : `Loading a ~${config.targetRating} rated puzzle...`
    );

    try {
      const puzzle = await puzzleService.getNextPuzzle(config, {
        analysis,
        platform,
        username,
        games,
        rated,
        signal: controller.signal,
        onWeaknessProgress: progress => {
          if (controller.signal.aborted) return;
          setMiningProgress(progress);
          setStatus(progress.message);
        }
      });

      if (controller.signal.aborted) return;

      preparePuzzle(puzzle);
      setCurrentPuzzle(puzzle);
      setMiningProgress(null);
      setStatus(
        puzzle.weakness
          ? 'Find the move you missed in this game.'
          : 'Find the best move.'
      );
    } catch (loadError) {
      if (controller.signal.aborted) return;
      const message = loadError instanceof Error ? loadError.message : 'Could not load a puzzle.';
      setError(message);
      setStatus('Puzzle loading failed.');
      setMiningProgress(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const preparePuzzle = (puzzle: TrainerPuzzle) => {
    const puzzleGame = new Chess();

    if (puzzle.lichessPgn) {
      puzzleGame.loadPgn(puzzle.lichessPgn);
    } else if (puzzle.fen) {
      if (isImplausibleFen(puzzle.fen)) {
        throw new Error('This puzzle position looks corrupted. Please load the next puzzle.');
      }
      puzzleGame.load(puzzle.fen);
    } else {
      throw new Error('Puzzle is missing a starting position.');
    }

    if (isImplausibleFen(puzzleGame.fen())) {
      throw new Error('This puzzle position looks corrupted. Please load the next puzzle.');
    }

    chessRef.current = puzzleGame;
    setSolutionIndex(0);
    setFen(puzzleGame.fen());
    setLastMove(null);
    setWrongSquare(null);
    setHintLevel(0);
    setShowCelebration(false);
    setBoardOrientation(
      puzzle.weakness?.playerColor || (puzzleGame.turn() === 'w' ? 'white' : 'black')
    );
  };

  const getExpectedMove = () => currentPuzzle?.solution[solutionIndex];

  const getMoveFromUci = (uciMove: string) => {
    const move: { from: string; to: string; promotion?: string } = {
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
    };
    if (uciMove[4]) {
      move.promotion = uciMove[4];
    }
    return move;
  };

  const isLegalUciMove = (game: Chess, uciMove: string) => {
    return game.moves({ verbose: true }).some(move => {
      return move.from === uciMove.slice(0, 2) &&
        move.to === uciMove.slice(2, 4) &&
        (!uciMove[4] || move.promotion === uciMove[4]);
    });
  };

  const flashWrongSquare = (square: string) => {
    if (wrongFlashTimerRef.current != null) {
      window.clearTimeout(wrongFlashTimerRef.current);
    }
    setWrongSquare(square);
    wrongFlashTimerRef.current = window.setTimeout(() => {
      setWrongSquare(null);
      wrongFlashTimerRef.current = null;
    }, 420);
  };

  const playUciMove = (uciMove: string) => {
    if (!isLegalUciMove(chessRef.current, uciMove)) {
      throw new Error(`Illegal puzzle move: ${uciMove}`);
    }

    try {
      const move = chessRef.current.move(getMoveFromUci(uciMove));
      if (!move) {
        throw new Error(`Illegal puzzle move: ${uciMove}`);
      }
      return move;
    } catch {
      throw new Error(`Illegal puzzle move: ${uciMove}`);
    }
  };

  const finishPuzzle = useCallback(() => {
    setIsSolved(true);
    setShowCelebration(true);
    setHintLevel(0);
    const nextSolved = solved + 1;
    const nextStreak = streak + 1;
    setSolved(nextSolved);
    setStreak(nextStreak);
    sounds.playSuccess();

    const raiseDifficulty =
      !isWeaknessMode && puzzleService.shouldRaiseDifficulty(nextStreak) && trainingConfig;

    if (raiseDifficulty && trainingConfig) {
      const nextConfig = puzzleService.withRaisedTargetRating(trainingConfig);
      setTrainingConfig(nextConfig);
      persistProgress(nextSolved, nextStreak, selectedCategory, nextConfig.targetRating, {
        puzzleId: currentPuzzle?.id,
        rating: currentPuzzle?.rating ?? null,
      });
      setStatus(
        `Solved! ${puzzleService.getStreakLevelUp()} in a row — next puzzles aim near ${nextConfig.targetRating}.`
      );
      return;
    }

    persistProgress(nextSolved, nextStreak, selectedCategory, trainingConfig?.targetRating ?? null, {
      puzzleId: currentPuzzle?.id,
      rating: currentPuzzle?.rating ?? null,
    });
    setStatus(
      weakness
        ? `Solved! In the game you played ${weakness.playedMoveSan}.`
        : 'Solved! Nice calculation.'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isWeaknessMode,
    selectedCategory,
    solved,
    sounds,
    streak,
    trainingConfig,
    weakness,
  ]);

  const playOpponentReply = useCallback(
    (replyIndex: number, puzzle: TrainerPuzzle) => {
      const replyUci = puzzle.solution[replyIndex];
      if (!replyUci) return;

      try {
        const reply = playUciMove(replyUci);
        sounds.playFromMove({
          san: reply.san,
          captured: reply.captured,
          isCheck: reply.san.includes('+') || reply.san.includes('#'),
          isCheckmate: reply.san.includes('#'),
        });
        setLastMove({ from: reply.from, to: reply.to });
        const afterReply = replyIndex + 1;
        setSolutionIndex(afterReply);
        setFen(chessRef.current.fen());
        setIsAwaitingReply(false);
        replyTimerRef.current = null;

        if (afterReply >= puzzle.solution.length) {
          finishPuzzle();
        } else {
          setStatus('Correct. Continue the line.');
        }
      } catch (moveError) {
        setIsAwaitingReply(false);
        replyTimerRef.current = null;
        setError(
          moveError instanceof Error ? moveError.message : 'The puzzle line could not be played.'
        );
      }
    },
    // playUciMove is stable enough via chessRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finishPuzzle, sounds]
  );

  const applyPuzzleMove = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      const expectedMove = currentPuzzle?.solution[solutionIndex];

      if (!currentPuzzle || !expectedMove || isSolved || isLoading || isAwaitingReply) {
        return false;
      }

      if (!isLegalUciMove(chessRef.current, expectedMove)) {
        setError(
          'This puzzle position did not match the expected solution. Please load the next puzzle.'
        );
        return false;
      }

      const candidateMove = `${sourceSquare}${targetSquare}${expectedMove[4] || ''}`;

      if (candidateMove !== expectedMove) {
        sounds.playIllegal();
        flashWrongSquare(targetSquare);
        setStreak(0);
        persistProgress(solved, 0, selectedCategory, trainingConfig?.targetRating ?? null, {
          failed: true,
          puzzleId: currentPuzzle?.id,
          rating: currentPuzzle?.rating ?? null,
        });
        setStatus(
          weakness
            ? `Not quite. In the game you played ${weakness.playedMoveSan} — look for a stronger idea.`
            : 'Not quite. Try another idea.'
        );
        return false;
      }

      try {
        const played = playUciMove(expectedMove);
        sounds.playFromMove({
          san: played.san,
          captured: played.captured,
          isCheck: played.san.includes('+') || played.san.includes('#'),
          isCheckmate: played.san.includes('#'),
        });
        setLastMove({ from: played.from, to: played.to });
        setWrongSquare(null);
        setHintLevel(0);
        const afterPlayer = solutionIndex + 1;
        setSolutionIndex(afterPlayer);
        setFen(chessRef.current.fen());

        if (afterPlayer >= currentPuzzle.solution.length) {
          finishPuzzle();
          return true;
        }

        setStatus('Good! Opponent replies…');
        setIsAwaitingReply(true);
        const puzzleSnapshot = currentPuzzle;
        replyTimerRef.current = window.setTimeout(() => {
          playOpponentReply(afterPlayer, puzzleSnapshot);
        }, OPPONENT_REPLY_DELAY_MS);

        return true;
      } catch (moveError) {
        setError(
          moveError instanceof Error ? moveError.message : 'The puzzle line could not be played.'
        );
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      currentPuzzle,
      finishPuzzle,
      isAwaitingReply,
      isLoading,
      isSolved,
      playOpponentReply,
      selectedCategory,
      solutionIndex,
      solved,
      sounds,
      trainingConfig?.targetRating,
      weakness,
    ]
  );

  const expectedMove = getExpectedMove();
  const playerPlyCount = Math.ceil((currentPuzzle?.solution.length || 0) / 2);
  const currentPlayerMove = !currentPuzzle
    ? 0
    : isSolved
      ? playerPlyCount
      : Math.min(playerPlyCount, Math.floor(solutionIndex / 2) + 1);
  const canUndo =
    Boolean(currentPuzzle) &&
    !isLoading &&
    (isAwaitingReply || (!isSolved && solutionIndex >= 2));

  const undoLastMove = () => {
    if (!currentPuzzle || isLoading) return;

    if (isAwaitingReply) {
      clearReplyTimer();
      chessRef.current.undo();
      setSolutionIndex(Math.max(0, solutionIndex - 1));
      setFen(chessRef.current.fen());
      syncLastMoveFromBoard();
      setWrongSquare(null);
      setStatus(weakness ? 'Find the move you missed in this game.' : 'Find the best move.');
      return;
    }

    if (isSolved || solutionIndex < 2) return;

    chessRef.current.undo();
    chessRef.current.undo();
    setSolutionIndex(solutionIndex - 2);
    setFen(chessRef.current.fen());
    syncLastMoveFromBoard();
    setWrongSquare(null);
    setHintLevel(0);
    setStatus('Back one move — find the best continuation.');
  };

  const requestHint = () => {
    if (!currentPuzzle || isSolved || isLoading || isAwaitingReply || hintLevel >= 2) return;
    setHintLevel((level) => {
      const next = Math.min(2, level + 1);
      setStatus(
        next === 1 ? 'Hint: the key piece is highlighted.' : 'Hint: follow the green arrow.'
      );
      return next;
    });
  };

  const boardEnabled = Boolean(currentPuzzle && !isSolved && !isLoading && !isAwaitingReply);
  const extraSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (wrongSquare) {
      styles[wrongSquare] = { backgroundColor: WRONG_MOVE_TINT };
    }

    if (hintLevel >= 1 && expectedMove && !isSolved && !isAwaitingReply) {
      const from = expectedMove.slice(0, 2);
      styles[from] = {
        ...styles[from],
        backgroundColor: HINT_SQUARE_TINT,
      };
    }

    return Object.keys(styles).length > 0 ? styles : undefined;
  }, [expectedMove, hintLevel, isAwaitingReply, isSolved, wrongSquare]);

  const { boardOptions } = useChessboardInteraction({
    fen,
    enabled: boardEnabled,
    lastMove,
    extraSquareStyles,
    onMove: applyPuzzleMove,
  });

  const boardArrows = useMemo(() => {
    if (hintLevel < 2 || !expectedMove || isSolved || isAwaitingReply) return [];
    return [
      {
        startSquare: expectedMove.slice(0, 2),
        endSquare: expectedMove.slice(2, 4),
        color: '#15781B',
      },
    ];
  }, [expectedMove, hintLevel, isAwaitingReply, isSolved]);

  useEffect(() => {
    return () => {
      if (wrongFlashTimerRef.current != null) {
        window.clearTimeout(wrongFlashTimerRef.current);
      }
      if (replyTimerRef.current != null) {
        window.clearTimeout(replyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCategory) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        undoLastMove();
        return;
      }

      if ((event.key === 'h' || event.key === 'H') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        requestHint();
        return;
      }

      if (
        (event.key === 'ArrowRight' || event.key === 'n' || event.key === 'N') &&
        isSolved &&
        trainingConfig &&
        !isLoading
      ) {
        event.preventDefault();
        void loadPuzzle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canUndo,
    hintLevel,
    isAwaitingReply,
    isLoading,
    isSolved,
    selectedCategory,
    solutionIndex,
    trainingConfig,
  ]);

  const resetCurrentPuzzle = () => {
    if (!currentPuzzle) return;
    clearReplyTimer();
    setHintLevel(0);
    setIsSolved(false);
    setShowCelebration(false);
    setWrongSquare(null);
    setStatus(weakness ? 'Find the move you missed in this game.' : 'Find the best move.');
    preparePuzzle(currentPuzzle);
  };

  const showSolution = () => {
    if (!currentPuzzle) return;
    clearReplyTimer();

    try {
      let nextIndex = solutionIndex;
      let finalMove: { from: string; to: string } | null = null;
      while (nextIndex < currentPuzzle.solution.length) {
        const move = currentPuzzle.solution[nextIndex];
        const played = playUciMove(move);
        finalMove = { from: played.from, to: played.to };
        nextIndex += 1;
      }
      setSolutionIndex(nextIndex);
      setFen(chessRef.current.fen());
      if (finalMove) setLastMove(finalMove);
      setStreak(0);
      persistProgress(solved, 0, selectedCategory, trainingConfig?.targetRating ?? null, {
        failed: true,
        puzzleId: currentPuzzle?.id,
        rating: currentPuzzle?.rating ?? null,
      });
      setIsSolved(true);
      setShowCelebration(false);
      setHintLevel(0);
      setStatus(
        weakness
          ? `Solution shown. You played ${weakness.playedMoveSan} in the game.`
          : 'Solution shown. Try the next puzzle fresh.'
      );
    } catch (solutionError) {
      setError(solutionError instanceof Error ? solutionError.message : 'Could not show the solution.');
    }
  };

  const clearSelection = () => {
    abortRef.current?.abort();
    clearReplyTimer();
    setSelectedCategory(null);
    setTrainingConfig(null);
    setCurrentPuzzle(null);
    setError(null);
    setHintLevel(0);
    setIsSolved(false);
    setShowCelebration(false);
    setMiningProgress(null);
    setStatus('Choose a training target to begin.');
  };

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 18 }, (_, index) => ({
        id: index,
        left: `${6 + ((index * 17) % 88)}%`,
        delay: `${(index % 8) * 0.07}s`,
        drift: `${(index % 2 === 0 ? -1 : 1) * (8 + (index % 5) * 4)}px`,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    []
  );
  const miningPercent = miningProgress
    ? miningProgress.phase === 'loading-games'
      ? 8
      : miningProgress.candidatesTotal > 0
        ? Math.round((miningProgress.candidatesDone / miningProgress.candidatesTotal) * 100)
        : 15
    : 0;

  if (!selectedCategory) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {trainingCategories.map(category => {
          const config = puzzleService.buildTrainingConfig(category.id, analysis);
          const needsAccount = category.id === 'fix-weakness' && (!platform || !username);
          const isAdaptive = category.id === 'master-opening' || category.id === 'master-endgames';

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className="cursor-pointer rounded-2xl border border-primary-200/70 bg-white/70 p-4 text-left transition hover:border-primary-400 hover:bg-primary-50/70 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-primary-500/50 dark:hover:bg-slate-800/70"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
                {category.icon}
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-slate-900 dark:text-white">
                {category.title}
              </h3>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                {category.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
                  {config.angle}
                </span>
                <Badge variant="outline" className="h-fit w-fit capitalize border-primary-200 text-primary-700 dark:border-slate-600 dark:text-primary-300">
                  {needsAccount ? 'account needed' : isAdaptive ? 'adapts to you' : config.difficulty}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={sessionRef} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={clearSelection} className="cursor-pointer">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Change training
        </Button>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium text-slate-900 dark:text-white">{activeCategory?.title}</span>
          {trainingConfig && (
            <span className="ml-2 text-primary-700 dark:text-primary-300">
              · {trainingConfig.angle}
              {!isWeaknessMode && ` · ~${trainingConfig.targetRating}`}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="aurora-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <Target className="h-5 w-5" />
                {activeCategory?.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={`flex items-center justify-center gap-3 rounded-xl px-4 py-2 text-center text-sm font-medium ${
                  showCelebration || isSolved
                    ? 'bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/30'
                    : wrongSquare
                      ? 'bg-red-500/15 text-red-900 ring-1 ring-red-400/40 dark:bg-red-400/10 dark:text-red-100 dark:ring-red-400/30'
                      : isAwaitingReply
                        ? 'bg-amber-500/15 text-amber-900 ring-1 ring-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/30'
                        : 'bg-slate-900 text-white dark:bg-primary-500/20 dark:text-primary-100'
                }`}
              >
                <span className="min-w-0 truncate">{status}</span>
              </div>

              <div className="relative mx-auto aspect-square max-w-xl">
                <div className="review-chessboard h-full w-full overflow-hidden rounded-sm border border-[#8b5a2b]/70 shadow-elevated">
                  <Chessboard
                    options={{
                      ...boardOptions,
                      boardOrientation,
                      arrows: boardArrows,
                    }}
                  />
                </div>

                {isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm bg-white/70 dark:bg-slate-950/70">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-soft dark:bg-slate-900 dark:text-slate-200">
                      Loading puzzle…
                    </div>
                  </div>
                )}

                {showCelebration && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-sm bg-slate-950/55 p-4 backdrop-blur-[2px]">
                    <div className="puzzle-confetti pointer-events-none absolute inset-0">
                      {confettiPieces.map((piece) => (
                        <span
                          key={piece.id}
                          style={
                            {
                              left: piece.left,
                              backgroundColor: piece.color,
                              animationDelay: piece.delay,
                              '--drift': piece.drift,
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </div>
                    <div className="puzzle-celebrate-panel relative w-full max-w-sm rounded-2xl border border-emerald-300/40 bg-white/95 p-5 text-center shadow-elevated dark:border-emerald-400/30 dark:bg-slate-900/95">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                        <PartyPopper className="h-6 w-6" />
                      </div>
                      <h3 className="mt-3 font-display text-2xl font-semibold text-slate-900 dark:text-white">
                        Puzzle solved!
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {streak > 1 ? `${streak} in a row — keep it going.` : 'Nice find. Ready for another?'}
                      </p>
                      {weakness && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          In the game you played {weakness.playedMoveSan}
                        </p>
                      )}
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          className="flex-1 cursor-pointer"
                          onClick={() => loadPuzzle()}
                          disabled={!trainingConfig || isLoading}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Next puzzle
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 cursor-pointer"
                          onClick={() => setShowCelebration(false)}
                        >
                          Stay here
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={undoLastMove}
                  disabled={!canUndo}
                >
                  <ChevronLeft className="mr-1.5 h-4 w-4" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
                >
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Flip
                </Button>
                {isSolved && (
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => loadPuzzle()}
                    disabled={!trainingConfig || isLoading}
                  >
                    <ArrowRight className="mr-1.5 h-4 w-4" />
                    Next
                  </Button>
                )}
              </div>

              {currentPuzzle && (
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <span>
                    Side to move:{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">{sideToMove}</span>
                  </span>
                  {playerPlyCount > 1 && (
                    <span>
                      Your move:{' '}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {currentPlayerMove}/{playerPlyCount}
                      </span>
                    </span>
                  )}
                  <span>
                    {isWeaknessMode ? 'Est. difficulty' : 'Puzzle rating'}:{' '}
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {currentPuzzle.rating ?? '—'}
                    </span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="aurora-subtle">
            <CardHeader>
              <CardTitle className="font-display text-lg">Puzzle Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-500/10">
                  <div className="text-xs text-primary-700 dark:text-primary-300">Streak</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">{streak}</div>
                </div>
                <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-500/10">
                  <div className="text-xs text-primary-700 dark:text-primary-300">Best</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">{bestStreak}</div>
                </div>
                <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-500/10">
                  <div className="text-xs text-primary-700 dark:text-primary-300">Solved</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">{solved}</div>
                </div>
              </div>

              {currentPuzzle && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-primary-700 dark:text-primary-300">Side to Move</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{sideToMove}</div>
                  </div>
                  <div>
                    <div className="text-primary-700 dark:text-primary-300">
                      {isWeaknessMode ? 'Est. Difficulty' : 'Puzzle Rating'}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {currentPuzzle.rating ?? '—'}
                    </div>
                  </div>
                </div>
              )}

              {miningProgress && (
                <div className="space-y-2 rounded-xl border border-primary-200/80 bg-primary-50/80 p-3 dark:border-primary-500/30 dark:bg-primary-500/10">
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-primary-800 dark:text-primary-200">
                    <span>Scanning your games</span>
                    <span>{miningPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/60">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all duration-300 dark:bg-primary-400"
                      style={{ width: `${miningPercent}%` }}
                    />
                  </div>
                  <p className="text-xs leading-5 text-slate-700 dark:text-slate-300">
                    {miningProgress.message}
                  </p>
                  {miningProgress.candidatesTotal > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {miningProgress.candidatesDone}/{miningProgress.candidatesTotal} moments ·{' '}
                      {miningProgress.puzzlesFound} puzzles found
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {status}
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}

              {hintLevel > 0 && expectedMove && !isSolved && (
                <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                  {hintLevel === 1
                    ? 'The piece to move is highlighted on the board.'
                    : 'Follow the green arrow for the key move.'}
                </div>
              )}

              {currentPuzzle?.themes && !isWeaknessMode && (
                <div className="flex flex-wrap gap-2">
                  {currentPuzzle.themes.slice(0, 5).map(theme => (
                    <Badge key={theme} variant="secondary" className="bg-ink-100 text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                      {theme}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={requestHint}
                  disabled={!currentPuzzle || isSolved || isAwaitingReply || hintLevel >= 2}
                >
                  <Lightbulb className="mr-2 h-4 w-4" />
                  {hintLevel === 0 ? 'Hint' : hintLevel === 1 ? 'Hint again' : 'Hints used'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={showSolution}
                  disabled={!currentPuzzle || isSolved || isAwaitingReply}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Show
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={resetCurrentPuzzle}
                  disabled={!currentPuzzle || isLoading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => loadPuzzle()}
                  disabled={!trainingConfig || isLoading}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          {isWeaknessMode ? (
            <Card className="aurora-subtle">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <ShieldAlert className="h-5 w-5" />
                  From your games
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {weakness ? (
                  <>
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                        Source game
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        vs {weakness.opponent}
                      </div>
                      <div className="text-slate-600 dark:text-slate-300">
                        Move {weakness.moveNumber}
                        {weakness.opening && weakness.opening !== 'Unknown' ? ` · ${weakness.opening}` : ''}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {weakness.date} · {weakness.site}
                        {' · '}
                        {weakness.playerColor === 'white' ? 'White' : 'Black'}
                      </div>
                      {weakness.gameUrl && (
                        <a
                          href={weakness.gameUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex cursor-pointer items-center gap-1 text-primary-700 hover:underline dark:text-primary-300"
                        >
                          Open game
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-300">
                        Why this position
                      </div>
                      <p className="mt-1 leading-5 text-slate-700 dark:text-slate-200">
                        {weakness.whySelected}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant="secondary"
                        className="border-0 text-white"
                        style={{ backgroundColor: classificationMeta[weakness.classification].color }}
                      >
                        {classificationMeta[weakness.classification].label}
                        {classificationMeta[weakness.classification].glyph
                          ? ` ${classificationMeta[weakness.classification].glyph}`
                          : ''}
                      </Badge>
                      {typeof weakness.timeSpentSeconds === 'number' && (
                        <Badge variant="outline" className="inline-flex items-center gap-1 border-primary-200 text-primary-800 dark:border-slate-600 dark:text-primary-200">
                          <Clock3 className="h-3 w-3" />
                          {formatSeconds(weakness.timeSpentSeconds)} think
                        </Badge>
                      )}
                      {weakness.reasons.includes('long-think') && (
                        <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-200">
                          Long think
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-primary-700 dark:text-primary-300">You played</div>
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {weakness.playedMoveSan}
                        </div>
                      </div>
                      <div>
                        <div className="text-primary-700 dark:text-primary-300">Eval loss</div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          ~{Math.round(weakness.centipawnLoss)} cp
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-600 dark:text-slate-300">
                    {isLoading
                      ? 'Analyzing your last 20 games for long thinks and blunders…'
                      : 'Source details appear once a weakness position is loaded.'}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="aurora-subtle">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Trophy className="h-5 w-5" />
                  Targeting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-700 dark:text-primary-300">Category</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {selectedCategory ? puzzleService.getCategoryLabel(selectedCategory) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700 dark:text-primary-300">Theme</span>
                  <span className="font-medium text-slate-900 dark:text-white">{trainingConfig?.angle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700 dark:text-primary-300">
                    {platform === 'chess.com' ? 'Chess.com rating' : 'Puzzle rating'}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {trainingConfig?.basePuzzleRating ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700 dark:text-primary-300">Target rating</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {trainingConfig?.targetRating ?? '—'}
                  </span>
                </div>
                <p className="pt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Starts at your puzzle rating. After every {puzzleService.getStreakLevelUp()} correct
                  in a row, targets climb by 100.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PuzzleTrainer;
