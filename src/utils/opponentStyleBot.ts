import { Chess } from 'chess.js';
import { ChessGame } from '../types/game';
import { ChessReport } from '../types/report';
import { stockfishService } from '../services/stockfishService';
import {
  OpponentOpeningBook,
  buildOpponentOpeningBook,
  pickBookMove,
} from './opponentOpeningBook';
import { resolveOpponentPracticeRating } from './opponentRating';

export type BotMoveSource = 'book' | 'engine';

export type BotMoveResult = {
  from: string;
  to: string;
  promotion?: string;
  san: string;
  source: BotMoveSource;
  bookSupport?: { count: number; total: number };
  engineElo?: number;
};

export type OpponentStyleBot = {
  book: OpponentOpeningBook;
  opponentUsername: string;
  /** Target Stockfish UCI_Elo for out-of-book play. */
  targetElo: number;
  ratingSource: 'live' | 'games' | 'report' | 'default';
};

export function createOpponentStyleBot(
  games: ChessGame[],
  opponentUsername: string,
  options?: {
    report?: ChessReport | null;
    liveRatings?: {
      rapid: number | null;
      blitz: number | null;
      bullet: number | null;
    } | null;
  }
): OpponentStyleBot {
  const rating = resolveOpponentPracticeRating({
    username: opponentUsername,
    games,
    report: options?.report,
    liveRatings: options?.liveRatings,
  });

  return {
    book: buildOpponentOpeningBook(games, opponentUsername),
    opponentUsername,
    targetElo: rating.elo,
    ratingSource: rating.source,
  };
}

function applyUci(
  chess: Chess,
  uci: string,
  meta?: { source: BotMoveSource; engineElo?: number }
): BotMoveResult | null {
  if (!uci || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  const played = chess.move({ from, to, promotion });
  if (!played) return null;
  return {
    from: played.from,
    to: played.to,
    promotion: played.promotion,
    san: played.san,
    source: meta?.source || 'engine',
    engineElo: meta?.engineElo,
  };
}

/**
 * Choose the next move for the opponent-style bot.
 * Prefers their historical repertoire; falls back to Stockfish limited to their rating.
 */
export async function chooseOpponentStyleMove(
  bot: OpponentStyleBot,
  fen: string
): Promise<BotMoveResult | null> {
  const probe = new Chess(fen);

  if (probe.isGameOver()) return null;

  const bookPick = pickBookMove(bot.book, fen, { minSamples: 2, temperature: 0.9 });
  if (bookPick) {
    const played = probe.move(bookPick.san);
    if (played) {
      return {
        from: played.from,
        to: played.to,
        promotion: played.promotion,
        san: played.san,
        source: 'book',
        bookSupport: { count: bookPick.count, total: bookPick.total },
      };
    }
  }

  try {
    const { bestMoveUci, elo } = await stockfishService.getBestMoveAtElo(
      fen,
      bot.targetElo,
      800
    );
    if (!bestMoveUci) return null;
    // Always report the opponent's real target rating (may be below Stockfish's 1320 floor).
    return applyUci(new Chess(fen), bestMoveUci, { source: 'engine', engineElo: elo });
  } catch (error) {
    console.error('Opponent style bot engine move failed:', error);
    const legal = probe.moves({ verbose: true });
    if (!legal.length) return null;
    const random = legal[Math.floor(Math.random() * legal.length)];
    return {
      from: random.from,
      to: random.to,
      promotion: random.promotion,
      san: random.san,
      source: 'engine',
      engineElo: bot.targetElo,
    };
  }
}
