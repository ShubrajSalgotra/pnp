import React, { useEffect, useState } from "react";

import { puzzleLibraryService } from "../services/puzzleLibraryService";
import {
  PuzzleDocument,
  PuzzleModule,
  PuzzleTopic,
} from "../types/puzzleLibrary";
import PracticePuzzleTrainer from "../components/PracticePuzzleTrainer";

const PracticePage: React.FC = () => {
  const [modules, setModules] = useState<PuzzleModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<PuzzleModule | null>(
    null,
  );

  const [topics, setTopics] = useState<PuzzleTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<PuzzleTopic | null>(null);

  const [puzzles, setPuzzles] = useState<PuzzleDocument[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleDocument | null>(
    null,
  );

  const [selectedPuzzleIndex, setSelectedPuzzleIndex] = useState(0);

  /*
   * Load all puzzle modules
   */
  useEffect(() => {
    const loadModules = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await puzzleLibraryService.getModules();

        setModules(data);
      } catch (err) {
        console.error("Failed to load puzzle modules:", err);

        setError("Puzzle modules load nahi ho paaye.");
      } finally {
        setLoading(false);
      }
    };

    loadModules();
  }, []);

  /*
   * Load topics when a module is selected
   */
  const handleModuleClick = async (module: PuzzleModule) => {
    try {
      setLoading(true);
      setError(null);

      setSelectedModule(module);
      setSelectedTopic(null);
      setSelectedPuzzle(null);
      setSelectedPuzzleIndex(0);

      setTopics([]);
      setPuzzles([]);

      const data = await puzzleLibraryService.getTopics(module.id);

      setTopics(data);
    } catch (err) {
      console.error("Failed to load puzzle topics:", err);

      setError("Topics load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * Load puzzles when a topic is selected
   */
  const handleTopicClick = async (topic: PuzzleTopic) => {
    try {
      setLoading(true);
      setError(null);

      setSelectedTopic(topic);
      setSelectedPuzzle(null);
      setSelectedPuzzleIndex(0);

      setPuzzles([]);

      const data = await puzzleLibraryService.getPuzzlesByTopic(topic.id);

      setPuzzles(data);
    } catch (err) {
      console.error("Failed to load topic puzzles:", err);

      setError("Topic ke puzzles load nahi ho paaye.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * Open a puzzle
   */
  const handlePuzzleClick = (puzzle: PuzzleDocument, index: number) => {
    setSelectedPuzzle(puzzle);
    setSelectedPuzzleIndex(index);
  };

  /*
   * Open next puzzle
   */
  const handleNextPuzzle = () => {
    const nextIndex = selectedPuzzleIndex + 1;

    if (nextIndex >= puzzles.length) {
      return;
    }

    const nextPuzzle = puzzles[nextIndex];

    setSelectedPuzzleIndex(nextIndex);
    setSelectedPuzzle(nextPuzzle);
  };

  /*
   * Go back to modules
   */
  const handleBackToModules = () => {
    setSelectedModule(null);
    setSelectedTopic(null);
    setSelectedPuzzle(null);

    setSelectedPuzzleIndex(0);

    setTopics([]);
    setPuzzles([]);

    setError(null);
  };

  /*
   * Go back to topics
   */
  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setSelectedPuzzle(null);

    setSelectedPuzzleIndex(0);

    setPuzzles([]);
    setError(null);
  };

  /*
   * Go back to puzzle list
   */
  const handleBackToPuzzles = () => {
    setSelectedPuzzle(null);
    setSelectedPuzzleIndex(0);
  };

  /*
   * If a puzzle is selected,
   * show the trainer.
   */
  if (selectedPuzzle) {
    const hasNextPuzzle = selectedPuzzleIndex < puzzles.length - 1;

    return (
      <PracticePuzzleTrainer
        puzzle={selectedPuzzle}
        puzzleNumber={selectedPuzzleIndex + 1}
        totalPuzzles={puzzles.length}
        hasNextPuzzle={hasNextPuzzle}
        onBack={handleBackToPuzzles}
        onNext={handleNextPuzzle}
      />
    );
  }

  /*
   * Loading state
   */
  if (loading && modules.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />

          <p className="text-sm text-gray-500">Loading practice...</p>
        </div>
      </div>
    );
  }

  /*
   * Error state
   */
  if (error && modules.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-700">Something went wrong</h2>

          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#071712]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* =========================
            HEADER
           ========================= */}

        <div className="mb-8">
          <p className="text-sm font-medium text-emerald-400">Practice</p>

          <h1 className="mt-1 text-3xl font-bold text-white">
            Chess Puzzle Practice
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Choose a puzzle collection and practice tactical positions.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-900/60 bg-red-950/40 p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* =========================
            MODULE VIEW
           ========================= */}

        {!selectedModule && (
          <div>
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-white">
                Puzzle Collections
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Select a collection to explore its topics.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {modules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => handleModuleClick(module)}
                  className="group rounded-2xl border border-slate-700/80 bg-[#0d1824] p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-700 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                        Puzzle Collection
                      </p>

                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {module.name}
                      </h3>
                    </div>

                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                      {module.puzzleCount} puzzles
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Explore topics
                    </span>

                    <span className="text-lg text-slate-500 transition group-hover:translate-x-1 group-hover:text-emerald-400">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* =========================
            TOPIC VIEW
           ========================= */}

        {selectedModule && !selectedTopic && (
          <div>
            <button
              type="button"
              onClick={handleBackToModules}
              className="mb-6 text-sm font-medium text-slate-400 transition hover:text-emerald-400"
            >
              ← All Collections
            </button>

            <div className="mb-6">
              <p className="text-sm text-slate-400">{selectedModule.name}</p>

              <h2 className="mt-1 text-2xl font-bold text-white">Topics</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500" />
              </div>
            ) : topics.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-[#0d1824] p-8 text-center">
                <h3 className="font-semibold text-white">No topics found</h3>

                <p className="mt-2 text-sm text-slate-400">
                  This collection currently has no topics.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className="group rounded-2xl border border-slate-700 bg-[#0d1824] p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-emerald-700 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">
                        {topic.name}
                      </h3>

                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                        {topic.puzzleCount}
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        Practice puzzles
                      </span>

                      <span className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-emerald-400">
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================
            PUZZLE VIEW
           ========================= */}

        {selectedModule && selectedTopic && (
          <div>
            <button
              type="button"
              onClick={handleBackToTopics}
              className="mb-6 text-sm font-medium text-slate-400 transition hover:text-emerald-400"
            >
              ← {selectedModule.name}
            </button>

            <div className="mb-7">
              <p className="text-sm text-slate-400">{selectedModule.name}</p>

              <div className="mt-1 flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white">
                  {selectedTopic.name}
                </h2>

                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                  {selectedTopic.puzzleCount} puzzles
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-500" />
              </div>
            ) : puzzles.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-[#0d1824] p-8 text-center">
                <h3 className="font-semibold text-white">No puzzles found</h3>

                <p className="mt-2 text-sm text-slate-400">
                  This topic currently has no puzzles.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {puzzles.map((puzzle, index) => (
                  <div
                    key={puzzle.id}
                    className="rounded-2xl border border-slate-700 bg-[#0d1824] p-5 shadow-sm"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Puzzle {index + 1}
                    </p>

                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {puzzle.title || `Problem #${index + 1}`}
                    </h3>

                    <div className="mt-4 space-y-2 text-sm text-slate-400">
                      <div>
                        <span className="font-medium text-slate-200">
                          Side:
                        </span>{" "}
                        {puzzle.sideToMove}
                      </div>

                      <div>
                        <span className="font-medium text-slate-200">
                          Moves:
                        </span>{" "}
                        {puzzle.solutionMoves.length}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePuzzleClick(puzzle, index)}
                      className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
                    >
                      Practice Puzzle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
