import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import {
  ArrowRight,
  BookOpen,
  Brain,
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
import { LichessPuzzleResponse, PuzzleTrainingCategory, PuzzleTrainingConfig } from '../types/puzzle';
import { puzzleService } from '../services/puzzleService';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

interface PuzzleTrainerProps {
  analysis?: GameAnalysis | null;
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
    description: 'Puzzles matched to the tactical pattern your analysis struggled with most.',
    icon: <ShieldAlert className="h-5 w-5" />
  },
  {
    id: 'learn-mistakes',
    title: 'Learn From My Mistakes',
    description: 'Conversion and best-move puzzles that train sharper decisions after missed chances.',
    icon: <Brain className="h-5 w-5" />
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

const PuzzleTrainer: React.FC<PuzzleTrainerProps> = ({ analysis }) => {
  const chessRef = useRef(new Chess());
  const [selectedCategory, setSelectedCategory] = useState<PuzzleTrainingCategory | null>(null);
  const [trainingConfig, setTrainingConfig] = useState<PuzzleTrainingConfig | null>(null);
  const [currentPuzzle, setCurrentPuzzle] = useState<LichessPuzzleResponse | null>(null);
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

  const activeCategory = useMemo(
    () => trainingCategories.find(category => category.id === selectedCategory),
    [selectedCategory]
  );
  const sideToMove = fen.split(' ')[1] === 'b' ? 'Black' : 'White';

  useEffect(() => {
    if (!selectedCategory) return;

    const config = puzzleService.buildTrainingConfig(selectedCategory, analysis);
    setTrainingConfig(config);
    loadPuzzle(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, analysis]);

  const loadPuzzle = async (config = trainingConfig) => {
    if (!config) return;

    setIsLoading(true);
    setError(null);
    setShowHint(false);
    setIsSolved(false);
    setStatus('Loading a Lichess puzzle...');

    try {
      const puzzle = await puzzleService.getNextPuzzle(config);
      preparePuzzle(puzzle);
      setCurrentPuzzle(puzzle);
      setStatus('Find the best move.');
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load a puzzle.';
      setError(message);
      setStatus('Puzzle loading failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const preparePuzzle = (puzzle: LichessPuzzleResponse) => {
    const puzzleGame = new Chess();
    puzzleGame.loadPgn(puzzle.game.pgn);

    chessRef.current = puzzleGame;
    setSolutionIndex(0);
    setFen(puzzleGame.fen());
    setBoardOrientation(puzzleGame.turn() === 'w' ? 'white' : 'black');
  };

  const getExpectedMove = () => currentPuzzle?.puzzle.solution[solutionIndex];

  const getMoveFromUci = (uciMove: string) => ({
    from: uciMove.slice(0, 2),
    to: uciMove.slice(2, 4),
    promotion: uciMove[4]
  });

  const isLegalUciMove = (game: Chess, uciMove: string) => {
    return game.moves({ verbose: true }).some(move => {
      return move.from === uciMove.slice(0, 2) &&
        move.to === uciMove.slice(2, 4) &&
        (!uciMove[4] || move.promotion === uciMove[4]);
    });
  };

  const playUciMove = (uciMove: string) => {
    const move = chessRef.current.move(getMoveFromUci(uciMove));

    if (!move) {
      throw new Error(`Illegal puzzle move: ${uciMove}`);
    }
  };

  const finishPuzzle = () => {
    setIsSolved(true);
    setSolved(prev => prev + 1);
    setStreak(prev => prev + 1);
    setStatus('Solved. Nice calculation.');
  };

  const handlePieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    const expectedMove = getExpectedMove();

    if (!currentPuzzle || !expectedMove || !targetSquare || isSolved || isLoading) {
      return false;
    }

    if (!isLegalUciMove(chessRef.current, expectedMove)) {
      setError('This puzzle position did not match the Lichess solution. Please load the next puzzle.');
      return false;
    }

    const candidateMove = `${sourceSquare}${targetSquare}${expectedMove[4] || ''}`;

    if (candidateMove !== expectedMove) {
      setStreak(0);
      setStatus('Not quite. Reset your candidate and look for the forcing move.');
      return false;
    }

    try {
      playUciMove(expectedMove);
      let nextIndex = solutionIndex + 1;

      if (nextIndex >= currentPuzzle.puzzle.solution.length) {
        setFen(chessRef.current.fen());
        finishPuzzle();
        return true;
      }

      playUciMove(currentPuzzle.puzzle.solution[nextIndex]);
      nextIndex += 1;

      setSolutionIndex(nextIndex);
      setFen(chessRef.current.fen());

      if (nextIndex >= currentPuzzle.puzzle.solution.length) {
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
    setStatus('Find the best move.');
    preparePuzzle(currentPuzzle);
  };

  const showSolution = () => {
    if (!currentPuzzle) return;

    try {
      let nextIndex = solutionIndex;
      while (nextIndex < currentPuzzle.puzzle.solution.length) {
        const move = currentPuzzle.puzzle.solution[nextIndex];
        playUciMove(move);
        nextIndex += 1;
      }
      setSolutionIndex(nextIndex);
      setFen(chessRef.current.fen());
      setStreak(0);
      setIsSolved(true);
      setStatus('Solution shown. Try the next puzzle fresh.');
    } catch (solutionError) {
      setError(solutionError instanceof Error ? solutionError.message : 'Could not show the solution.');
    }
  };

  const expectedMove = getExpectedMove();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {trainingCategories.map(category => {
          const config = puzzleService.buildTrainingConfig(category.id, analysis);
          const isActive = selectedCategory === category.id;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`text-left rounded-lg border p-4 transition-colors ${
                isActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-900 text-white">
                  {category.icon}
                </div>
                <Badge variant="outline" className="capitalize">
                  {config.difficulty}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-gray-900">{category.title}</h3>
              <p className="mt-2 text-sm leading-5 text-gray-600">{category.description}</p>
              <div className="mt-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Lichess theme: {config.angle}
              </div>
            </button>
          );
        })}
      </div>

      {selectedCategory && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-xl">
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
                        borderRadius: '4px',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)'
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Puzzle Session</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Streak</div>
                    <div className="text-2xl font-bold">{streak}</div>
                  </div>
                  <div className="rounded-md border border-gray-200 p-3">
                    <div className="text-xs text-gray-500">Solved</div>
                    <div className="text-2xl font-bold">{solved}</div>
                  </div>
                </div>

                {currentPuzzle && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-500">Side to Move</div>
                      <div className="font-semibold">{sideToMove}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Puzzle Rating</div>
                      <div className="font-semibold">{currentPuzzle.puzzle.rating}</div>
                    </div>
                  </div>
                )}

                <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                  {status}
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {showHint && expectedMove && (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    Try a move from <span className="font-mono">{expectedMove.slice(0, 2)}</span>.
                  </div>
                )}

                {currentPuzzle?.puzzle.themes && (
                  <div className="flex flex-wrap gap-2">
                    {currentPuzzle.puzzle.themes.slice(0, 5).map(theme => (
                      <Badge key={theme} variant="secondary">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5" />
                  Targeting
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium">{selectedCategory ? puzzleService.getCategoryLabel(selectedCategory) : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Lichess theme</span>
                  <span className="font-medium">{trainingConfig?.angle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Level</span>
                  <span className="font-medium capitalize">{trainingConfig?.difficulty}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default PuzzleTrainer;
