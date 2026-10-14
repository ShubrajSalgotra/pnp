import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Chess, type Move, type Square } from "chess.js";
import { db } from "../services/firebase";
import { ChessboardView } from "../components/chess/ChessboardView";
import { ChessboardControls } from "../components/chess/ChessboardControls";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Lightbulb,
  PartyPopper,
  RotateCcw,
} from "lucide-react";

interface Study {
  id: string;
  title: string;
  source: string;
  ratingMin: number | null;
  ratingMax: number | null;
  lessonCount: number;
}

interface StudyMove {
  ply: number;
  moveNumber: number;
  color: "white" | "black";
  san: string;
  uci: string | null;
  comment: string | null;
  nags: string[];
}

interface StudyVariation {
  parentPly: number | null;
  moves: string[];
  raw: string;
}

interface StudyLesson {
  id: string;
  studyId: string;
  studyTitle: string;
  title: string;
  lessonOrder: number;
  source: string;
  chapterUrl: string | null;
  ratingMin: number | null;
  ratingMax: number | null;
  fen: string | null;
  sideToMove: "white" | "black" | null;
  introComment: string | null;
  moves: StudyMove[];
  variations: StudyVariation[];
  rawMoveText: string;
}

type Feedback = "correct" | "wrong" | "complete" | null;

function getInitialFen(lesson: StudyLesson) {
  return (
    lesson.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
}

function isExpectedMove(move: Move, expected: StudyMove) {
  if (expected.uci) {
    const from = expected.uci.slice(0, 2).toLowerCase();
    const to = expected.uci.slice(2, 4).toLowerCase();
    if (move.from.toLowerCase() === from && move.to.toLowerCase() === to) {
      return true;
    }
  }
  const cleanMoveSan = move.san.replace(/[+#x=]/g, '').trim();
  const cleanExpectedSan = expected.san.replace(/[+#x=]/g, '').trim();
  return move.san === expected.san || cleanMoveSan === cleanExpectedSan;
}

/* =========================================================
   STUDY PAGE ROOT
========================================================= */

export default function StudyPage() {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState("all");
  const [selectedStudy, setSelectedStudy] = useState<Study | null>(null);
  const [lessons, setLessons] = useState<StudyLesson[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loadingLessons, setLoadingLessons] = useState(false);

  useEffect(() => {
    async function loadStudies() {
      try {
        const studiesRef = collection(db, "studyMaterials");
        const snapshot = await getDocs(studiesRef);
        const data: Study[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Study[];

        data.sort((a, b) => {
          const aRating = a.ratingMin ?? Infinity;
          const bRating = b.ratingMin ?? Infinity;
          return aRating - bRating;
        });

        setStudies(data);
      } catch (error) {
        console.error("Failed to load studies:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadStudies();
  }, []);

  const ratingFilters = useMemo(() => {
    const ranges = studies
      .filter((study) => study.ratingMin !== null && study.ratingMax !== null)
      .map((study) => `${study.ratingMin}-${study.ratingMax}`);
    return Array.from(new Set(ranges));
  }, [studies]);

  const filteredStudies = useMemo(() => {
    if (selectedRating === "all") return studies;
    return studies.filter(
      (study) => `${study.ratingMin}-${study.ratingMax}` === selectedRating
    );
  }, [selectedRating, studies]);

  async function openStudy(study: Study) {
    setSelectedStudy(study);
    setLoadingLessons(true);
    setLessons([]);
    setCurrentLessonIndex(0);

    try {
      const lessonsRef = collection(db, "studyLessons");
      const q = query(lessonsRef, where("studyId", "==", study.id));
      const snapshot = await getDocs(q);
      const data: StudyLesson[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StudyLesson[];

      data.sort((a, b) => a.lessonOrder - b.lessonOrder);
      setLessons(data);
    } catch (error) {
      console.error("Failed to load study lessons:", error);
    } finally {
      setLoadingLessons(false);
    }
  }

  function closeStudy() {
    setSelectedStudy(null);
    setLessons([]);
    setCurrentLessonIndex(0);
  }

  /* =========================================================
     STUDY PLAYER ACTIVE VIEW
  ========================================================= */

  if (selectedStudy) {
    if (loadingLessons) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-primary-600 dark:border-slate-800 dark:border-t-emerald-400" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Loading course lessons…
          </p>
        </div>
      );
    }

    if (lessons.length === 0) {
      return (
        <div className="mx-auto max-w-xl py-12">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
            <BookOpen className="mx-auto h-12 w-12 text-slate-400" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
              No Lessons Available
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              This study does not contain any published lessons at this time.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={closeStudy}
              className="mt-6 cursor-pointer"
            >
              ← Back to Studies
            </Button>
          </div>
        </div>
      );
    }

    return (
      <StudyPlayer
        study={selectedStudy}
        lessons={lessons}
        currentLessonIndex={currentLessonIndex}
        setCurrentLessonIndex={setCurrentLessonIndex}
        onBack={closeStudy}
      />
    );
  }

  /* =========================================================
     LIBRARY OVERVIEW
  ========================================================= */

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="CURRICULUM"
        title="Chess Studies Library"
        description="Master essential endgame positions, positional themes, and structured master plans with interactive move-by-move coaching."
      />

      {/* Filter Tabs */}
      {ratingFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedRating("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
              selectedRating === "all"
                ? "bg-primary-600 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
            }`}
          >
            All Ratings
          </button>
          {ratingFilters.map((range) => {
            const [min, max] = range.split("-");
            return (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRating(range)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                  selectedRating === range
                    ? "bg-primary-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
                }`}
              >
                {min}–{max} Rating
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : filteredStudies.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Studies in This Rating"
          description="Try selecting 'All Ratings' to explore our full curriculum of interactive chess studies."
          action={
            <Button
              type="button"
              onClick={() => setSelectedRating("all")}
              className="cursor-pointer"
            >
              Show All Studies
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudies.map((study) => (
            <div
              key={study.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-slate-800/80 dark:bg-slate-900/90"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-emerald-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  {study.ratingMin !== null && study.ratingMax !== null && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {study.ratingMin}–{study.ratingMax}
                    </span>
                  )}
                </div>

                <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors">
                  {study.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Source: {study.source || "Pawnposes Academy"}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {study.lessonCount || 0} Lessons
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openStudy(study)}
                  className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                >
                  <span>Start Study</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STUDY PLAYER COMPONENT
========================================================= */

interface StudyPlayerProps {
  study: Study;
  lessons: StudyLesson[];
  currentLessonIndex: number;
  setCurrentLessonIndex: React.Dispatch<React.SetStateAction<number>>;
  onBack: () => void;
}

function StudyPlayer({
  study,
  lessons,
  currentLessonIndex,
  setCurrentLessonIndex,
  onBack,
}: StudyPlayerProps) {
  const lesson = lessons[currentLessonIndex];
  const isReadingLesson = !lesson?.moves || lesson.moves.length === 0;

  if (!lesson) return null;

  function goPrevious() {
    if (currentLessonIndex === 0) return;
    setCurrentLessonIndex((index) => index - 1);
  }

  function goNext() {
    if (currentLessonIndex >= lessons.length - 1) return;
    setCurrentLessonIndex((index) => index + 1);
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="cursor-pointer"
          >
            ← Studies Library
          </Button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600 dark:text-emerald-400 block">
              {study.title}
            </span>
            <span className="font-display font-bold text-slate-900 dark:text-white text-base">
              Lesson {currentLessonIndex + 1} of {lessons.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrevious}
            disabled={currentLessonIndex === 0}
            className="cursor-pointer disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={currentLessonIndex >= lessons.length - 1}
            className="cursor-pointer disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {isReadingLesson ? (
        <ReadingLessonView
          lesson={lesson}
          currentLessonIndex={currentLessonIndex}
          totalLessons={lessons.length}
          onNext={goNext}
        />
      ) : (
        <PlayableLessonView
          lesson={lesson}
          currentLessonIndex={currentLessonIndex}
          totalLessons={lessons.length}
          onNext={goNext}
          onPrevious={goPrevious}
        />
      )}
    </div>
  );
}

/* =========================================================
   READING LESSON VIEW
========================================================= */

function ReadingLessonView({
  lesson,
  currentLessonIndex,
  totalLessons,
  onNext,
}: {
  lesson: StudyLesson;
  currentLessonIndex: number;
  totalLessons: number;
  onNext: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl py-4 space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-emerald-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {lesson.title}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chapter Introduction
            </p>
          </div>
        </div>

        <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300 sm:text-base">
          {lesson.introComment ||
            "This chapter introduces the key strategic principles and tactical patterns explored in this study."}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          {currentLessonIndex < totalLessons - 1 && (
            <Button
              type="button"
              onClick={onNext}
              className="bg-primary-600 hover:bg-primary-700 text-white font-bold cursor-pointer"
            >
              <span>Begin Lesson 1</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PLAYABLE LESSON VIEW (USES SHARED CHESSBOARDVIEW)
========================================================= */

function PlayableLessonView({
  lesson,
  currentLessonIndex,
  totalLessons,
  onNext,
  onPrevious,
}: {
  lesson: StudyLesson;
  currentLessonIndex: number;
  totalLessons: number;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const [game, setGame] = useState<Chess>(() => new Chess(getInitialFen(lesson)));
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(
    lesson.sideToMove === "black" ? "black" : "white"
  );
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string; toTint?: string } | null>(null);
  const [expectedMoveIndex, setExpectedMoveIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isOpponentMoving, setIsOpponentMoving] = useState(false);

  const opponentTimerRef = useRef<number | null>(null);

  const userColor = lesson.sideToMove ?? "white";
  const userChessColor = userColor === "white" ? "w" : "b";

  const playOpponentMove = useCallback(
    (currentGame: Chess, moveIndex: number) => {
      const oppMove = lesson.moves[moveIndex];
      if (!oppMove) {
        setIsOpponentMoving(false);
        return;
      }

      setIsOpponentMoving(true);
      setSelectedSquare(null);

      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
      }

      opponentTimerRef.current = window.setTimeout(() => {
        try {
          const nextGame = new Chess(currentGame.fen());
          const possibleMoves = nextGame.moves({ verbose: true }) as Move[];
          const matchingMove = possibleMoves.find((m) => isExpectedMove(m, oppMove));

          if (!matchingMove) {
            console.warn("Could not find expected opponent move:", oppMove);
            setIsOpponentMoving(false);
            return;
          }

          nextGame.move({
            from: matchingMove.from,
            to: matchingMove.to,
            promotion: matchingMove.promotion ?? undefined,
          });

          setGame(nextGame);
          setLastMove({ from: matchingMove.from, to: matchingMove.to });
          const afterOppIndex = moveIndex + 1;
          setExpectedMoveIndex(afterOppIndex);

          if (afterOppIndex >= lesson.moves.length) {
            setFeedback("complete");
            setFeedbackMessage("Excellent! Study lesson complete.");
          } else {
            // Opponent finished, clear message so student can play
            setFeedback(null);
            setFeedbackMessage("");
          }
        } catch (err) {
          console.error("Opponent reply failed:", err);
        } finally {
          setIsOpponentMoving(false);
        }
      }, 450);
    },
    [lesson.moves]
  );

  function initializeLesson() {
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
    }
    try {
      const chess = new Chess(getInitialFen(lesson));
      setGame(chess);
      setBoardOrientation(lesson.sideToMove === "black" ? "black" : "white");
      setSelectedSquare(null);
      setLastMove(null);
      setExpectedMoveIndex(0);
      setFeedback(null);
      setFeedbackMessage("");
      setIsOpponentMoving(false);

      // If chapter starts with opponent move, play it automatically
      const firstMove = lesson.moves[0];
      if (firstMove && firstMove.color !== userColor) {
        playOpponentMove(chess, 0);
      }
    } catch (err) {
      console.error("Failed to initialize lesson:", err);
    }
  }

  useEffect(() => {
    initializeLesson();
    return () => {
      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const currentExpectedMove = lesson.moves[expectedMoveIndex] ?? null;

  const currentIdea =
    currentExpectedMove?.comment ||
    lesson.introComment ||
    "Look for the key strategic or tactical idea in this position.";

  const legalTargets = useMemo(() => {
    if (!game || !selectedSquare || isOpponentMoving) return [];
    try {
      return game
        .moves({ square: selectedSquare as Square, verbose: true })
        .map((m) => ({ to: m.to, isCapture: Boolean(m.captured) }));
    } catch {
      return [];
    }
  }, [game, isOpponentMoving, selectedSquare]);

  // Move validation logic
  const handlePieceDrop = (from: string, to: string): boolean => {
    if (!game || !currentExpectedMove || isOpponentMoving || feedback === "complete") {
      return false;
    }

    if (currentExpectedMove.color !== userColor) return false;
    if (game.turn() !== userChessColor) return false;

    const nextGame = new Chess(game.fen());
    const possibleMoves = nextGame.moves({ square: from as Square, verbose: true }) as Move[];
    const candidateMove = possibleMoves.find((m) => m.to === to);
    if (!candidateMove) return false;

    const correct = isExpectedMove(candidateMove, currentExpectedMove);
    if (!correct) {
      setFeedback("wrong");
      setFeedbackMessage("Not the intended line. Try following the study's plan.");
      setLastMove({ from, to, toTint: "rgba(239, 68, 68, 0.6)" });
      setSelectedSquare(null);

      window.setTimeout(() => {
        setFeedback(null);
        setFeedbackMessage("");
      }, 1500);
      return false;
    }

    // Correct student move
    try {
      nextGame.move({
        from,
        to,
        promotion: candidateMove.promotion ?? undefined,
      });

      setGame(nextGame);
      setLastMove({ from, to });
      setSelectedSquare(null);

      const nextIndex = expectedMoveIndex + 1;
      setExpectedMoveIndex(nextIndex);

      if (nextIndex >= lesson.moves.length) {
        setFeedback("complete");
        setFeedbackMessage("Excellent! You completed all key moves in this study.");
        return true;
      }

      // Check if next move is opponent's move
      if (lesson.moves[nextIndex]?.color !== userColor) {
        setFeedback("correct");
        setFeedbackMessage("Good move! Opponent is responding…");
        playOpponentMove(nextGame, nextIndex);
      } else {
        setFeedback("correct");
        setFeedbackMessage("Good move! Continuing line…");
        window.setTimeout(() => {
          setFeedback(null);
          setFeedbackMessage("");
        }, 800);
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleSquareClick = (square: string) => {
    if (!game || !currentExpectedMove || isOpponentMoving || feedback === "complete") {
      return;
    }
    if (currentExpectedMove.color !== userColor) return;
    if (game.turn() !== userChessColor) return;

    const clickedPiece = game.get(square as Square);

    if (!selectedSquare) {
      if (clickedPiece && clickedPiece.color === game.turn()) {
        setSelectedSquare(square);
      }
      return;
    }

    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);
      return;
    }

    handlePieceDrop(selectedSquare, square);
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
      {/* Left: Reusable ChessboardView inside clean card */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-3">
        <div className="rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="relative">
            <ChessboardView
              fen={game.fen()}
              boardOrientation={boardOrientation}
              isInteractive={!isOpponentMoving && feedback !== "complete"}
              onPieceDrop={handlePieceDrop}
              onSquareClick={handleSquareClick}
              lastMove={lastMove}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              showExternalCoordinates={true}
              theme="forest"
            />

            {/* Feedback overlay banner */}
            {feedback && (
              <div
                className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold shadow-lg animate-in fade-in duration-200 ${
                  feedback === "complete"
                    ? "bg-emerald-600 text-white"
                    : feedback === "correct"
                    ? "bg-sky-600 text-white"
                    : "bg-rose-600 text-white"
                }`}
              >
                {feedback === "complete" ? (
                  <PartyPopper className="h-4 w-4" />
                ) : feedback === "correct" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span>{feedbackMessage}</span>
              </div>
            )}
          </div>

          <div className="mt-4">
            <ChessboardControls
              boardOrientation={boardOrientation}
              onFlipOrientation={() =>
                setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))
              }
              onReset={initializeLesson}
              sideToMove={game.turn()}
            />
          </div>
        </div>
      </div>

      {/* Right: Study Lesson Side Panel */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-4">
        {/* Lesson Info Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-600 dark:text-emerald-400">
                Lesson Chapter
              </span>
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {lesson.title}
              </h2>
            </div>
            <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {userColor === "white" ? "⚪ You: White" : "⚫ You: Black"}
            </span>
          </div>

          {/* Key Concept / Coach Tip */}
          <div className="rounded-xl bg-amber-50/70 p-3.5 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/30">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
              <Lightbulb className="h-4 w-4" />
              <span>Key Concept</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
              {currentIdea}
            </p>
          </div>

          {/* Opponent moving indicator */}
          {isOpponentMoving && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              <span>Opponent reply…</span>
            </div>
          )}

          {/* Completion state button */}
          {feedback === "complete" && (
            <div className="pt-2">
              {currentLessonIndex < totalLessons - 1 ? (
                <Button
                  type="button"
                  onClick={onNext}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 text-sm cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <span>Proceed to Next Lesson</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  🎉 You have completed all lessons in this study!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Moves Sequence List */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900/90">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Study Move List
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Move {expectedMoveIndex} of {lesson.moves.length}
            </span>
          </div>

          <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {lesson.moves.map((move, idx) => {
              const isPast = idx < expectedMoveIndex;
              const isCurrent = idx === expectedMoveIndex;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary-100/90 text-primary-900 font-bold dark:bg-primary-500/25 dark:text-emerald-300 ring-1 ring-primary-500/30"
                      : isPast
                      ? "text-slate-500 dark:text-slate-400 line-through opacity-75"
                      : "text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-slate-400 font-mono text-[11px]">
                      {idx + 1}.
                    </span>
                    <span className="font-semibold">{move.san}</span>
                  </div>
                  {isPast && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {isCurrent && (
                    <span className="rounded bg-primary-600 text-white px-1.5 py-0.2 text-[10px] font-bold">
                      Now
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
