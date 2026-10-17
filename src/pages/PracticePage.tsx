import React, { useCallback, useEffect, useState } from 'react';
import {
  getPracticePuzzles,
  getRecentPracticePuzzleIds,
  getUserPuzzleRating,
  selectPracticePuzzle,
} from '../services/practiceService';
import PracticePuzzleTrainer from '../components/PracticePuzzleTrainer';
import type { PracticePuzzle } from '../types/practice';
import { auth } from '../services/firebase';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

const SESSION_PUZZLES = 20;

const PracticePage: React.FC = () => {
  const [puzzles, setPuzzles] = useState<PracticePuzzle[]>([]);
  const [currentPuzzle, setCurrentPuzzle] = useState<PracticePuzzle | null>(null);
  const [userRating, setUserRating] = useState(1200);
  const [usedPuzzleIds, setUsedPuzzleIds] = useState<string[]>([]);
  const [puzzleNumber, setPuzzleNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startPractice = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in before starting Practice.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [rating, allPuzzles, recentIds] = await Promise.all([
        getUserPuzzleRating(user.uid),
        getPracticePuzzles(),
        getRecentPracticePuzzleIds(user.uid),
      ]);

      setUserRating(rating);

      const firstPuzzle = selectPracticePuzzle(allPuzzles, rating, recentIds, []);

      if (!firstPuzzle) {
        setPuzzles(allPuzzles);
        setCurrentPuzzle(null);
        setError(`No Practice puzzle is currently matched to your rating (${rating}).`);
        return;
      }

      setPuzzles(allPuzzles);
      setUsedPuzzleIds([firstPuzzle.puzzleId]);
      setPuzzleNumber(1);
      setCurrentPuzzle(firstPuzzle);
    } catch (loadError) {
      console.error('Failed to start Practice:', loadError);
      setError('Practice puzzles could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void startPractice();
  }, [startPractice]);

  const handleNext = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const recentIds = await getRecentPracticePuzzleIds(user.uid);
      const nextPuzzle = selectPracticePuzzle(puzzles, userRating, recentIds, usedPuzzleIds);

      if (!nextPuzzle) {
        const restartPuzzle = selectPracticePuzzle(puzzles, userRating, recentIds, []);
        if (!restartPuzzle) {
          setError('No more suitable Practice puzzles are available right now.');
          return;
        }

        setUsedPuzzleIds([restartPuzzle.puzzleId]);
        setPuzzleNumber(1);
        setCurrentPuzzle(restartPuzzle);
        return;
      }

      setUsedPuzzleIds((previous) => [...previous, nextPuzzle.puzzleId]);
      setPuzzleNumber((number) => number + 1);
      setCurrentPuzzle(nextPuzzle);
    } catch (nextError) {
      console.error('Could not load next Practice puzzle:', nextError);
      setError('Could not load the next challenge.');
    }
  };

  const handleBack = () => {
    void startPractice();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-primary-600 dark:border-slate-800 dark:border-t-emerald-400" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Preparing your next tactical challenge…
        </p>
      </div>
    );
  }

  if (error || !currentPuzzle) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-sm dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
            Practice Unavailable
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {error || 'No suitable puzzle could be found for your rating profile.'}
          </p>
          <Button
            type="button"
            onClick={() => void startPractice()}
            className="mt-6 w-full cursor-pointer bg-primary-600 hover:bg-primary-700 text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PracticePuzzleTrainer
      puzzle={currentPuzzle}
      puzzleNumber={puzzleNumber}
      totalPuzzles={Math.max(SESSION_PUZZLES, puzzles.length)}
      hasNextPuzzle={puzzles.length > 1}
      onBack={handleBack}
      onNext={handleNext}
    />
  );
};

export default PracticePage;