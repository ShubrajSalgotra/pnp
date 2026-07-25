import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from 'react-chessboard';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { userDataService } from '../services/userDataService';
import { ChessGame } from '../types/game';
import {
  ReviewAnalysis,
  ReviewClassification,
  ReviewProgress,
  analyzeGameForReview,
  classificationMeta,
  evalStatusText,
  formatEval,
  formatSeconds,
  resultLabel,
} from '../utils/gameReviewAnalysis';
import { Button } from '../components/ui/Button';
import { loadSelectedGame, persistSelectedGame } from '../utils/selectedGame';
import { STOCKFISH_DEPTH, stockfishService } from '../services/stockfishService';

type ExploreMove = {
  san: string;
  from: string;
  to: string;
  fenAfter: string;
  color: 'w' | 'b';
};

type EngineSuggestion = {
  san: string;
  from: string;
  to: string;
  color: 'w' | 'b';
};

type ExploreEngineState = {
  loading: boolean;
  evaluation: number | null;
  /** Best move for the side to move in the current explore position. */
  sideToMoveBest: EngineSuggestion | null;
};

const START_FEN = new Chess().fen();
/** Snappier depth while freely exploring variations. */
const EXPLORE_ENGINE_DEPTH = 10;

function fenAtMainLineIndex(analysis: ReviewAnalysis, index: number): string {
  if (index < 0) return START_FEN;
  return analysis.moves[index]?.fenAfter || START_FEN;
}

function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!uci || uci.length < 4 || uci === '(none)') return null;
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    ...(uci[4] ? { promotion: uci[4] } : {}),
  };
}

function suggestionFromUci(fen: string, uci: string | null): EngineSuggestion | null {
  const parsed = uci ? parseUciMove(uci) : null;
  if (!parsed) return null;
  try {
    const chess = new Chess(fen);
    const move = chess.move(parsed);
    if (!move) return null;
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
    };
  } catch {
    return null;
  }
}

function tryPlayMove(fen: string, from: string, to: string): ExploreMove | null {
  const chess = new Chess(fen);
  const piece = chess.get(from as Square);
  const isPromotion =
    piece?.type === 'p' &&
    ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

  try {
    const move = chess.move(
      isPromotion ? { from, to, promotion: 'q' } : { from, to }
    );
    if (!move) return null;
    return {
      san: move.san,
      from: move.from,
      to: move.to,
      fenAfter: chess.fen(),
      color: move.color,
    };
  } catch {
    return null;
  }
}

function getLegalTargets(fen: string, from: string): { to: string; isCapture: boolean }[] {
  try {
    const chess = new Chess(fen);
    const piece = chess.get(from as Square);
    if (!piece) return [];
    return chess
      .moves({ square: from as Square, verbose: true })
      .map((move) => ({
        to: move.to,
        isCapture: Boolean(move.captured) || move.flags.includes('c') || move.flags.includes('e'),
      }));
  } catch {
    return [];
  }
}

/**
 * Wood board + Chess.com interaction language:
 * yellow last-move/selected, gray legal-move hints.
 */
const BOARD_LIGHT = '#f0d9b5';
const BOARD_DARK = '#b58863';
const LAST_MOVE_TINT = 'rgba(255, 255, 51, 0.5)';
const SELECTED_SQUARE_TINT = 'rgba(255, 255, 51, 0.5)';
const HOVER_LEGAL_TINT = 'rgba(255, 255, 51, 0.45)';
/** Chess.com quiet-move hint — dark translucent dot (not Lichess green). */
const LEGAL_MOVE_DOT =
  'radial-gradient(rgba(0, 0, 0, 0.14) 19%, rgba(0, 0, 0, 0) 20%)';
/** Chess.com capture hint — dark ring. */
const LEGAL_CAPTURE_RING =
  'radial-gradient(transparent 0%, transparent 79%, rgba(0, 0, 0, 0.14) 80%)';
const CLASSIFICATION_TINT: Partial<Record<ReviewClassification, string>> = {
  blunder: 'rgba(202, 52, 49, 0.55)',
  miss: 'rgba(238, 106, 167, 0.48)',
  mistake: 'rgba(230, 145, 44, 0.48)',
  inaccuracy: 'rgba(247, 198, 49, 0.42)',
  brilliant: 'rgba(27, 172, 166, 0.45)',
  great: 'rgba(92, 139, 176, 0.4)',
  best: 'rgba(150, 188, 75, 0.35)',
  excellent: 'rgba(150, 188, 75, 0.28)',
};

const CLASSIFICATION_ORDER: ReviewClassification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

const DEPTH_MIN = 8;
const DEPTH_MAX = 22;

/** Clamp mate-scale evals so the advantage graph stays readable (Chess.com-style). */
function clampEvalForGraph(evaluation: number): number {
  if (Math.abs(evaluation) >= 90000) {
    return evaluation > 0 ? 800 : -800;
  }
  return Math.max(-800, Math.min(800, evaluation));
}

const EvalGraph: React.FC<{
  series: number[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
}> = ({ series, currentIndex, onSelectIndex }) => {
  const width = 320;
  const height = 80;
  const mid = height / 2;
  const clamped = series.map(clampEvalForGraph);
  const maxAbs = Math.max(150, ...clamped.map((value) => Math.abs(value)));

  const points = clamped.map((value, index) => {
    const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * width;
    const y = mid - (value / maxAbs) * (mid - 3);
    return { x, y, value };
  });

  // White advantage (above midline) and black advantage (below) as separate fills
  const whiteArea = points.length
    ? `M 0 ${mid} ${points.map((p) => `L ${p.x} ${Math.min(mid, p.y)}`).join(' ')} L ${width} ${mid} Z`
    : '';
  const blackArea = points.length
    ? `M 0 ${mid} ${points.map((p) => `L ${p.x} ${Math.max(mid, p.y)}`).join(' ')} L ${width} ${mid} Z`
    : '';
  const linePath = points.length
    ? `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`
    : '';

  const lastMoveNumber = Math.max(1, Math.floor((series.length - 1) / 2));
  const tickLabels = [1, ...[0.25, 0.5, 0.75, 1].map((r) => Math.max(1, Math.round(lastMoveNumber * r)))]
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 4);
  const ticks = tickLabels.map((label) => {
    const ply = Math.min(series.length - 1, Math.max(0, label * 2));
    return {
      x: series.length <= 1 ? 0 : (ply / (series.length - 1)) * width,
      label: String(label),
    };
  });

  const cursorX =
    series.length > 1
      ? ((currentIndex + 1) / (series.length - 1)) * width
      : 0;

  return (
    <div className="rounded-xl border border-primary-200/70 bg-gradient-to-b from-slate-100 to-slate-200/80 p-2 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
      <svg
        viewBox={`0 0 ${width} ${height + 14}`}
        className="h-24 w-full cursor-crosshair"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const ply = Math.round(ratio * (series.length - 1));
          onSelectIndex(Math.max(-1, Math.min(series.length - 2, ply - 1)));
        }}
      >
        <rect x="0" y="0" width={width} height={height} fill="rgba(255,255,255,0.35)" />
        <path d={whiteArea} fill="rgba(248, 250, 252, 0.95)" />
        <path d={blackArea} fill="rgba(15, 23, 42, 0.88)" />
        <line x1="0" y1={mid} x2={width} y2={mid} stroke="rgba(100,116,139,0.55)" strokeWidth="1" />
        <path d={linePath} fill="none" stroke="rgba(14, 165, 233, 0.9)" strokeWidth="1.5" />
        {series.length > 1 && (
          <line
            x1={cursorX}
            y1="0"
            x2={cursorX}
            y2={height}
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        )}
        {ticks.map((tick) => (
          <text
            key={`${tick.label}-${tick.x}`}
            x={tick.x}
            y={height + 11}
            textAnchor="middle"
            className="fill-slate-500 text-[9px] dark:fill-slate-400"
          >
            {tick.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

const PhaseBars: React.FC<{
  phaseAccuracy: ReviewAnalysis['phaseAccuracy'];
}> = ({ phaseAccuracy }) => {
  const rows = [
    { label: 'Opening', white: phaseAccuracy.opening.white, black: phaseAccuracy.opening.black },
    { label: 'Middlegame', white: phaseAccuracy.middlegame.white, black: phaseAccuracy.middlegame.black },
    { label: 'Endgame', white: phaseAccuracy.endgame.white, black: phaseAccuracy.endgame.black },
  ];

  const formatPhase = (value: number | null) => (value === null ? '—' : `${value}%`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
          Accuracy by phase
        </p>
        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-200 ring-1 ring-slate-400 dark:bg-slate-100" />
            White
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-800 dark:bg-slate-300" />
            Black
          </span>
        </div>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="space-y-1.5">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.label}</p>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-slate-100 ring-1 ring-inset ring-slate-400/40 dark:bg-slate-200"
                style={{ width: `${row.white ?? 0}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">
              {formatPhase(row.white)}
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-slate-800 dark:bg-slate-400"
                style={{ width: `${row.black ?? 0}%` }}
              />
            </div>
            <span className="w-10 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">
              {formatPhase(row.black)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

/** Chess.com-style classification chip anchored near the destination square. */
const ClassificationBadge: React.FC<{
  square: string;
  glyph: string;
  classification: ReviewClassification;
  orientation: 'white' | 'black';
}> = ({ square, glyph, classification, orientation }) => {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1], 10) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  const left = ((col + 0.72) / 8) * 100;
  const top = ((row + 0.08) / 8) * 100;
  const color = classificationMeta[classification].color;

  return (
    <div
      className="pointer-events-none absolute z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white shadow-md"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        backgroundColor: color,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {glyph}
    </div>
  );
};

const GameReviewPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [game, setGame] = useState<ChessGame | null>(
    (location.state as { game?: ChessGame } | null)?.game || loadSelectedGame(gameId)
  );
  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<ReviewProgress | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [activeTab, setActiveTab] = useState<'report' | 'time' | 'database'>('report');
  const [analysisDepth, setAnalysisDepth] = useState(STOCKFISH_DEPTH);
  const [depthDraft, setDepthDraft] = useState(STOCKFISH_DEPTH);
  const [whiteAvatar, setWhiteAvatar] = useState<string | null>(null);
  const [blackAvatar, setBlackAvatar] = useState<string | null>(null);
  /** Chess.com-style free exploration off the main game line. */
  const [isExploring, setIsExploring] = useState(false);
  const [exploreRootIndex, setExploreRootIndex] = useState(-1);
  const [exploreMoves, setExploreMoves] = useState<ExploreMove[]>([]);
  /** Index into exploreMoves; -1 = position at the branch point. */
  const [explorePly, setExplorePly] = useState(-1);
  const [exploreEngine, setExploreEngine] = useState<ExploreEngineState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  /** Ignore the click that browsers fire after a drag-drop. */
  const suppressClickRef = useRef(false);
  const exploreEngineRequestRef = useRef(0);

  useEffect(() => {
    if (game) {
      persistSelectedGame(game);
      return;
    }

    if (!currentUser?.id || !gameId) return;

    profileAnalysisService.loadProfile(currentUser.id).then((profile) => {
      const found = profile?.games.find((item) => item.id === gameId) || null;
      if (found) {
        setGame(found);
        persistSelectedGame(found);
      }
    });
  }, [currentUser?.id, game, gameId]);

  useEffect(() => {
    setDepthDraft(analysisDepth);
  }, [analysisDepth]);

  useEffect(() => {
    if (!game) return undefined;

    const abortController = new AbortController();
    let cancelled = false;

    const runAnalysis = async () => {
      setIsAnalyzing(true);
      setAnalysis(null);
      setAnalysisError(null);
      setAnalysisProgress({
        currentMove: 0,
        totalMoves: game.moves?.length || 0,
        progress: 0,
        message: 'Loading saved review…',
      });
      setCurrentMoveIndex(-1);
      setIsPlaying(false);
      setIsExploring(false);
      setExploreRootIndex(-1);
      setExploreMoves([]);
      setExplorePly(-1);
      setExploreEngine(null);

      if (currentUser?.id) {
        try {
          const saved = await userDataService.loadGameReview(currentUser.id, game.id);
          if (
            !cancelled &&
            !abortController.signal.aborted &&
            saved?.analysis &&
            saved.depth >= analysisDepth
          ) {
            setAnalysis(saved.analysis);
            setIsAnalyzing(false);
            setAnalysisProgress(null);
            return;
          }
        } catch (loadError) {
          console.error('Could not load saved game review:', loadError);
        }
      }

      if (cancelled || abortController.signal.aborted) return;

      setAnalysisProgress({
        currentMove: 0,
        totalMoves: game.moves?.length || 0,
        progress: 0,
        message: 'Starting Stockfish…',
      });

      try {
        const result = await analyzeGameForReview(game, {
          depth: analysisDepth,
          signal: abortController.signal,
          onProgress: setAnalysisProgress,
        });
        if (cancelled || abortController.signal.aborted) return;
        setAnalysis(result);
        setIsAnalyzing(false);
        setAnalysisProgress(null);
        if (currentUser?.id) {
          void userDataService.saveGameReview(currentUser.id, game.id, result, analysisDepth);
        }
      } catch (error: unknown) {
        if (cancelled || abortController.signal.aborted) return;
        setIsAnalyzing(false);
        setAnalysisError(error instanceof Error ? error.message : 'Stockfish analysis failed');
      }
    };

    void runAnalysis();

    return () => {
      cancelled = true;
      abortController.abort();
      stockfishService.terminate();
    };
  }, [analysisDepth, currentUser?.id, game]);

  const exitExplore = useCallback(() => {
    exploreEngineRequestRef.current += 1;
    setIsExploring(false);
    setExploreRootIndex(-1);
    setExploreMoves([]);
    setExplorePly(-1);
    setExploreEngine(null);
  }, []);

  const goToMove = useCallback(
    (index: number) => {
      if (!analysis) return;
      setIsPlaying(false);
      exitExplore();
      setCurrentMoveIndex(Math.max(-1, Math.min(index, analysis.moves.length - 1)));
    },
    [analysis, exitExplore]
  );

  const returnToGame = useCallback(() => {
    setIsPlaying(false);
    setCurrentMoveIndex(exploreRootIndex);
    exitExplore();
  }, [exitExplore, exploreRootIndex]);

  const mainLineFen = useMemo(() => {
    if (!game || !analysis) return START_FEN;
    return fenAtMainLineIndex(analysis, currentMoveIndex);
  }, [analysis, currentMoveIndex, game]);

  const currentMove = !isExploring && analysis && currentMoveIndex >= 0
    ? analysis.moves[currentMoveIndex]
    : null;

  const exploreMove = isExploring && explorePly >= 0 ? exploreMoves[explorePly] : null;

  // Chess.com Game Review: after a suboptimal move, show a green suggestion
  // arrow for the best move that should have been played (from fenBefore),
  // not a red arrow along the move that was already played.
  const showSuggestion =
    !isExploring &&
    Boolean(currentMove) &&
    ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(currentMove!.classification) &&
    Boolean(currentMove!.bestMoveFrom && currentMove!.bestMoveTo) &&
    (currentMove!.bestMoveFrom !== currentMove!.from || currentMove!.bestMoveTo !== currentMove!.to);

  const positionFen = useMemo(() => {
    if (!analysis) return START_FEN;
    if (!isExploring) return mainLineFen;
    if (explorePly < 0) return fenAtMainLineIndex(analysis, exploreRootIndex);
    return exploreMoves[explorePly]?.fenAfter || fenAtMainLineIndex(analysis, exploreRootIndex);
  }, [analysis, exploreMoves, explorePly, exploreRootIndex, isExploring, mainLineFen]);

  const sideToMove = useMemo(() => {
    try {
      return new Chess(positionFen).turn();
    } catch {
      return 'w' as const;
    }
  }, [positionFen]);

  // Live Stockfish suggestions while exploring a line that differs from the game.
  useEffect(() => {
    if (!isExploring || !analysis || isAnalyzing) {
      return undefined;
    }

    let cancelled = false;
    const requestId = ++exploreEngineRequestRef.current;
    const fen = positionFen;

    setExploreEngine({
      loading: true,
      evaluation: null,
      sideToMoveBest: null,
    });

    (async () => {
      try {
        const sideEval = await stockfishService.evaluatePosition(fen, EXPLORE_ENGINE_DEPTH);
        if (cancelled || requestId !== exploreEngineRequestRef.current) return;

        setExploreEngine({
          loading: false,
          evaluation: sideEval.evaluation,
          sideToMoveBest: suggestionFromUci(fen, sideEval.bestMoveUci),
        });
      } catch {
        if (cancelled || requestId !== exploreEngineRequestRef.current) return;
        setExploreEngine({
          loading: false,
          evaluation: null,
          sideToMoveBest: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [analysis, isAnalyzing, isExploring, positionFen]);

  const boardArrows = useMemo(() => {
    // Only draw the side-to-move suggestion on the current board. The opponent
    // reply is shown as text (it applies after the engine's first move).
    if (isExploring && exploreEngine?.sideToMoveBest) {
      return [
        {
          startSquare: exploreEngine.sideToMoveBest.from,
          endSquare: exploreEngine.sideToMoveBest.to,
          color: exploreEngine.sideToMoveBest.color === 'w' ? '#15781B' : '#2563EB',
        },
      ];
    }

    if (!showSuggestion || !currentMove?.bestMoveFrom || !currentMove?.bestMoveTo) return [];
    return [
      {
        startSquare: currentMove.bestMoveFrom,
        endSquare: currentMove.bestMoveTo,
        color: '#15781B',
      },
    ];
  }, [currentMove, exploreEngine, isExploring, showSuggestion]);

  const legalTargets = useMemo(
    () => (selectedSquare ? getLegalTargets(positionFen, selectedSquare) : []),
    [positionFen, selectedSquare]
  );

  const legalTargetSet = useMemo(
    () => new Set(legalTargets.map((target) => target.to)),
    [legalTargets]
  );

  useEffect(() => {
    setSelectedSquare(null);
    setHoverSquare(null);
  }, [positionFen]);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setHoverSquare(null);
  }, []);

  const applyBoardMove = useCallback(
    (from: string, to: string): boolean => {
      if (!analysis || from === to) return false;

      const played = tryPlayMove(positionFen, from, to);
      if (!played) return false;

      setIsPlaying(false);
      clearSelection();

      // Stay on the main line when the user plays the next game move.
      if (!isExploring) {
        const next = analysis.moves[currentMoveIndex + 1];
        if (next && next.from === played.from && next.to === played.to && next.san === played.san) {
          setCurrentMoveIndex(currentMoveIndex + 1);
          return true;
        }

        setIsExploring(true);
        setExploreRootIndex(currentMoveIndex);
        setExploreMoves([played]);
        setExplorePly(0);
        return true;
      }

      // Exploring: truncate any forward variation, then append the new move.
      const kept = exploreMoves.slice(0, explorePly + 1);
      const nextMoves = [...kept, played];
      setExploreMoves(nextMoves);
      setExplorePly(nextMoves.length - 1);
      return true;
    },
    [
      analysis,
      clearSelection,
      currentMoveIndex,
      exploreMoves,
      explorePly,
      isExploring,
      positionFen,
    ]
  );

  const selectSquare = useCallback(
    (square: string) => {
      try {
        const chess = new Chess(positionFen);
        const piece = chess.get(square as Square);
        if (!piece || piece.color !== sideToMove) {
          clearSelection();
          return;
        }
        setSelectedSquare(square);
      } catch {
        clearSelection();
      }
    },
    [clearSelection, positionFen, sideToMove]
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      if (!targetSquare || targetSquare === sourceSquare) {
        // Keep selection on cancelled drag so legal moves stay visible.
        selectSquare(sourceSquare);
        return false;
      }
      return applyBoardMove(sourceSquare, targetSquare);
    },
    [applyBoardMove, selectSquare]
  );

  const handleSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (suppressClickRef.current) return;

      if (selectedSquare) {
        if (square === selectedSquare) {
          clearSelection();
          return;
        }
        if (legalTargetSet.has(square)) {
          applyBoardMove(selectedSquare, square);
          return;
        }
        if (piece && piece.pieceType.startsWith(sideToMove)) {
          selectSquare(square);
          return;
        }
        clearSelection();
        return;
      }

      if (piece && piece.pieceType.startsWith(sideToMove)) {
        selectSquare(square);
      }
    },
    [
      applyBoardMove,
      clearSelection,
      legalTargetSet,
      selectSquare,
      selectedSquare,
      sideToMove,
    ]
  );

  const handlePieceDrag = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (square) selectSquare(square);
    },
    [selectSquare]
  );

  const handleMouseOverSquare = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (selectedSquare && legalTargetSet.has(square)) {
        setHoverSquare(square);
      } else {
        setHoverSquare(null);
      }
    },
    [legalTargetSet, selectedSquare]
  );

  const handleMouseOutSquare = useCallback(() => {
    setHoverSquare(null);
  }, []);

  const canDragPiece = useCallback(
    ({ piece }: PieceHandlerArgs) => {
      const color = piece.pieceType.startsWith('w') ? 'w' : 'b';
      return color === sideToMove;
    },
    [sideToMove]
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    const paintLastMove = (from: string, to: string, toTint?: string) => {
      styles[from] = { ...styles[from], backgroundColor: LAST_MOVE_TINT };
      styles[to] = { ...styles[to], backgroundColor: toTint || LAST_MOVE_TINT };
    };

    if (exploreMove) {
      paintLastMove(exploreMove.from, exploreMove.to);
    } else if (currentMove) {
      paintLastMove(
        currentMove.from,
        currentMove.to,
        CLASSIFICATION_TINT[currentMove.classification]
      );
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: SELECTED_SQUARE_TINT,
      };
    }

    legalTargets.forEach(({ to, isCapture }) => {
      const existing = styles[to] || {};
      if (hoverSquare === to) {
        // Chess.com: yellow wash replaces the gray hint on hover.
        styles[to] = {
          ...existing,
          backgroundColor: HOVER_LEGAL_TINT,
          backgroundImage: 'none',
          cursor: 'pointer',
        };
        return;
      }

      styles[to] = {
        ...existing,
        backgroundImage: isCapture ? LEGAL_CAPTURE_RING : LEGAL_MOVE_DOT,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        cursor: 'pointer',
      };
    });

    return styles;
  }, [currentMove, exploreMove, hoverSquare, legalTargets, selectedSquare]);

  const stepExploreBack = useCallback(() => {
    if (!isExploring) return;
    if (explorePly < 0) {
      returnToGame();
      return;
    }
    setExplorePly((prev) => prev - 1);
  }, [explorePly, isExploring, returnToGame]);

  const stepExploreForward = useCallback(() => {
    if (!isExploring) return;
    if (explorePly >= exploreMoves.length - 1) return;
    setExplorePly((prev) => prev + 1);
  }, [exploreMoves.length, explorePly, isExploring]);

  const stepBack = useCallback(() => {
    if (isExploring) {
      stepExploreBack();
      return;
    }
    goToMove(currentMoveIndex - 1);
  }, [currentMoveIndex, goToMove, isExploring, stepExploreBack]);

  const stepForward = useCallback(() => {
    if (isExploring) {
      stepExploreForward();
      return;
    }
    goToMove(currentMoveIndex + 1);
  }, [currentMoveIndex, goToMove, isExploring, stepExploreForward]);

  useEffect(() => {
    if (!isPlaying || !analysis || isExploring) return undefined;
    if (currentMoveIndex >= analysis.moves.length - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCurrentMoveIndex((prev) => {
        if (!analysis || prev >= analysis.moves.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, [analysis, currentMoveIndex, isExploring, isPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!analysis) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepBack();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepForward();
      } else if (event.key === 'Home') {
        event.preventDefault();
        goToMove(-1);
      } else if (event.key === 'End') {
        event.preventDefault();
        goToMove(analysis.moves.length - 1);
      } else if (event.key === 'Escape' && isExploring) {
        event.preventDefault();
        returnToGame();
      } else if (event.key === ' ') {
        event.preventDefault();
        if (isExploring) return;
        if (currentMoveIndex >= analysis.moves.length - 1) goToMove(-1);
        setIsPlaying((prev) => !prev);
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    analysis,
    currentMoveIndex,
    goToMove,
    isExploring,
    returnToGame,
    stepBack,
    stepForward,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadAvatar = async (username: string, setter: (url: string | null) => void) => {
      if (!username || username === 'Unknown') {
        setter(null);
        return;
      }
      try {
        const response = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`);
        if (!response.ok) {
          if (isMounted) setter(null);
          return;
        }
        const data = await response.json();
        if (isMounted) setter(typeof data?.avatar === 'string' ? data.avatar : null);
      } catch {
        if (isMounted) setter(null);
      }
    };

    if (game?.site === 'chess.com') {
      loadAvatar(game.white.name, setWhiteAvatar);
      loadAvatar(game.black.name, setBlackAvatar);
    } else {
      setWhiteAvatar(null);
      setBlackAvatar(null);
    }

    return () => {
      isMounted = false;
    };
  }, [game]);

  const clockIndex = isExploring ? exploreRootIndex : currentMoveIndex;

  const whiteClock = useMemo(() => {
    if (!analysis) return '—';
    for (let i = clockIndex; i >= 0; i -= 1) {
      if (analysis.moves[i].color === 'w' && analysis.moves[i].clock) return analysis.moves[i].clock!;
    }
    return analysis.moves.find((m) => m.color === 'w' && m.clock)?.clock || '—';
  }, [analysis, clockIndex]);

  const blackClock = useMemo(() => {
    if (!analysis) return '—';
    for (let i = clockIndex; i >= 0; i -= 1) {
      if (analysis.moves[i].color === 'b' && analysis.moves[i].clock) return analysis.moves[i].clock!;
    }
    return analysis.moves.find((m) => m.color === 'b' && m.clock)?.clock || '—';
  }, [analysis, clockIndex]);

  const exploreLineText = useMemo(() => {
    if (!isExploring || exploreMoves.length === 0) return '';
    return exploreMoves
      .map((move, index) => {
        const absolutePly = exploreRootIndex + 1 + index;
        const number = Math.floor(absolutePly / 2) + 1;
        if (move.color === 'w') return `${number}. ${move.san}`;
        if (index === 0) return `${number}... ${move.san}`;
        return move.san;
      })
      .join(' ');
  }, [exploreMoves, exploreRootIndex, isExploring]);

  const statusText = useMemo(() => {
    if (!analysis) return '';
    if (isExploring) {
      const engineEval =
        exploreEngine && !exploreEngine.loading && exploreEngine.evaluation !== null
          ? ` · ${formatEval(exploreEngine.evaluation)}`
          : exploreEngine?.loading
            ? ' · Stockfish…'
            : '';
      return exploreLineText
        ? `Exploring · ${exploreLineText}${engineEval}`
        : `Exploring · drag pieces to try a different line${engineEval}`;
    }
    if (currentMoveIndex < 0) {
      const startEval = analysis.evalSeries[0] ?? 0;
      return `${evalStatusText(startEval)} · ${formatEval(startEval)}`;
    }
    const evaluation = analysis.moves[currentMoveIndex].evaluation;
    return `${evalStatusText(evaluation)} · ${formatEval(evaluation)}`;
  }, [analysis, currentMoveIndex, exploreEngine, exploreLineText, isExploring]);

  const movePairs = useMemo(() => {
    if (!analysis) return [];
    const pairs: Array<{ number: number; white?: typeof analysis.moves[0]; black?: typeof analysis.moves[0] }> = [];
    for (let i = 0; i < analysis.moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: analysis.moves[i],
        black: analysis.moves[i + 1],
      });
    }
    return pairs;
  }, [analysis]);

  const timeStats = useMemo(() => {
    if (!analysis) {
      return {
        hasClocks: false,
        whiteTotal: 0,
        blackTotal: 0,
        whiteAvg: 0,
        blackAvg: 0,
        whiteMoves: [] as Array<{ index: number; moveNumber: number; san: string; spent: number }>,
        blackMoves: [] as Array<{ index: number; moveNumber: number; san: string; spent: number }>,
        maxSpend: 1,
      };
    }

    const whiteMoves = analysis.moves
      .filter((move) => move.color === 'w' && typeof move.timeSpentSeconds === 'number')
      .map((move) => ({
        index: move.index,
        moveNumber: move.moveNumber,
        san: move.san,
        spent: move.timeSpentSeconds!,
      }));
    const blackMoves = analysis.moves
      .filter((move) => move.color === 'b' && typeof move.timeSpentSeconds === 'number')
      .map((move) => ({
        index: move.index,
        moveNumber: move.moveNumber,
        san: move.san,
        spent: move.timeSpentSeconds!,
      }));

    const whiteTotal = whiteMoves.reduce((sum, move) => sum + move.spent, 0);
    const blackTotal = blackMoves.reduce((sum, move) => sum + move.spent, 0);
    const maxSpend = Math.max(1, ...whiteMoves.map((m) => m.spent), ...blackMoves.map((m) => m.spent));

    return {
      hasClocks: whiteMoves.length > 0 || blackMoves.length > 0,
      whiteTotal,
      blackTotal,
      whiteAvg: whiteMoves.length ? whiteTotal / whiteMoves.length : 0,
      blackAvg: blackMoves.length ? blackTotal / blackMoves.length : 0,
      whiteMoves,
      blackMoves,
      maxSpend,
    };
  }, [analysis]);

  if (!game) {
    return (
      <div className="section-shell py-16">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">Game not found</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Select a game from your dashboard archive to open the review board.
          </p>
          <Button className="mt-6 cursor-pointer" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (isAnalyzing || !analysis) {
    return (
      <div className="section-shell py-16">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-white">
            {analysisError ? 'Analysis failed' : 'Stockfish is analyzing'}
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {analysisError || analysisProgress?.message || 'Loading Stockfish engine…'}
          </p>
          {!analysisError && (
            <div className="mx-auto mt-6 h-2 max-w-sm overflow-hidden rounded-full bg-primary-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-primary-600 transition-all"
                style={{ width: `${analysisProgress?.progress ?? 5}%` }}
              />
            </div>
          )}
          {analysisProgress && !analysisError && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Depth {analysisDepth} · move {analysisProgress.currentMove}/{analysisProgress.totalMoves}
            </p>
          )}
          {analysisError && (
            <Button className="mt-6 cursor-pointer" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  const openingName = game.opening?.name && game.opening.name !== 'Unknown'
    ? game.opening.name
    : 'Unknown opening';

  return (
    <div className="flex flex-col bg-gradient-to-b from-primary-50/80 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 lg:h-[calc(100dvh-5rem)] lg:overflow-hidden">
      <div className="shrink-0 border-b border-primary-200/70 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-3 sm:px-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-primary-800 transition hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-primary-200 dark:bg-slate-700" />
          <p className="truncate text-sm text-slate-600 dark:text-slate-300">
            {game.white.name} vs {game.black.name}
          </p>
          <span className="ml-auto hidden text-xs text-slate-500 sm:inline dark:text-slate-400">
            Stockfish · depth {analysis.depth}
          </span>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 gap-3 p-3 pb-2 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:items-stretch xl:grid-cols-[300px_minmax(0,1fr)_320px] xl:gap-4 xl:px-4 xl:pb-2">
        <aside className="order-2 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-primary-200/80 bg-white/90 shadow-soft dark:border-slate-700 dark:bg-slate-900/80 lg:order-1 lg:h-full lg:min-h-0">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="border-b border-primary-100 bg-primary-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/80">
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">{resultLabel(game.result)}</p>
              <p className="mt-1 text-sm text-primary-800 dark:text-primary-300">{openingName}</p>
              <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                <p>
                  <span className="font-medium text-slate-900 dark:text-white">{game.white.name}</span>
                  {game.white.rating ? ` (${game.white.rating})` : ''}
                </p>
                <p>
                  <span className="font-medium text-slate-900 dark:text-white">{game.black.name}</span>
                  {game.black.rating ? ` (${game.black.rating})` : ''}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {[game.timeControl, game.date].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <div className="border-b border-primary-100 bg-white/95 p-3 dark:border-slate-700 dark:bg-slate-900/95">
              <EvalGraph
                series={analysis.evalSeries}
                currentIndex={currentMoveIndex}
                onSelectIndex={goToMove}
              />
            </div>

            <div>
              <div className="grid grid-cols-[40px_1fr_1fr] border-b border-primary-100 bg-slate-50/95 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-400">
                <span>#</span>
                <span>White</span>
                <span>Black</span>
              </div>
              {movePairs.map((pair) => {
                const whiteActive = pair.white && pair.white.index === currentMoveIndex;
                const blackActive = pair.black && pair.black.index === currentMoveIndex;
                return (
                  <div key={pair.number} className="grid grid-cols-[40px_1fr_1fr] border-b border-primary-50 text-sm dark:border-slate-800">
                    <div className="px-2 py-1.5 text-slate-400">{pair.number}</div>
                    <button
                      type="button"
                      disabled={!pair.white}
                      onClick={() => pair.white && goToMove(pair.white.index)}
                      className={`cursor-pointer px-2 py-1.5 text-left font-mono transition ${
                        whiteActive
                          ? 'bg-primary-200/80 text-slate-900 dark:bg-primary-500/30 dark:text-white'
                          : 'hover:bg-primary-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pair.white ? (
                        <>
                          {pair.white.san}
                          {pair.white.glyph ? (
                            <span
                              className="ml-1 text-xs font-semibold"
                              style={{ color: classificationMeta[pair.white.classification].color }}
                            >
                              {pair.white.glyph}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      disabled={!pair.black}
                      onClick={() => pair.black && goToMove(pair.black.index)}
                      className={`cursor-pointer px-2 py-1.5 text-left font-mono transition ${
                        blackActive
                          ? 'bg-primary-200/80 text-slate-900 dark:bg-primary-500/30 dark:text-white'
                          : 'hover:bg-primary-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {pair.black ? (
                        <>
                          {pair.black.san}
                          {pair.black.glyph ? (
                            <span
                              className="ml-1 text-xs font-semibold"
                              style={{ color: classificationMeta[pair.black.classification].color }}
                            >
                              {pair.black.glyph}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="order-1 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-primary-200/80 bg-white/90 p-3 shadow-soft dark:border-slate-700 dark:bg-slate-900/80 sm:p-4 lg:order-2 lg:h-full lg:min-h-0">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{game.white.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{whiteClock}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="truncate font-semibold text-slate-900 dark:text-white">{game.black.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{blackClock}</p>
            </div>
          </div>

          <div
            className={`mb-3 flex shrink-0 items-center justify-center gap-3 rounded-xl px-4 py-2 text-center text-sm font-medium ${
              isExploring
                ? 'bg-amber-500/15 text-amber-900 ring-1 ring-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/30'
                : 'bg-slate-900 text-white dark:bg-primary-500/20 dark:text-primary-100'
            }`}
          >
            <span className="min-w-0 truncate">{statusText}</span>
            {isExploring && (
              <button
                type="button"
                onClick={returnToGame}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                <X className="h-3.5 w-3.5" />
                Return to game
              </button>
            )}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <div className="relative aspect-square h-full max-h-full w-auto max-w-full">
              <div className="review-chessboard h-full w-full overflow-hidden rounded-sm border border-[#8b5a2b]/70 shadow-elevated">
                <Chessboard
                  options={{
                    position: positionFen,
                    boardOrientation,
                    allowDragging: true,
                    allowDragOffBoard: false,
                    // Chess.com: click selects; a few px starts a drag.
                    dragActivationDistance: 2,
                    // Soft ease-out glide after drop / when scrubbing moves.
                    animationDurationInMs: 200,
                    showAnimations: true,
                    canDragPiece,
                    onPieceDrag: handlePieceDrag,
                    onPieceDrop: handlePieceDrop,
                    onSquareClick: handleSquareClick,
                    onMouseOverSquare: handleMouseOverSquare,
                    onMouseOutSquare: handleMouseOutSquare,
                    showNotation: true,
                    arrows: boardArrows,
                    squareStyles,
                    lightSquareStyle: { backgroundColor: BOARD_LIGHT },
                    darkSquareStyle: { backgroundColor: BOARD_DARK },
                    lightSquareNotationStyle: { color: BOARD_DARK },
                    darkSquareNotationStyle: { color: BOARD_LIGHT },
                    // Chess.com dest preview while dragging.
                    dropSquareStyle: {
                      backgroundColor: HOVER_LEGAL_TINT,
                      boxShadow: 'none',
                    },
                    // Subtle lift + soft shadow (Chess.com), not the library's chunky 1.2x.
                    draggingPieceStyle: {
                      transform: 'scale(1.05)',
                      filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.28))',
                      cursor: 'grabbing',
                    },
                    draggingPieceGhostStyle: {
                      opacity: 0.35,
                    },
                    boardStyle: {
                      borderRadius: '2px',
                      width: '100%',
                      height: '100%',
                      cursor: selectedSquare ? 'pointer' : 'default',
                    },
                  }}
                />
              </div>

              {!isExploring && currentMove && currentMove.glyph && (
                <ClassificationBadge
                  square={currentMove.to}
                  glyph={currentMove.glyph}
                  classification={currentMove.classification}
                  orientation={boardOrientation}
                />
              )}
            </div>
          </div>

          <div className="mt-4 flex shrink-0 flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Flip board"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToMove(-1)}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Start"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={stepBack}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isExploring) {
                      returnToGame();
                      return;
                    }
                    if (currentMoveIndex >= analysis.moves.length - 1) goToMove(-1);
                    setIsPlaying((prev) => !prev);
                  }}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700"
                  aria-label={isExploring ? 'Return to game' : isPlaying ? 'Pause' : 'Play'}
                >
                  {isExploring ? <X className="h-4 w-4" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={stepForward}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goToMove(analysis.moves.length - 1)}
                  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-label="End"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
              {isExploring
                ? 'Variation mode · Stockfish updates after every move · Esc returns to the played line'
                : 'Click a piece for legal moves, or drag to play · leaving the game line opens engine suggestions'}
            </p>
          </div>
        </section>

        <aside className="order-3 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-primary-200/80 bg-white/90 shadow-soft dark:border-slate-700 dark:bg-slate-900/80 lg:h-full lg:min-h-0">
          <div className="flex shrink-0 border-b border-primary-100 dark:border-slate-700">
            {([
              ['report', 'Report'],
              ['time', 'Time'],
              ['database', 'Database'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 cursor-pointer px-3 py-2.5 text-sm font-medium transition ${
                  activeTab === id
                    ? 'border-b-2 border-primary-600 text-primary-800 dark:border-primary-400 dark:text-primary-300'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {activeTab === 'report' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <img
                      src={whiteAvatar || '/pnp_logo.jpeg'}
                      alt={game.white.name}
                      className="mx-auto h-14 w-14 rounded-full border-2 border-white object-cover shadow dark:border-slate-700"
                    />
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {analysis.whiteAccuracy.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
                    <p className="mt-1 text-sm font-medium text-primary-700 dark:text-primary-300">{analysis.whitePerformance}</p>
                  </div>
                  <div>
                    <img
                      src={blackAvatar || '/pnp_logo.jpeg'}
                      alt={game.black.name}
                      className="mx-auto h-14 w-14 rounded-full border-2 border-white object-cover shadow dark:border-slate-700"
                    />
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                      {analysis.blackAccuracy.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Accuracy</p>
                    <p className="mt-1 text-sm font-medium text-primary-700 dark:text-primary-300">{analysis.blackPerformance}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {CLASSIFICATION_ORDER.map((key) => {
                    const meta = classificationMeta[key];
                    return (
                      <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: meta.color }}
                          >
                            {meta.glyph || '•'}
                          </span>
                          <span className="text-slate-700 dark:text-slate-200">{meta.label}</span>
                        </div>
                        <span className="w-6 text-right font-semibold text-slate-900 dark:text-white">
                          {analysis.counts.white[key]}
                        </span>
                        <span className="w-6 text-right font-semibold text-slate-900 dark:text-white">
                          {analysis.counts.black[key]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <PhaseBars phaseAccuracy={analysis.phaseAccuracy} />
              </div>
            )}

            {activeTab === 'time' && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                    Clock
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        White
                      </p>
                      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                        {whiteClock}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{game.white.name}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-900 px-3 py-3 text-white dark:border-slate-600 dark:bg-slate-950">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Black</p>
                      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{blackClock}</p>
                      <p className="mt-1 truncate text-xs text-slate-300">{game.black.name}</p>
                    </div>
                  </div>
                </div>

                {timeStats.hasClocks ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
                          White used
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatSeconds(timeStats.whiteTotal)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          avg {formatSeconds(Math.round(timeStats.whiteAvg))}/move
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          Black used
                        </p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                          {formatSeconds(timeStats.blackTotal)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          avg {formatSeconds(Math.round(timeStats.blackAvg))}/move
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                        Time per move
                      </p>
                      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                        {analysis.moves
                          .filter((move) => typeof move.timeSpentSeconds === 'number')
                          .map((move) => {
                            const spent = move.timeSpentSeconds!;
                            const width = Math.max(6, (spent / timeStats.maxSpend) * 100);
                            const active = move.index === currentMoveIndex;
                            return (
                              <button
                                key={move.index}
                                type="button"
                                onClick={() => goToMove(move.index)}
                                className={`grid w-full cursor-pointer grid-cols-[52px_1fr_44px] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                                  active
                                    ? 'bg-primary-100 dark:bg-primary-900/40'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                  {move.color === 'w' ? `${move.moveNumber}.` : `${move.moveNumber}...`}
                                  {move.san}
                                </span>
                                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                  <div
                                    className={`h-full rounded-full ${
                                      move.color === 'w' ? 'bg-primary-500' : 'bg-slate-700 dark:bg-slate-300'
                                    }`}
                                    style={{ width: `${width}%` }}
                                  />
                                </div>
                                <span className="text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-200">
                                  {formatSeconds(spent)}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-600 dark:bg-slate-800/50">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">No clock data</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      This PGN has no `%clk` annotations, so think time per move is unavailable.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'database' && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                    Game source
                  </p>
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Platform</span>
                      <span className="font-medium capitalize text-slate-900 dark:text-white">{game.site}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 text-slate-500 dark:text-slate-400">Opening</span>
                      <span className="text-right font-medium text-slate-900 dark:text-white">{openingName}</span>
                    </div>
                    {game.opening?.eco && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">ECO</span>
                        <span className="font-mono font-medium text-slate-900 dark:text-white">{game.opening.eco}</span>
                      </div>
                    )}
                    {game.timeControl && (
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Time control</span>
                        <span className="font-medium text-slate-900 dark:text-white">{game.timeControl}</span>
                      </div>
                    )}
                    {game.url && (
                      <a
                        href={game.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex cursor-pointer text-sm font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                      >
                        Open original game
                      </a>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                    Stockfish analysis
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/80">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Search depth</p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          Higher depth is stronger but slower
                        </p>
                      </div>
                      <p className="font-mono text-2xl font-semibold tabular-nums text-primary-700 dark:text-primary-300">
                        {depthDraft}
                      </p>
                    </div>

                    <input
                      type="range"
                      min={DEPTH_MIN}
                      max={DEPTH_MAX}
                      step={1}
                      value={depthDraft}
                      onChange={(event) => setDepthDraft(Number(event.target.value))}
                      className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary-600 dark:bg-slate-700"
                      aria-label="Stockfish analysis depth"
                    />

                    <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      <span>Fast ({DEPTH_MIN})</span>
                      <span>Deep ({DEPTH_MAX})</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                      {[
                        { label: 'Fast', value: 10 },
                        { label: 'Balanced', value: 14 },
                        { label: 'Deep', value: 18 },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setDepthDraft(preset.value)}
                          className={`cursor-pointer rounded-lg border px-2 py-1.5 font-medium transition ${
                            depthDraft === preset.value
                              ? 'border-primary-500 bg-primary-50 text-primary-800 dark:border-primary-400 dark:bg-primary-950/40 dark:text-primary-200'
                              : 'border-slate-200 text-slate-600 hover:border-primary-300 dark:border-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {preset.label}
                          <span className="mt-0.5 block font-mono text-slate-500 dark:text-slate-400">d{preset.value}</span>
                        </button>
                      ))}
                    </div>

                    <Button
                      className="mt-4 w-full cursor-pointer"
                      disabled={depthDraft === analysisDepth && !isAnalyzing}
                      onClick={() => setAnalysisDepth(depthDraft)}
                    >
                      {depthDraft === analysisDepth
                        ? `Using depth ${analysis.depth}`
                        : `Re-analyze at depth ${depthDraft}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default GameReviewPage;
