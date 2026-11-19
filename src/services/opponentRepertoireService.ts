import { gameImportService } from './gameImport';
import {
  buildOpponentOpeningBook,
  type ChessColor,
  type OpponentOpeningBook,
} from '../utils/opponentOpeningBook';

export async function fetchFullOpponentOpeningBook(
  platform: 'lichess' | 'chess.com',
  username: string,
  onProgress?: (gamesFetched: number, completedPages?: number, totalPages?: number) => void,
  opponentColor?: ChessColor
): Promise<OpponentOpeningBook> {
  const { games } = await gameImportService.importGames({
    platform,
    username,
    allGames: true,
    onProgress,
  });

  if (!games.length) {
    throw new Error(`No games were found for ${username}.`);
  }

  return buildOpponentOpeningBook(games, username, {
    source: 'full-archive',
    opponentColor,
  });
}
