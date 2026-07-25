import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock3,
  ExternalLink,
  Eye,
  Flag,
  Lightbulb,
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
import { puzzleService } from '../services/puzzleService';
import { userDataService } from '../services/userDataService';
import { DEFAULT_PUZZLE_PROGRESS } from '../types/userData';
import { classificationMeta, formatSeconds, isImplausibleFen } from '../utils/gameReviewAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

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
  const chessRef = useRef(new Chess());
  const sessionRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bestStreakRef = useRef(0);
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
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [showHint, setShowHint] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [miningProgress, setMiningProgress] = useState<WeaknessMiningProgress | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      if (!currentUser?.id) {
        setSolved(0);
        setStreak(0);
        bestStreakRef.current = 0;
        return;
      }

      const progress = await userDataService.loadPuzzleProgress(currentUser.id);
      if (cancelled) return;

      setSolved(progress.solved);
      setStreak(progress.streak);
      bestStreakRef.current = progress.bestStreak;
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
    targetRating: number | null
  ) => {
    if (!currentUser?.id) return;

    bestStreakRef.current = Math.max(bestStreakRef.current, nextStreak);
    void userDataService.savePuzzleProgress({
      ...DEFAULT_PUZZLE_PROGRESS(currentUser.id),
      solved: nextSolved,
      streak: nextStreak,
      bestStreak: bestStreakRef.current,
      lastCategory: category,
      targetRating,
    });
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

    setIsLoading(true);
    setError(null);
    setShowHint(false);
    setIsSolved(false);
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

  const playUciMove = (uciMove: string) => {
    if (!isLegalUciMove(chessRef.current, uciMove)) {
      throw new Error(`Illegal puzzle move: ${uciMove}`);
    }

    try {
      const move = chessRef.current.move(getMoveFromUci(uciMove));
      if (!move) {
        throw new Error(`Illegal puzzle move: ${uciMove}`);
      }
    } catch {
      throw new Error(`Illegal puzzle move: ${uciMove}`);
    }
  };

  const finishPuzzle = () => {
    setIsSolved(true);
    const nextSolved = solved + 1;
    const nextStreak = streak + 1;
    setSolved(nextSolved);
    setStreak(nextStreak);

    const raiseDifficulty =
      !isWeaknessMode && puzzleService.shouldRaiseDifficulty(nextStreak) && trainingConfig;

    if (raiseDifficulty && trainingConfig) {
      const nextConfig = puzzleService.withRaisedTargetRating(trainingConfig);
      setTrainingConfig(nextConfig);
      persistProgress(nextSolved, nextStreak, selectedCategory, nextConfig.targetRating);
      setStatus(
        `Solved. ${puzzleService.getStreakLevelUp()} in a row — next puzzles aim near ${nextConfig.targetRating}.`
      );
      return;
    }

    persistProgress(nextSolved, nextStreak, selectedCategory, trainingConfig?.targetRating ?? null);
    setStatus(
      weakness
        ? `Solved. In the game you played ${weakness.playedMoveSan}.`
        : 'Solved. Nice calculation.'
    );
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    const expectedMove = getExpectedMove();

    if (!currentPuzzle || !expectedMove || !targetSquare || isSolved || isLoading) {
      return false;
    }

    if (!isLegalUciMove(chessRef.current, expectedMove)) {
      setError('This puzzle position did not match the expected solution. Please load the next puzzle.');
      return false;
    }

    const candidateMove = `${sourceSquare}${targetSquare}${expectedMove[4] || ''}`;

    if (candidateMove !== expectedMove) {
      setStreak(0);
      persistProgress(solved, 0, selectedCategory, trainingConfig?.targetRating ?? null);
      setStatus(
        weakness
          ? `Not quite. In the game you played ${weakness.playedMoveSan} — look for a stronger idea.`
          : 'Not quite. Reset your candidate and look for the forcing move.'
      );
      return false;
    }

    try {
      playUciMove(expectedMove);
      let nextIndex = solutionIndex + 1;

      if (nextIndex >= currentPuzzle.solution.length) {
        setFen(chessRef.current.fen());
        finishPuzzle();
        return true;
      }

      playUciMove(currentPuzzle.solution[nextIndex]);
      nextIndex += 1;

      setSolutionIndex(nextIndex);
      setFen(chessRef.current.fen());

      if (nextIndex >= currentPuzzle.solution.length) {
        finishPuzzle();
      } else {
        setStatus('Correct. Continue the line.');
      }

      return true;
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'The puzzle line could not be played.');
      return false;
    }
  };

  const resetCurrentPuzzle = () => {
    if (!currentPuzzle) return;
    setShowHint(false);
    setIsSolved(false);
    setStatus(weakness ? 'Find the move you missed in this game.' : 'Find the best move.');
    preparePuzzle(currentPuzzle);
  };

  const showSolution = () => {
    if (!currentPuzzle) return;

    try {
      let nextIndex = solutionIndex;
      while (nextIndex < currentPuzzle.solution.length) {
        const move = currentPuzzle.solution[nextIndex];
        playUciMove(move);
        nextIndex += 1;
      }
      setSolutionIndex(nextIndex);
      setFen(chessRef.current.fen());
      setStreak(0);
      setIsSolved(true);
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
    setSelectedCategory(null);
    setTrainingConfig(null);
    setCurrentPuzzle(null);
    setError(null);
    setShowHint(false);
    setIsSolved(false);
    setMiningProgress(null);
    setStatus('Choose a training target to begin.');
  };

  const expectedMove = getExpectedMove();
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
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-2 font-display text-xl">
                  <Target className="h-5 w-5" />
                  {activeCategory?.title}
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mx-auto aspect-square max-w-xl">
                <Chessboard
                  options={{
                    position: fen,
                    boardOrientation,
                    allowDragging: !!currentPuzzle && !isSolved && !isLoading,
                    onPieceDrop: handlePieceDrop,
                    boardStyle: {
                      borderRadius: '14px',
                      boxShadow: '0 18px 48px rgba(15, 23, 42, 0.24)'
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="aurora-subtle">
            <CardHeader>
              <CardTitle className="font-display text-lg">Puzzle Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-primary-50 p-3 dark:bg-primary-500/10">
                  <div className="text-xs text-primary-700 dark:text-primary-300">Streak</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 dark:text-white">{streak}</div>
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

              {showHint && expectedMove && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Try a move from <span className="font-mono">{expectedMove.slice(0, 2)}</span>.
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
                <Button type="button" variant="outline" onClick={() => setShowHint(true)} disabled={!currentPuzzle || isSolved}>
                  <Lightbulb className="mr-2 h-4 w-4" />
                  Hint
                </Button>
                <Button type="button" variant="outline" onClick={showSolution} disabled={!currentPuzzle || isSolved}>
                  <Eye className="mr-2 h-4 w-4" />
                  Show
                </Button>
                <Button type="button" variant="outline" onClick={resetCurrentPuzzle} disabled={!currentPuzzle || isLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button type="button" onClick={() => loadPuzzle()} disabled={!trainingConfig || isLoading}>
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
                  <span className="text-primary-700 dark:text-primary-300">Lichess theme</span>
                  <span className="font-medium text-slate-900 dark:text-white">{trainingConfig?.angle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-700 dark:text-primary-300">
                    {platform === 'chess.com' ? 'Chess.com rating' : platform === 'lichess' ? 'Lichess rating' : 'Base rating'}
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
