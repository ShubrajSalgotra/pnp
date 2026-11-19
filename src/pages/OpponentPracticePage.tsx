import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess, type Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Loader2, RotateCcw, ChevronLeft, ChevronRight, SkipBack, SkipForward, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ChessReport } from '../types/report';
import { fetchFullOpponentOpeningBook } from '../services/opponentRepertoireService';
import { useChessboardInteraction } from '../hooks/useChessboardInteraction';
import { useChessSounds } from '../hooks/useChessSounds';
import { BoardLastMove } from '../utils/chessboardTheme';
import { loadPracticeOpponent } from '../utils/practiceOpponent';
import {
  type ChessColor,
  positionKeyFromFen,
} from '../utils/opponentOpeningBook';
import {
  BotMoveResult,
  OpponentStyleBot,
  chooseOpponentStyleMove,
  createOpponentStyleBot,
} from '../utils/opponentStyleBot';
import { stockfishService } from '../services/stockfishService';
import { ChessGame } from '../types/game';
import { fetchOpponentLiveProfile } from '../utils/opponentStats';

type PlayerColor = ChessColor;
type GameStatus = 'setup' | 'playing' | 'ended';

const BOT_THINK_DELAY_MS = 450;

const OpponentPracticePage: React.FC = () => {
  const navigate = useNavigate();
  const { playFromMove, playIllegal } = useChessSounds();

  const [report, setReport] = useState<ChessReport | null>(null);
  const [bot, setBot] = useState<OpponentStyleBot | null>(null);
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [status, setStatus] = useState<GameStatus>('setup');
  
  // Game history tracking for analysis mode
  const [history, setHistory] = useState<Array<{
    fen: string;
    lastMove: BoardLastMove | null;
    san: string | null;
  }>>([{ fen: new Chess().fen(), lastMove: null, san: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [botActive, setBotActive] = useState(true);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [rightPanelTab, setRightPanelTab] = useState<'stats' | 'tree'>('stats');

  const [isBotThinking, setIsBotThinking] = useState(false);
  const [lastBotSource, setLastBotSource] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Loading opponent dossier...');

  const botJobRef = useRef(0);
  const setupJobRef = useRef(0);

  useEffect(() => {
    const loaded = loadPracticeOpponent();
    if (!loaded) {
      navigate('/analyze', { replace: true });
      return;
    }

    setReport(loaded);

    return () => {
      setupJobRef.current += 1;
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
    async (humanColor: PlayerColor, currentHistory: typeof history) => {
      const jobId = ++botJobRef.current;
      setIsBotThinking(true);
      try {
        await new Promise((resolve) => window.setTimeout(resolve, BOT_THINK_DELAY_MS));
        if (jobId !== botJobRef.current || !bot) return;

        const currentPosition = currentHistory[currentHistory.length - 1];
        const move: BotMoveResult | null = await chooseOpponentStyleMove(bot, currentPosition.fen);
        if (jobId !== botJobRef.current || !move) return;

        const game = new Chess(currentPosition.fen);
        let played;
        try {
          played = game.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion,
          });
        } catch (err) {
          console.error("Bot tried to play invalid move:", move, err);
          return;
        }

        if (!played) return;

        const nextHist = [
          ...currentHistory,
          {
            fen: game.fen(),
            lastMove: { from: played.from, to: played.to },
            san: played.san,
          },
        ];
        setHistory(nextHist);
        setHistoryIndex(nextHist.length - 1);

        setLastBotSource(
          move.source === 'book' && move.bookSupport
            ? `Book · ${move.bookSupport.count}/${move.bookSupport.total} games`
            : `Engine · ~${move.engineElo ?? bot.targetElo} Elo`
        );
        playFromMove({
          san: played.san,
          captured: Boolean(played.captured),
          isCheck: game.inCheck(),
          isCheckmate: game.isCheckmate(),
        });
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(12);
        }

        if (game.isGameOver()) {
          setStatus('ended');
          setResultText(describeResult(game, humanColor));
          setShowResultModal(true);
        }
      } finally {
        if (jobId === botJobRef.current) setIsBotThinking(false);
      }
    },
    [bot, describeResult, playFromMove]
  );

  const resetGame = useCallback((color: PlayerColor) => {
    botJobRef.current += 1;
    const fresh = new Chess();
    setPlayerColor(color);
    setBoardOrientation(color === 'w' ? 'white' : 'black');

    const initialHistory = [{ fen: fresh.fen(), lastMove: null, san: null }];
    setHistory(initialHistory);
    setHistoryIndex(0);

    setLastBotSource(null);
    setResultText(null);
    setShowResultModal(false);
    setStatus('playing');
    void stockfishService.newGame().catch(() => undefined);
  }, []);

  const startGame = useCallback(
    (color: PlayerColor) => {
      if (!bot) return;
      resetGame(color);
    },
    [bot, resetGame]
  );

  const prepareGame = useCallback(
    async (color: PlayerColor) => {
      if (!report || isPreparing) return;

      const jobId = ++setupJobRef.current;
      const opponentColor: PlayerColor = color === 'w' ? 'b' : 'w';
      setIsPreparing(true);
      setSetupError(null);
      setEngineError(null);
      setBot(null);
      setLoadingMessage(`Fetching ${report.username}'s full game history...`);

      const engineTask = stockfishService.init().then(
        () => ({ ready: true as const }),
        (error: unknown) => ({ ready: false as const, error })
      );
      const ratingsTask = fetchOpponentLiveProfile(report.platform, report.username)
        .then((profile) => profile.ratings)
        .catch((error: unknown) => {
          console.warn('Could not load live opponent ratings; using saved game ratings.', error);
          return null;
        });

      try {
        const [book, liveRatings, engine] = await Promise.all([
          fetchFullOpponentOpeningBook(
            report.platform,
            report.username,
            (gamesFetched, completedPages, totalPages) => {
              if (setupJobRef.current !== jobId) return;
              setLoadingMessage(
                totalPages
                  ? `Fetched ${gamesFetched} games (${completedPages}/${totalPages} archives)...`
                  : `Fetched ${gamesFetched} games; preparing ${opponentColor === 'w' ? 'White' : 'Black'} moves...`
              );
            },
            opponentColor
          ),
          ratingsTask,
          engineTask,
        ]);
        if (setupJobRef.current !== jobId) return;

        if (!engine.ready) {
          console.error('Stockfish failed to start:', engine.error);
          setEngineError('Stockfish could not start. Historical moves still work; other positions may use a fallback move.');
        }

        const games = Array.isArray(report.rawGameData)
          ? (report.rawGameData as ChessGame[])
          : [];
        setBot(
          createOpponentStyleBot(games, report.username, {
            report,
            book,
            liveRatings,
          })
        );
        resetGame(color);
      } catch (error) {
        console.error('Could not prepare full opponent repertoire:', error);
        if (setupJobRef.current === jobId) {
          setSetupError(
            error instanceof Error
              ? `Could not fetch the full game history: ${error.message}`
              : 'Could not fetch the full game history. Please try again later.'
          );
        }
      } finally {
        if (setupJobRef.current === jobId) setIsPreparing(false);
      }
    },
    [isPreparing, report, resetGame]
  );

  const handlePlayerMove = useCallback(
    (from: string, to: string): boolean => {
      if (status !== 'playing' || isBotThinking) return false;

      const currentPosition = history[historyIndex];
      const tempGame = new Chess(currentPosition.fen);
      
      // If bot is active, check if it's the player's turn. 
      // If bot is not active, let the player move any piece (for either side)!
      if (botActive && tempGame.turn() !== playerColor) return false;

      const piece = tempGame.get(from as Square);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));

      let played;
      try {
        played = tempGame.move({
          from,
          to,
          promotion: isPromotion ? 'q' : undefined,
        });
      } catch (err) {
        playIllegal();
        return false;
      }

      if (!played) {
        playIllegal();
        return false;
      }

      // Truncate history at historyIndex and append the new move
      const truncatedHistory = history.slice(0, historyIndex + 1);
      const nextHistory = [
        ...truncatedHistory,
        {
          fen: tempGame.fen(),
          lastMove: { from: played.from, to: played.to },
          san: played.san,
        },
      ];

      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);

      playFromMove({
        san: played.san,
        captured: Boolean(played.captured),
        isCheck: tempGame.inCheck(),
        isCheckmate: tempGame.isCheckmate(),
      });

      if (tempGame.isGameOver()) {
        setStatus('ended');
        setResultText(describeResult(tempGame, playerColor));
        setShowResultModal(true);
        return true;
      }

      if (botActive) {
        void applyBotMove(playerColor, nextHistory);
      }
      return true;
    },
    [
      status,
      isBotThinking,
      history,
      historyIndex,
      botActive,
      playerColor,
      playIllegal,
      playFromMove,
      applyBotMove,
      describeResult,
    ]
  );

  const currentPosition = history[historyIndex];
  const currentFen = currentPosition ? currentPosition.fen : new Chess().fen();
  const currentLastMove = currentPosition ? currentPosition.lastMove : null;

  const tempGame = useMemo(() => new Chess(currentFen), [currentFen]);
  const isPlayerTurn = tempGame.turn() === playerColor;
  const opponentColor: PlayerColor = playerColor === 'w' ? 'b' : 'w';
  const opponentBookFen = useMemo(() => {
    if (tempGame.turn() === opponentColor) return currentFen;

    if (historyIndex > 0) {
      const previousPosition = history[historyIndex - 1];
      if (previousPosition && new Chess(previousPosition.fen).turn() === opponentColor) {
        return previousPosition.fen;
      }
    }

    return null;
  }, [currentFen, history, historyIndex, opponentColor, tempGame]);
  const opponentBookMoves = useMemo(() => {
    if (!bot || !opponentBookFen) return [];
    return bot.book.positions.get(positionKeyFromFen(opponentBookFen)) || [];
  }, [bot, opponentBookFen]);
  const opponentBookTotal = opponentBookMoves.reduce((sum, move) => sum + move.count, 0);

  const boardEnabled = status === 'playing' && !isBotThinking && (!botActive || isPlayerTurn);

  const { boardOptions } = useChessboardInteraction({
    fen: currentFen,
    enabled: boardEnabled,
    lastMove: currentLastMove,
    onMove: handlePlayerMove,
  });

  const movePairs = useMemo(() => {
    const pairs: Array<{
      number: number;
      white?: { san: string; index: number };
      black?: { san: string; index: number };
    }> = [];
    
    // history[0] is start position, moves start at index 1
    for (let i = 1; i < history.length; i += 2) {
      pairs.push({
        number: Math.floor((i - 1) / 2) + 1,
        white: { san: history[i].san || '', index: i },
        black: history[i + 1] ? { san: history[i + 1].san || '', index: i + 1 } : undefined,
      });
    }
    return pairs;
  }, [history]);

  // Trigger bot move automatically if it's the bot's turn, bot active is enabled, and we are at the latest move
  useEffect(() => {
    if (status === 'playing' && botActive && !isBotThinking && historyIndex === history.length - 1) {
      const currentPosition = history[historyIndex];
      if (currentPosition) {
        const game = new Chess(currentPosition.fen);
        if (game.turn() !== playerColor && !game.isGameOver()) {
          void applyBotMove(playerColor, history);
        }
      }
    }
  }, [botActive, history, historyIndex, playerColor, status, isBotThinking, applyBotMove]);

  const goToMove = (index: number) => {
    if (isBotThinking) return;
    const clamped = Math.max(0, Math.min(history.length - 1, index));
    setHistoryIndex(clamped);
  };

  const stepBack = () => goToMove(historyIndex - 1);
  const stepForward = () => goToMove(historyIndex + 1);

  useEffect(() => {
    if (status !== 'playing' && status !== 'ended') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isBotThinking) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setHistoryIndex((index) => Math.max(0, index - 1));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setHistoryIndex((index) => Math.min(history.length - 1, index + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history.length, isBotThinking, status]);

  const getGameOutcome = useCallback((outcomeText: string | null) => {
    if (!outcomeText) return { type: 'draw', title: 'Game Over', subtitle: '' };
    
    const text = outcomeText.toLowerCase();
    if (text.includes('you win')) {
      return {
        type: 'win',
        title: 'Victory!',
        subtitle: outcomeText,
      };
    } else if (text.includes('opponent wins') || text.includes('wins')) {
      return {
        type: 'loss',
        title: 'Defeat',
        subtitle: outcomeText,
      };
    } else {
      return {
        type: 'draw',
        title: 'Draw',
        subtitle: outcomeText,
      };
    }
  }, []);

  if (!report) {
    return (
      <div className="section-shell flex min-h-[50vh] flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">
          Loading opponent dossier…
        </p>
      </div>
    );
  }

  return (
    <div
      className={`section-shell ${
        status === 'setup'
          ? 'space-y-8 py-8'
          : 'space-y-3 py-0 lg:flex lg:h-[calc(100dvh-8rem)] lg:flex-col lg:gap-10 lg:overflow-hidden lg:space-y-0'
      }`}
    >
      <section className={`aurora-panel ${status === 'setup' ? '' : 'lg:shrink-0'}`}>
        <button
          type="button"
          onClick={() => navigate('/analyze')}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dossiers
        </button>
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300 ${status === 'setup' ? 'mt-4' : 'mt-1'}`}>
          Practice
        </p>
        <h1 className={`font-display font-semibold tracking-tight text-slate-900 dark:text-white ${status === 'setup' ? 'mt-2 text-3xl' : 'mt-0.5 text-2xl'}`}>
          vs {report.username}
        </h1>
        <p className={`max-w-2xl text-slate-600 dark:text-slate-400 ${status === 'setup' ? 'mt-2 text-sm leading-6' : 'mt-1 line-clamp-1 text-xs leading-4'}`}>
          {bot
            ? `Opponent moves indexed from ${bot.book.gamesUsed} of ${bot.book.gamesScanned ?? bot.book.gamesUsed} games as ${opponentColor === 'w' ? 'White' : 'Black'} (${bot.book.movesIndexed} moves). Stockfish fills positions with no history.`
            : 'Choose your color first. We’ll fetch the complete game history for the side the bot will play.'}
          {bot &&
            ` Out of book, the engine aims for about ${bot.targetElo} Elo${
              bot.ratingSource === 'live'
                ? ' (their live rating)'
                : bot.ratingSource === 'games'
                  ? ' (from recent games)'
                  : bot.ratingSource === 'report'
                    ? ' (from the report estimate)'
                    : ''
            }${bot.targetElo < 1320 ? ' — Stockfish’s floor is 1320, so we add extra weaker moves to match lower ratings.' : ''}.`}
        </p>
        {engineError && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{engineError}</p>
        )}
      </section>

      {status === 'setup' ? (
        <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-primary-100 bg-gradient-to-br from-white via-primary-50/60 to-white p-6 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-8">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
              Set up your match
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-900 dark:text-white">
              Which side would you like to play?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              We’ll fetch {report.username}’s games now and make the bot follow their moves for the opposite color.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={isPreparing}
              onClick={() => void prepareGame('w')}
              className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-primary-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-primary-500"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-2xl text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white" aria-hidden="true">♙</span>
              <span>
                <span className="block font-display text-lg font-semibold text-slate-900 dark:text-white">Play as White</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                  Bot plays Black, using {report.username}’s Black games
                </span>
              </span>
            </button>
            <button
              type="button"
              disabled={isPreparing}
              onClick={() => void prepareGame('b')}
              className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-primary-200 bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-primary-500"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-2xl text-white dark:border-slate-500 dark:bg-slate-700" aria-hidden="true">♟</span>
              <span>
                <span className="block font-display text-lg font-semibold text-slate-900 dark:text-white">Play as Black</span>
                <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                  Bot plays White, using {report.username}’s White games
                </span>
              </span>
            </button>
          </div>
          {isPreparing && (
            <p role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-primary-700 dark:text-primary-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingMessage}
            </p>
          )}
          {setupError && (
            <p role="alert" className="text-center text-sm text-rose-700 dark:text-rose-300">
              {setupError}
            </p>
          )}
        </section>
      ) : (
        <section className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_25rem] lg:items-stretch">
          <div className="flex min-h-0 flex-col mt- gap-3 lg:mt-0">
            <div className="relative mx-auto flex min-h-0 w-full flex-1 items-center justify-center">
              <div
                className="relative aspect-square max-w-full"
                style={{ width: 'min(100%, calc(100dvh - 17rem))' }}
              >
                <div className="review-chessboard h-full w-full overflow-hidden rounded-sm border border-[#8b5a2b]/70 shadow-elevated">
                  <Chessboard
                    options={{
                      ...boardOptions,
                      boardOrientation: boardOrientation,
                    }}
                  />
                </div>
                {isBotThinking && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                    <span className="animate-pulse rounded-lg bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/95 dark:text-slate-200">
                      {report.username} is thinking…
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Controls */}
           

           <div className=" mt-5 flex shrink-0 items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => goToMove(0)}
                disabled={historyIndex === 0 || isBotThinking}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Start"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={stepBack}
                disabled={historyIndex === 0 || isBotThinking}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Previous move (left arrow key)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'))}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Flip board"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={stepForward}
                disabled={historyIndex === history.length - 1 || isBotThinking}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="Next move (right arrow key)"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToMove(history.length - 1)}
                disabled={historyIndex === history.length - 1 || isBotThinking}
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-primary-200 text-slate-700 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                aria-label="End"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>

          <aside className="flex min-h-0 flex-col gap-3 lg:min-h-0">
            <div className="shrink-0">
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

            <div className="grid shrink-0 grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Practice details">
              <button
                type="button"
                role="tab"
                aria-controls="practice-move-stats"
                aria-selected={rightPanelTab === 'stats'}
                onClick={() => setRightPanelTab('stats')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  rightPanelTab === 'stats'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Move stats
              </button>
              <button
                type="button"
                role="tab"
                aria-controls="practice-play-tree"
                aria-selected={rightPanelTab === 'tree'}
                onClick={() => setRightPanelTab('tree')}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  rightPanelTab === 'tree'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Play tree
              </button>
            </div>

            {rightPanelTab === 'stats' ? (
              <div id="practice-move-stats" role="tabpanel" className="min-h-[12rem] flex-1 overflow-y-auto rounded-xl border border-primary-100 bg-primary-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 lg:min-h-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {report.username}’s {opponentColor === 'w' ? 'White' : 'Black'} moves here
                </h3>
                {opponentBookFen ? (
                  opponentBookMoves.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {opponentBookTotal} recorded move sample{opponentBookTotal === 1 ? '' : 's'}
                      </p>
                      {opponentBookMoves.map((move) => {
                        const percentage = Math.round((move.count / opponentBookTotal) * 100);
                        return (
                          <div key={move.san}>
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="font-semibold text-slate-900 dark:text-white">{move.san}</span>
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {move.count} game{move.count === 1 ? '' : 's'} · {percentage}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-primary-600 dark:bg-emerald-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                      No recorded move from this position. Stockfish will choose the opponent’s reply.
                    </p>
                  )
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    Make a move to see the opponent’s recorded replies.
                  </p>
                )}
              </div>
            ) : (
              <div id="practice-play-tree" role="tabpanel" className="min-h-[12rem] flex-1 overflow-y-auto rounded-xl border border-primary-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40 lg:min-h-0">
                <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Play tree</h3>
                {movePairs.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No moves yet.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {movePairs.map((pair) => (
                      <div key={pair.number} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2 py-0.5 text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400">{pair.number}.</span>
                        {pair.white ? (
                          <button
                            type="button"
                            onClick={() => goToMove(pair.white!.index)}
                            className={`cursor-pointer rounded px-1.5 py-0.5 text-left font-medium transition-colors ${
                              historyIndex === pair.white.index
                                ? 'bg-primary-100 text-primary-900 dark:bg-primary-950/70 dark:text-primary-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {pair.white.san}
                          </button>
                        ) : <span />}
                        {pair.black ? (
                          <button
                            type="button"
                            onClick={() => goToMove(pair.black!.index)}
                            className={`cursor-pointer rounded px-1.5 py-0.5 text-left font-medium transition-colors ${
                              historyIndex === pair.black.index
                                ? 'bg-primary-100 text-primary-900 dark:bg-primary-950/70 dark:text-primary-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {pair.black.san}
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex shrink-0 flex-wrap gap-2">
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
                  setBot(null);
                  setIsBotThinking(false);
                  setSetupError(null);
                }}
                className="cursor-pointer"
              >
                Change color
              </Button>
            </div>

            {/* Bot active toggle */}
            <div className="shrink-0 rounded-xl border border-primary-100 bg-primary-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bot Responses</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {botActive ? 'Opponent plays automatically' : 'Self analysis mode'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBotActive(!botActive)}
                  disabled={isBotThinking}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    botActive ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                  aria-pressed={botActive}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      botActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

          </aside>
        </section>
      )}

      {/* End of game outcome modal */}
      {showResultModal && resultText && (() => {
        const outcome = getGameOutcome(resultText);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm practice-overlay-animate p-4">
            <div className="relative w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 transition-all duration-350 practice-content-animate">
              
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Icon Container */}
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full mb-4">
                {outcome.type === 'win' ? (
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 animate-bounce-subtle">
                    {/* Gold Trophy */}
                    <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 5h-2V3H7v2H5C3.9 5 3 5.9 3 7v1c0 2.55 1.92 4.63 4.39 4.94A5.998 5.998 0 0011 17.9v4h-4v2h10v-2h-4v-4c2.2-.42 3.96-2.02 4.61-4.06C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
                    </svg>
                  </div>
                ) : outcome.type === 'loss' ? (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500">
                    {/* Defeat Icon */}
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {/* Handshake for Draw */}
                    <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                )}
              </div>

              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {outcome.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {outcome.subtitle}
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    startGame(playerColor);
                    setShowResultModal(false);
                  }}
                  className="w-full justify-center py-2.5 font-semibold shadow-sm hover:shadow transition"
                >
                  Rematch
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    botJobRef.current += 1;
                    setStatus('setup');
                    setBot(null);
                    setIsBotThinking(false);
                    setShowResultModal(false);
                    setSetupError(null);
                  }}
                  className="w-full justify-center py-2.5"
                >
                  Change Color
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResultModal(false)}
                  className="w-full justify-center py-2.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                >
                  Review Board / Analyze
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default OpponentPracticePage;
