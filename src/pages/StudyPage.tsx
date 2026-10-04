import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Chess, type Move } from "chess.js";

import { db } from "../services/firebase";

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

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

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

function getPieceSymbol(piece: { color: "w" | "b"; type: string }) {
  return PIECES[`${piece.color}${piece.type.toUpperCase()}`] ?? "";
}

function coordsToSquare(file: number, rank: number) {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }

  return `${FILES[file]}${rank + 1}`;
}

function getInitialFen(lesson: StudyLesson) {
  return (
    lesson.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
}

/* =========================================================
   STUDY LIBRARY
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

    loadStudies();
  }, []);

  const ratingFilters = useMemo(() => {
    const ranges = studies
      .filter((study) => study.ratingMin !== null && study.ratingMax !== null)
      .map((study) => `${study.ratingMin}-${study.ratingMax}`);

    return Array.from(new Set(ranges));
  }, [studies]);

  const filteredStudies = studies.filter((study) => {
    if (selectedRating === "all") {
      return true;
    }

    return `${study.ratingMin}-${study.ratingMax}` === selectedRating;
  });

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
     STUDY PLAYER
  ========================================================= */

  if (selectedStudy) {
    if (loadingLessons) {
      return (
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
          <div className="flex min-h-[500px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />

              <p className="text-sm text-slate-400">Loading study...</p>
            </div>
          </div>
        </div>
      );
    }

    if (lessons.length === 0) {
      return (
        <div className="min-h-screen bg-slate-950 px-4 py-6 text-white">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={closeStudy}
              className="mb-8 text-sm text-slate-400 transition hover:text-white"
            >
              ← Back to Studies
            </button>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <h2 className="text-xl font-semibold">No lessons found</h2>

              <p className="mt-2 text-sm text-slate-400">
                This study does not contain any lessons.
              </p>
            </div>
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
     STUDY LIBRARY UI
  ========================================================= */

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-emerald-400">STUDY</p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Chess Studies
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
            Improve your chess through interactive endgame studies and practical
            positions.
          </p>
        </div>

        {ratingFilters.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedRating("all")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                selectedRating === "all"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              All
            </button>

            {ratingFilters.map((range) => {
              const [min, max] = range.split("-");

              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setSelectedRating(range)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    selectedRating === range
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {min}–{max}
                </button>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-slate-400">Loading studies...</p>
          </div>
        )}

        {!loading && filteredStudies.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">No studies found.</p>
          </div>
        )}

        {!loading && filteredStudies.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {filteredStudies.map((study) => (
              <button
                key={study.id}
                type="button"
                onClick={() => openStudy(study)}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 text-left transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-emerald-400">
                      Endgame Study
                    </p>

                    <h2 className="text-xl font-semibold text-white">
                      {study.title}
                    </h2>
                  </div>

                  <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300">
                    {study.ratingMin}–{study.ratingMax}
                  </span>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
                  <span className="text-sm text-slate-400">
                    {study.lessonCount} lessons
                  </span>

                  <span className="text-sm font-semibold text-white transition group-hover:text-emerald-400">
                    Start Study →
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   STUDY PLAYER
========================================================= */

interface StudyPlayerProps {
  study: Study;
  lessons: StudyLesson[];
  currentLessonIndex: number;
  setCurrentLessonIndex: Dispatch<SetStateAction<number>>;
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

  const isReadingLesson = !lesson || lesson.moves.length === 0;

  if (!lesson) {
    return null;
  }

  function goPrevious() {
    if (currentLessonIndex === 0) {
      return;
    }

    setCurrentLessonIndex((index) => index - 1);
  }

  function goNext() {
    if (currentLessonIndex >= lessons.length - 1) {
      return;
    }

    setCurrentLessonIndex((index) => index + 1);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-white sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            ← Studies
          </button>

          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">
              {study.title}
            </p>

            <p className="mt-1 text-sm text-slate-400">
              Lesson {currentLessonIndex + 1} / {lessons.length}
            </p>
          </div>

          <div className="w-[70px]" />
        </div>

        {/* LESSON */}

        {isReadingLesson ? (
          <ReadingLesson
            lesson={lesson}
            currentLessonIndex={currentLessonIndex}
            totalLessons={lessons.length}
            onPrevious={goPrevious}
            onNext={goNext}
          />
        ) : (
          <PlayableLesson
            lesson={lesson}
            currentLessonIndex={currentLessonIndex}
            totalLessons={lessons.length}
            onPrevious={goPrevious}
            onNext={goNext}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   READING / INTRO LESSON
========================================================= */

interface ReadingLessonProps {
  lesson: StudyLesson;
  currentLessonIndex: number;
  totalLessons: number;
  onPrevious: () => void;
  onNext: () => void;
}

function ReadingLesson({
  lesson,
  currentLessonIndex,
  totalLessons,
  onPrevious,
  onNext,
}: ReadingLessonProps) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-400">
          Study Introduction
        </p>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {lesson.title}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {lesson.ratingMin}–{lesson.ratingMax}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-400">
            📖
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Introduction</p>

            <p className="text-xs text-slate-500">
              Read this chapter before continuing.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6">
          <div className="whitespace-pre-line text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
            {lesson.introComment ||
              "This chapter introduces the ideas used throughout this study."}
          </div>
        </div>
      </div>

      <LessonNavigation
        currentLessonIndex={currentLessonIndex}
        totalLessons={totalLessons}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
}

/* =========================================================
   PLAYABLE LESSON
========================================================= */

interface PlayableLessonProps {
  lesson: StudyLesson;
  currentLessonIndex: number;
  totalLessons: number;
  onPrevious: () => void;
  onNext: () => void;
}

function PlayableLesson({
  lesson,
  currentLessonIndex,
  totalLessons,
  onPrevious,
  onNext,
}: PlayableLessonProps) {
  const [game, setGame] = useState<Chess | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<Feedback>(null);

  const [message, setMessage] = useState("");

  const [expectedMoveIndex, setExpectedMoveIndex] = useState(0);

  const [animatingMove, setAnimatingMove] = useState<{
    from: string;
    to: string;
    piece: {
      color: "w" | "b";
      type: string;
    };
  } | null>(null);

  const [isOpponentMoving, setIsOpponentMoving] = useState(false);

  /*
   * The side the student plays.
   */
  const userColor = lesson.sideToMove ?? "white";

  const userChessColor = userColor === "white" ? "w" : "b";

  /* =======================================================
     INITIALIZE
  ======================================================= */

  function initializeLesson() {
    try {
      const chess = new Chess(getInitialFen(lesson));

      setGame(chess);
      setSelectedSquare(null);
      setFeedback(null);
      setMessage("");
      setExpectedMoveIndex(0);
      setAnimatingMove(null);
      setIsOpponentMoving(false);
    } catch (error) {
      console.error("Failed to initialize lesson:", error);

      setGame(null);
      setFeedback("wrong");
      setMessage("This chess position cannot be loaded.");
    }
  }

  useEffect(() => {
    initializeLesson();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  /* =======================================================
     CURRENT EXPECTED MOVE
  ======================================================= */

  const currentExpectedMove = lesson.moves[expectedMoveIndex] ?? null;

  /* =======================================================
     KEY IDEA

     Priority:

     1. Current move comment
     2. Lesson intro comment
     3. Generic idea

     Never show the expected move.
  ======================================================= */

  const currentIdea =
    currentExpectedMove?.comment ||
    lesson.introComment ||
    "Look for the key idea in this position.";

  /* =======================================================
     LEGAL TARGETS
  ======================================================= */

  const legalTargets = useMemo(() => {
    if (!game || !selectedSquare || isOpponentMoving) {
      return [];
    }

    return game
      .moves({
        square: selectedSquare as never,
        verbose: true,
      })
      .map((move) => move.to);
  }, [game, selectedSquare, isOpponentMoving]);

  /* =======================================================
     SOUND
  ======================================================= */

 function playChessSound(
  type:
    | "move"
    | "capture"
    | "success"
    | "wrong",
) {
  try {
    type BrowserAudioWindow =
      typeof window & {
        webkitAudioContext?: typeof window.AudioContext;
      };

    const AudioContextClass =
      window.AudioContext ||
      (
        window as BrowserAudioWindow
      ).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const audioContext =
      new AudioContextClass();

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(
      audioContext.destination,
    );

    const now =
      audioContext.currentTime;

    if (type === "move") {
      oscillator.frequency.setValueAtTime(
        520,
        now,
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        390,
        now + 0.08,
      );

      gain.gain.setValueAtTime(
        0.08,
        now,
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.12,
      );
    }

    if (type === "capture") {
      oscillator.frequency.setValueAtTime(
        380,
        now,
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        220,
        now + 0.1,
      );

      gain.gain.setValueAtTime(
        0.1,
        now,
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.15,
      );
    }

    if (type === "success") {
      oscillator.frequency.setValueAtTime(
        520,
        now,
      );

      oscillator.frequency.setValueAtTime(
        660,
        now + 0.1,
      );

      oscillator.frequency.setValueAtTime(
        820,
        now + 0.2,
      );

      gain.gain.setValueAtTime(
        0.08,
        now,
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.35,
      );
    }

    if (type === "wrong") {
      oscillator.frequency.setValueAtTime(
        180,
        now,
      );

      oscillator.frequency.exponentialRampToValueAtTime(
        110,
        now + 0.12,
      );

      gain.gain.setValueAtTime(
        0.06,
        now,
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.15,
      );
    }

    oscillator.start(now);

    oscillator.stop(
      now +
        (type === "success"
          ? 0.4
          : 0.18),
    );

    window.setTimeout(() => {
      audioContext
        .close()
        .catch(() => {});
    }, 500);
  } catch (error) {
    console.warn(
      "Chess sound unavailable:",
      error,
    );
  }
}

  /* =======================================================
     MOVE ANIMATION
  ======================================================= */

  function animateMove(
    from: string,
    to: string,
    piece: {
      color: "w" | "b";
      type: string;
    },
    onComplete: () => void,
  ) {
    setAnimatingMove({
      from,
      to,
      piece,
    });

    window.setTimeout(() => {
      setAnimatingMove(null);
      onComplete();
    }, 260);
  }

  /* =======================================================
     AUTOMATIC OPPONENT MOVE
  ======================================================= */

  useEffect(() => {
    if (
      !game ||
      !currentExpectedMove ||
      isOpponentMoving ||
      feedback === "complete"
    ) {
      return;
    }

    /*
     * Only automatically play the
     * opponent's moves.
     */

    if (currentExpectedMove.color === userColor) {
      return;
    }

    const opponentMove = currentExpectedMove;

    setIsOpponentMoving(true);
    setSelectedSquare(null);

    const possibleMoves = game.moves({
      verbose: true,
    }) as Move[];

    const matchingMove = possibleMoves.find((move) =>
      isExpectedMove(move, opponentMove),
    );

    if (!matchingMove) {
      console.error("Could not find expected opponent move:", opponentMove);

      setIsOpponentMoving(false);
      return;
    }

    const piece = game.get(matchingMove.from as never);

    if (!piece) {
      setIsOpponentMoving(false);
      return;
    }

    const nextGame = new Chess(game.fen());

    const capturedPiece = nextGame.get(matchingMove.to as never);

    const moveResult = nextGame.move({
      from: matchingMove.from,
      to: matchingMove.to,
      promotion: matchingMove.promotion ?? undefined,
    });

    if (!moveResult) {
      setIsOpponentMoving(false);
      return;
    }

    playChessSound(capturedPiece ? "capture" : "move");

    animateMove(matchingMove.from, matchingMove.to, piece, () => {
      setGame(nextGame);

      setExpectedMoveIndex((index) => index + 1);

      setIsOpponentMoving(false);
    });
  }, [game, currentExpectedMove, userColor, isOpponentMoving, feedback]);

  /* =======================================================
     HANDLE SQUARE CLICK
  ======================================================= */

  function handleSquareClick(square: string) {
    if (
      !game ||
      !currentExpectedMove ||
      isOpponentMoving ||
      feedback === "complete"
    ) {
      return;
    }

    /*
     * Student can only play
     * their own move.
     */

    if (currentExpectedMove.color !== userColor) {
      return;
    }

    if (game.turn() !== userChessColor) {
      return;
    }

    const clickedPiece = game.get(square as never);

    /* -------------------------------------------------------
       SELECT PIECE
    ------------------------------------------------------- */

    if (!selectedSquare) {
      if (clickedPiece && clickedPiece.color === game.turn()) {
        setSelectedSquare(square);
      }

      return;
    }

    /* -------------------------------------------------------
       SELECT ANOTHER OWN PIECE
    ------------------------------------------------------- */

    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);
      return;
    }

    /* -------------------------------------------------------
       FIND MOVE
    ------------------------------------------------------- */

    const possibleMoves = game.moves({
      square: selectedSquare as never,
      verbose: true,
    }) as Move[];

    const selectedMove = possibleMoves.find((move) => move.to === square);

    if (!selectedMove) {
      setSelectedSquare(null);
      return;
    }

    /* -------------------------------------------------------
       CHECK CORRECTNESS
    ------------------------------------------------------- */

    const correct = isExpectedMove(selectedMove, currentExpectedMove);

    /* -------------------------------------------------------
       WRONG MOVE
    ------------------------------------------------------- */

    if (!correct) {
      playChessSound("wrong");

      setFeedback("wrong");

      /*
       * IMPORTANT:
       * Never reveal the actual move.
       */

      setMessage("Not the correct move. Try applying the key idea.");

      setSelectedSquare(null);

      window.setTimeout(() => {
        setFeedback(null);
        setMessage("");
      }, 1400);

      return;
    }

    /* -------------------------------------------------------
       CORRECT MOVE
    ------------------------------------------------------- */

    const piece = game.get(selectedSquare as never);

    if (!piece) {
      return;
    }

    const capturedPiece = game.get(square as never);

    const nextGame = new Chess(game.fen());

    const moveResult = nextGame.move({
      from: selectedSquare,
      to: square,
      promotion: selectedMove.promotion ?? undefined,
    });

    if (!moveResult) {
      return;
    }

    playChessSound(capturedPiece ? "capture" : "move");

    const moveFrom = selectedSquare;

    setSelectedSquare(null);

    /*
     * Animate student's move.
     */

    animateMove(moveFrom, square, piece, () => {
      const nextIndex = expectedMoveIndex + 1;

      setGame(nextGame);

      setExpectedMoveIndex(nextIndex);

      /* ---------------------------------------------------
           LESSON COMPLETE
        --------------------------------------------------- */

      if (nextIndex >= lesson.moves.length) {
        playChessSound("success");

        setFeedback("complete");

        setMessage("Excellent! Study complete.");

        return;
      }

      /* ---------------------------------------------------
           CORRECT FEEDBACK
        --------------------------------------------------- */

      setFeedback("correct");

      setMessage("Good move.");

      window.setTimeout(() => {
        setFeedback(null);
        setMessage("");
      }, 850);
    });
  }

  /* =======================================================
     RESET
  ======================================================= */

  function resetLesson() {
    initializeLesson();
  }

  /* =======================================================
     POSITION ERROR
  ======================================================= */

  if (!game) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <p className="font-medium text-red-300">
            {message || "This chess position cannot be loaded."}
          </p>

          <button
            type="button"
            onClick={resetLesson}
            className="mt-5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      {/* LESSON TITLE */}

      <div className="mb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-emerald-400">
          Interactive Study
        </p>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {lesson.title}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {lesson.ratingMin}–{lesson.ratingMax}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* =================================================
            BOARD
        ================================================= */}

        <div className="relative mx-auto w-full max-w-[620px]">
          {feedback && (
            <div
              className={`absolute left-1/2 top-3 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg transition-all ${
                feedback === "wrong"
                  ? "bg-red-500 text-white"
                  : feedback === "complete"
                    ? "bg-emerald-500 text-white"
                    : "bg-green-500 text-white"
              }`}
            >
              {feedback === "wrong"
                ? "Try again"
                : feedback === "complete"
                  ? "✓ Complete"
                  : "✓ Correct"}
            </div>
          )}

          <ChessBoard
            game={game}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            onSquareClick={handleSquareClick}
            animatingMove={animatingMove}
          />
        </div>

        {/* =================================================
            RIGHT PANEL
        ================================================= */}

        <div className="flex flex-col">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            {/* KEY IDEA */}

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Key Idea
              </p>

              {isOpponentMoving && (
                <span className="text-xs font-medium text-emerald-400">
                  Opponent moving...
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {currentIdea}
            </p>

            {/* PROGRESS */}

            <div className="mt-5 border-t border-slate-800 pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-slate-500">
                  Progress
                </span>

                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                  {Math.min(expectedMoveIndex, lesson.moves.length)} /{" "}
                  {lesson.moves.length}
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${
                      lesson.moves.length
                        ? Math.min(
                            100,
                            (expectedMoveIndex / lesson.moves.length) * 100,
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* CURRENT ACTION */}

            <div className="mt-5 rounded-xl bg-slate-950 p-4">
              <p className="text-xs text-slate-500">
                {isOpponentMoving
                  ? "Opponent"
                  : feedback === "complete"
                    ? "Study"
                    : currentExpectedMove?.color === userColor
                      ? "Your turn"
                      : "Opponent"}
              </p>

              <p className="mt-1 text-lg font-semibold text-white">
                {feedback === "complete"
                  ? "Study complete"
                  : isOpponentMoving
                    ? "Playing response..."
                    : currentExpectedMove?.color === userColor
                      ? "Find the move"
                      : "Watch the position"}
              </p>
            </div>

            {/* MESSAGE */}

            {message && (
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-sm leading-6 text-slate-300">{message}</p>
              </div>
            )}

            {/* MODE */}

            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
              <span className="text-xs text-slate-500">Study mode</span>

              <span className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200">
                You play · Opponent responds
              </span>
            </div>
          </div>

          {/* CONTROLS */}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onPrevious}
              disabled={currentLessonIndex === 0 || isOpponentMoving}
              className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>

            <button
              type="button"
              onClick={resetLesson}
              disabled={isOpponentMoving}
              className="rounded-xl bg-slate-800 px-3 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={
                currentLessonIndex >= totalLessons - 1 || isOpponentMoving
              }
              className="rounded-xl bg-emerald-500 px-3 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   LESSON NAVIGATION
========================================================= */

interface LessonNavigationProps {
  currentLessonIndex: number;
  totalLessons: number;
  onPrevious: () => void;
  onNext: () => void;
}

function LessonNavigation({
  currentLessonIndex,
  totalLessons,
  onPrevious,
  onNext,
}: LessonNavigationProps) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={currentLessonIndex === 0}
        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Previous
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={currentLessonIndex >= totalLessons - 1}
        className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}

/* =========================================================
   CHESS BOARD
========================================================= */

interface ChessBoardProps {
  game: Chess;
  selectedSquare: string | null;
  legalTargets: string[];
  onSquareClick: (square: string) => void;

  animatingMove: {
    from: string;
    to: string;
    piece: {
      color: "w" | "b";
      type: string;
    };
  } | null;
}

function ChessBoard({
  game,
  selectedSquare,
  legalTargets,
  onSquareClick,
  animatingMove,
}: ChessBoardProps) {
  const board = game.board();

  /*
   * Convert a chess square to
   * percentage coordinates.
   */

  function squarePosition(square: string) {
    const file = FILES.indexOf(square[0]);

    const rank = Number(square[1]) - 1;

    return {
      x: file * 12.5,
      y: (7 - rank) * 12.5,
    };
  }

  const animationStart = animatingMove
    ? squarePosition(animatingMove.from)
    : null;

  const animationEnd = animatingMove ? squarePosition(animatingMove.to) : null;

  return (
    <div className="mx-auto w-full overflow-hidden rounded-sm">
      <div
        className="relative grid aspect-square w-full grid-cols-8"
        style={{
          backgroundColor: "#eeeed2",
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const rank = 7 - rowIndex;

            const square = coordsToSquare(colIndex, rank)!;

            const isLight = (rowIndex + colIndex) % 2 === 0;

            const isSelected = selectedSquare === square;

            const isLegalTarget = legalTargets.includes(square);

            /*
             * Hide original piece
             * while it is animating.
             */

            const isAnimationSource = animatingMove?.from === square;

            const pieceSymbol = piece ? getPieceSymbol(piece) : "";

            return (
              <button
                key={square}
                type="button"
                onClick={() => onSquareClick(square)}
                aria-label={`Chess square ${square}`}
                className="relative flex aspect-square items-center justify-center border-0 p-0 outline-none"
                style={{
                  backgroundColor: isSelected
                    ? "#f6f669"
                    : isLight
                      ? "#eeeed2"
                      : "#769656",
                }}
              >
                {/* PIECE */}

                {piece && !isAnimationSource && (
                  <span
                    className="pointer-events-none relative z-10 select-none leading-none"
                    style={{
                      fontSize: "clamp(2rem, 8vw, 5rem)",

                      color: piece.color === "w" ? "#ffffff" : "#111111",

                      textShadow:
                        piece.color === "w"
                          ? "0 2px 1px rgba(0,0,0,0.75)"
                          : "0 1px 1px rgba(255,255,255,0.18)",

                      lineHeight: 1,
                    }}
                  >
                    {pieceSymbol}
                  </span>
                )}

                {/* LEGAL TARGET */}

                {isLegalTarget && (
                  <>
                    {piece ? (
                      <span className="pointer-events-none absolute inset-[7%] z-20 rounded-full border-[4px] border-black/30" />
                    ) : (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[25%] w-[25%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25" />
                    )}
                  </>
                )}

                {/* SELECTION */}

                {isSelected && (
                  <span className="pointer-events-none absolute inset-0 z-[5] bg-yellow-300/35" />
                )}

                {/* RANK */}

                {colIndex === 0 && (
                  <span
                    className="pointer-events-none absolute left-[4px] top-[3px] z-30 font-bold leading-none"
                    style={{
                      fontSize: "clamp(9px, 1.8vw, 13px)",

                      color: isLight ? "#769656" : "#eeeed2",
                    }}
                  >
                    {rank + 1}
                  </span>
                )}

                {/* FILE */}

                {rowIndex === 7 && (
                  <span
                    className="pointer-events-none absolute bottom-[3px] right-[4px] z-30 font-bold uppercase leading-none"
                    style={{
                      fontSize: "clamp(9px, 1.8vw, 13px)",

                      color: isLight ? "#769656" : "#eeeed2",
                    }}
                  >
                    {FILES[colIndex]}
                  </span>
                )}
              </button>
            );
          }),
        )}

        {/* =====================================================
            ANIMATED PIECE
        ===================================================== */}

        {animatingMove && animationStart && animationEnd && (
          <div
            className="pointer-events-none absolute left-0 top-0 z-50 flex items-center justify-center"
            style={{
              width: "12.5%",
              height: "12.5%",

              left: `${animationStart.x}%`,
              top: `${animationStart.y}%`,

              transform: `translate(
                  ${animationEnd.x - animationStart.x}%,
                  ${animationEnd.y - animationStart.y}%
                )`,

              transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <span
              className="select-none leading-none"
              style={{
                fontSize: "clamp(2rem, 8vw, 5rem)",

                color:
                  animatingMove.piece.color === "w" ? "#ffffff" : "#111111",

                textShadow:
                  animatingMove.piece.color === "w"
                    ? "0 2px 1px rgba(0,0,0,0.75)"
                    : "0 1px 1px rgba(255,255,255,0.18)",

                lineHeight: 1,
              }}
            >
              {getPieceSymbol(animatingMove.piece)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MOVE VALIDATION
========================================================= */

function isExpectedMove(move: Move, expected: StudyMove) {
  /*
   * Prefer UCI.
   */

  if (expected.uci) {
    const from = expected.uci.slice(0, 2);

    const to = expected.uci.slice(2, 4);

    if (move.from === from && move.to === to) {
      return true;
    }
  }

  /*
   * SAN fallback.
   */

  return move.san === expected.san;
}
