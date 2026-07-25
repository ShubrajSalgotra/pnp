import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ChessReport } from '../types/report';
import { useChessboardInteraction } from '../hooks/useChessboardInteraction';
import { useChessSounds } from '../hooks/useChessSounds';
import { BoardLastMove } from '../utils/chessboardTheme';
import { loadPracticeOpponent } from '../utils/practiceOpponent';
import {
  BotMoveResult,
  OpponentStyleBot,
  chooseOpponentStyleMove,
  createOpponentStyleBot,
} from '../utils/opponentStyleBot';
import { stockfishService } from '../services/stockfishService';
import { ChessGame } from '../types/game';
import { fetchOpponentLiveProfile } from '../utils/opponentStats';

type PlayerColor = 'w' | 'b';
type GameStatus = 'setup' | 'playing' | 'ended';

const BOT_THINK_DELAY_MS = 450;

const OpponentPracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { playFromMove, playIllegal } = useChessSounds();

  const [report, setReport] = useState<ChessReport | null>(null);
  const [bot, setBot] = useState<OpponentStyleBot | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [status, setStatus] = useState<GameStatus>('setup');
  const [fen, setFen] = useState(() => new Chess().fen());
  const [lastMove, setLastMove] = useState<BoardLastMove | null>(null);
  const [moveSans, setMoveSans] = useState<string[]>([]);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [lastBotSource, setLastBotSource] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  const gameRef = useRef(new Chess());
  const botJobRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const loaded = loadPracticeOpponent();
      if (!loaded?.rawGameData?.length) {
        navigate('/analyze', { replace: true });
        return;
      }

      setReport(loaded);
      const games = loaded.rawGameData as ChessGame[];

      let liveRatings: {
        rapid: number | null;
        blitz: number | null;
        bullet: number | null;
      } | null = null;

      try {
        const live = await fetchOpponentLiveProfile(loaded.platform, loaded.username);
        liveRatings = live.ratings;
      } catch {
        // fall back to game/report ratings
      }

      if (cancelled) return;

      setBot(
        createOpponentStyleBot(games, loaded.username, {
          report: loaded,
          liveRatings,
        })
      );

      try {
        await stockfishService.init();
        if (!cancelled) setEngineReady(true);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setEngineError('Engine failed to start. Book moves still work; middlegame may be limited.');
          setEngineReady(true);
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      botJobRef.current += 1;
      void stockfishService.clearStrengthLimit().catch(() => undefined);
    };
  }, [navigate]);

  const describeResult = useCallback((game: Chess, humanColor: PlayerColor) => {
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'b' : 'w';
      return winner === humanColor ? 'You win — checkmate' : `${report?.username || 'Opponent'} wins — checkmate`;
    }
    if (game.isDraw()) {
      if (game.isStalemate()) return 'Draw — stalemate';
      if (game.isThreefoldRepetition()) return 'Draw — repetition';
      if (game.isInsufficientMaterial()) return 'Draw — insufficient material';
      return 'Draw';
    }
    return 'Game over';
  }, [report?.username]);

  const applyBotMove = useCallback(
    async (humanColor: PlayerColor) => {
      const jobId = ++botJobRef.current;
      setIsBotThinking(true);
      try {
        await new Promise((resolve) => window.setTimeout(resolve, BOT_THINK_DELAY_MS));
        if (jobId !== botJobRef.current || !bot) return;

        const move: BotMoveResult | null = await chooseOpponentStyleMove(bot, gameRef.current.fen());
        if (jobId !== botJobRef.current || !move) return;

        const played = gameRef.current.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
        if (!played) return;

        setFen(gameRef.current.fen());
        setLastMove({ from: played.from, to: played.to });
        setMoveSans((prev) => [...prev, played.san]);
        setLastBotSource(
          move.source === 'book' && move.bookSupport
            ? `Book · ${move.bookSupport.count}/${move.bookSupport.total} games`
            : `Engine · ~${move.engineElo ?? bot.targetElo} Elo`
        );
        playFromMove({
          san: played.san,
          captured: Boolean(played.captured),
          isCheck: gameRef.current.inCheck(),
          isCheckmate: gameRef.current.isCheckmate(),
        });

        if (gameRef.current.isGameOver()) {
          setStatus('ended');
          setResultText(describeResult(gameRef.current, humanColor));
        }
      } finally {
        if (jobId === botJobRef.current) setIsBotThinking(false);
      }
    },
    [bot, describeResult, playFromMove]
  );

  const startGame = useCallback(
    (color: PlayerColor) => {
      if (!bot) return;
      botJobRef.current += 1;
      const fresh = new Chess();
      gameRef.current = fresh;
      setPlayerColor(color);
      setFen(fresh.fen());
      setLastMove(null);
      setMoveSans([]);
      setLastBotSource(null);
      setResultText(null);
      setStatus('playing');
      void stockfishService.newGame().catch(() => undefined);

      if (color === 'b') {
        void applyBotMove(color);
      }
    },
    [applyBotMove, bot]
  );

  const handlePlayerMove = useCallback(
    (from: string, to: string): boolean => {
      if (status !== 'playing' || isBotThinking) return false;
      if (gameRef.current.turn() !== playerColor) return false;

      const piece = gameRef.current.get(from as Square);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

      const played = gameRef.current.move({
        from,
        to,
        promotion: isPromotion ? 'q' : undefined,
      });

      if (!played) {
        playIllegal();
        return false;
      }

      setFen(gameRef.current.fen());
      setLastMove({ from: played.from, to: played.to });
      setMoveSans((prev) => [...prev, played.san]);
      playFromMove({
        san: played.san,
        captured: Boolean(played.captured),
        isCheck: gameRef.current.inCheck(),
        isCheckmate: gameRef.current.isCheckmate(),
      });

      if (gameRef.current.isGameOver()) {
        setStatus('ended');
        setResultText(describeResult(gameRef.current, playerColor));
        return true;
      }

      void applyBotMove(playerColor);
      return true;
    },
    [
      applyBotMove,
      describeResult,
      isBotThinking,
      playIllegal,
      playFromMove,
      playerColor,
      status,
    ]
  );

  const boardEnabled = status === 'playing' && !isBotThinking && gameRef.current.turn() === playerColor;

  const { boardOptions } = useChessboardInteraction({
    fen,
    enabled: boardEnabled,
    lastMove,
    onMove: handlePlayerMove,
  });

  const movePairs = useMemo(() => {
    const pairs: Array<{ number: number; white?: string; black?: string }> = [];
    for (let i = 0; i < moveSans.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moveSans[i],
        black: moveSans[i + 1],
      });
    }
    return pairs;
  }, [moveSans]);

  if (!report || !bot) {
    return (
      <div className="section-shell flex min-h-[50vh] items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="section-shell space-y-8 py-8">
      <section className="aurora-panel">
        <button
          type="button"
          onClick={() => navigate('/analyze')}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dossiers
        </button>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
          Practice
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          vs {report.username}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          Plays their openings from {bot.book.gamesUsed} games ({bot.book.movesIndexed} moves indexed).
          Out of book, the engine aims for about {bot.targetElo} Elo
          {bot.ratingSource === 'live'
            ? ' (their live rating)'
            : bot.ratingSource === 'games'
              ? ' (from recent games)'
              : bot.ratingSource === 'report'
                ? ' (from the report estimate)'
                : ''}
          {bot.targetElo < 1320
            ? ' — Stockfish’s floor is 1320, so we add extra weaker moves to match lower ratings.'
            : ''}
          .
        </p>
        {engineError && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{engineError}</p>
        )}
      </section>

      {status === 'setup' ? (
        <section className="mx-auto max-w-lg space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
              Choose your color
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Face their White repertoire as Black, or their Black repertoire as White.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={!engineReady}
              onClick={() => startGame('w')}
              className="cursor-pointer rounded-xl border border-primary-200/80 bg-white px-4 py-5 text-left transition-colors duration-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">Play White</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Bot uses their Black openings
              </p>
            </button>
            <button
              type="button"
              disabled={!engineReady}
              onClick={() => startGame('b')}
              className="cursor-pointer rounded-xl border border-primary-200/80 bg-white px-4 py-5 text-left transition-colors duration-200 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900"
            >
              <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">Play Black</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Bot uses their White openings
              </p>
            </button>
          </div>
          {!engineReady && (
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting engine…
            </p>
          )}
        </section>
      ) : (
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div>
            <div className="relative mx-auto aspect-square max-w-xl">
              <div className="review-chessboard h-full w-full overflow-hidden rounded-sm border border-[#8b5a2b]/70 shadow-elevated">
                <Chessboard
                  options={{
                    ...boardOptions,
                    boardOrientation: playerColor === 'w' ? 'white' : 'black',
                  }}
                />
              </div>
              {isBotThinking && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/95 dark:text-slate-200">
                    {report.username} is thinking…
                  </span>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                Status
              </p>
              <p className="mt-2 font-display text-xl font-semibold text-slate-900 dark:text-white">
                {status === 'ended'
                  ? resultText
                  : isBotThinking
                    ? `${report.username} to move`
                    : 'Your move'}
              </p>
              {lastBotSource && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Last bot move: {lastBotSource}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => startGame(playerColor)}
                className="cursor-pointer"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Rematch
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  botJobRef.current += 1;
                  setStatus('setup');
                  setIsBotThinking(false);
                }}
                className="cursor-pointer"
              >
                Change color
              </Button>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                Moves
              </p>
              <div className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm">
                {movePairs.length === 0 && (
                  <p className="text-slate-500 dark:text-slate-400">No moves yet.</p>
                )}
                {movePairs.map((pair) => (
                  <div key={pair.number} className="grid grid-cols-[2rem_1fr_1fr] gap-2 text-slate-700 dark:text-slate-300">
                    <span className="text-slate-400">{pair.number}.</span>
                    <span>{pair.white || ''}</span>
                    <span>{pair.black || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
};

export default OpponentPracticePage;
