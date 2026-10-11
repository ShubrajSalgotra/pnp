
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getPracticePuzzles,
  getRecentPracticePuzzleIds,
  getUserPuzzleRating,
  selectPracticePuzzle,
} from "../services/practiceService";

import PracticePuzzleTrainer from "../components/PracticePuzzleTrainer";

import type {
  PracticePuzzle,
} from "../types/practice";

import { auth } from "../services/firebase";

/* =========================================================
   CONSTANTS
========================================================= */

const SESSION_PUZZLES = 20;

/* =========================================================
   PAGE
========================================================= */

const PracticePage: React.FC =
  () => {
    const [puzzles, setPuzzles] =
      useState<PracticePuzzle[]>(
        [],
      );

    const [
      currentPuzzle,
      setCurrentPuzzle,
    ] =
      useState<PracticePuzzle | null>(
        null,
      );

    const [
      userRating,
      setUserRating,
    ] = useState(1200);

    const [
      usedPuzzleIds,
      setUsedPuzzleIds,
    ] = useState<string[]>(
      [],
    );

    const [
      puzzleNumber,
      setPuzzleNumber,
    ] = useState(1);

    const [
      loading,
      setLoading,
    ] = useState(true);

    const [
      error,
      setError,
    ] = useState<string | null>(
      null,
    );

    /* =======================================================
       START PRACTICE
    ======================================================== */

    const startPractice =
      useCallback(
        async () => {
          const user =
            auth.currentUser;

          if (!user) {
            setError(
              "Please sign in before starting Practice.",
            );

            setLoading(false);

            return;
          }

          try {
            setLoading(true);

            setError(null);

            /*
             * Load:
             *
             * 1. user's puzzle rating
             * 2. all Practice puzzles
             * 3. recent puzzle history
             */

            const [
              rating,
              allPuzzles,
              recentIds,
            ] =
              await Promise.all([
                getUserPuzzleRating(
                  user.uid,
                ),

                getPracticePuzzles(),

                getRecentPracticePuzzleIds(
                  user.uid,
                ),
              ]);

            /*
             * Store rating.
             */
            setUserRating(
              rating,
            );

            /*
             * Select first puzzle.
             */
            const firstPuzzle =
              selectPracticePuzzle(
                allPuzzles,
                rating,
                recentIds,
                [],
              );

            if (!firstPuzzle) {
              setPuzzles(
                allPuzzles,
              );

              setCurrentPuzzle(
                null,
              );

              setError(
                `No Practice puzzle is currently above your rating (${rating}).`,
              );

              return;
            }

            setPuzzles(
              allPuzzles,
            );

            setUsedPuzzleIds(
              [firstPuzzle.puzzleId],
            );

            setPuzzleNumber(1);

            setCurrentPuzzle(
              firstPuzzle,
            );
          } catch (loadError) {
            console.error(
              "Failed to start Practice:",
              loadError,
            );

            setError(
              "Practice puzzles could not be loaded. Please try again.",
            );
          } finally {
            setLoading(false);
          }
        },
        [],
      );

    /* =======================================================
       INITIAL LOAD
    ======================================================== */

    useEffect(() => {
      void startPractice();
    }, [startPractice]);

    /* =======================================================
       NEXT PUZZLE
    ======================================================== */

    const handleNext =
      async () => {
        const user =
          auth.currentUser;

        if (!user) {
          return;
        }

        try {
          /*
           * Get fresh recent history.
           *
           * This means a puzzle just solved
           * won't immediately come back.
           */
          const recentIds =
            await getRecentPracticePuzzleIds(
              user.uid,
            );

          const nextPuzzle =
            selectPracticePuzzle(
              puzzles,
              userRating,
              recentIds,
              usedPuzzleIds,
            );

          if (!nextPuzzle) {
            /*
             * Session exhausted.
             *
             * Start again while avoiding
             * recent history.
             */
            const restartPuzzle =
              selectPracticePuzzle(
                puzzles,
                userRating,
                recentIds,
                [],
              );

            if (!restartPuzzle) {
              setError(
                "No more suitable Practice puzzles are available right now.",
              );

              return;
            }

            setUsedPuzzleIds([
              restartPuzzle.puzzleId,
            ]);

            setPuzzleNumber(1);

            setCurrentPuzzle(
              restartPuzzle,
            );

            return;
          }

          setUsedPuzzleIds(
            (previous) => [
              ...previous,
              nextPuzzle.puzzleId,
            ],
          );

          setPuzzleNumber(
            (number) =>
              number + 1,
          );

          setCurrentPuzzle(
            nextPuzzle,
          );
        } catch (nextError) {
          console.error(
            "Could not load next Practice puzzle:",
            nextError,
          );

          setError(
            "Could not load the next challenge.",
          );
        }
      };

    /* =======================================================
       BACK
    ======================================================== */

    const handleBack =
      () => {
        /*
         * Restart Practice rather than
         * returning to old module/topic UI.
         */
        void startPractice();
      };

    /* =======================================================
       LOADING
    ======================================================== */

    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">

          <div className="text-center">

            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-800 border-t-emerald-400" />

            <p className="text-sm text-slate-500">
              Preparing your next challenge…
            </p>

          </div>

        </div>
      );
    }

    /* =======================================================
       ERROR
    ======================================================== */

    if (
      error ||
      !currentPuzzle
    ) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">

          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-400">
              !
            </div>

            <h1 className="mt-4 text-lg font-semibold">
              Practice unavailable
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error ||
                "No suitable puzzle could be found."}
            </p>

            <button
              type="button"
              onClick={() =>
                void startPractice()
              }
              className="mt-5 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Try again
            </button>

          </div>

        </div>
      );
    }

    /* =======================================================
       TRAINER
    ======================================================== */

    return (
      <PracticePuzzleTrainer
        puzzle={
          currentPuzzle
        }
        puzzleNumber={
          puzzleNumber
        }
        totalPuzzles={
          Math.max(
            SESSION_PUZZLES,
            puzzles.length,
          )
        }
        hasNextPuzzle={
          puzzles.length > 1
        }
        onBack={
          handleBack
        }
        onNext={
          handleNext
        }
      />
    );
  };

export default PracticePage;