import { ChessGame } from '../types/game';
import { buildOpponentOpeningBook } from './opponentOpeningBook';

const game: ChessGame = {
  id: 'one',
  pgn: '1. e4 e5 2. Nf3 Nc6',
  white: { name: 'Rival' },
  black: { name: 'Other' },
  result: '*',
  timeControl: '',
  opening: { name: '' },
  date: '',
  site: 'chess.com',
  moves: [],
};

const blackGame: ChessGame = {
  ...game,
  id: 'two',
  white: { name: 'Other' },
  black: { name: 'Rival' },
};

describe('opponent opening book metadata', () => {
  it('marks full archive repertoires and records how many games were scanned', () => {
    const book = buildOpponentOpeningBook([game], 'Rival', {
      source: 'full-archive',
    });

    expect(book.source).toBe('full-archive');
    expect(book.gamesScanned).toBe(1);
    expect(book.gamesUsed).toBe(1);
  });

  it('indexes only the opponent color selected for practice', () => {
    const book = buildOpponentOpeningBook([game, blackGame], 'Rival', {
      source: 'full-archive',
      opponentColor: 'b',
    });

    expect(book.gamesScanned).toBe(2);
    expect(book.gamesUsed).toBe(1);
    expect(
      book.positions.has('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')
    ).toBe(false);
    expect(
      book.positions.get('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -')
    ).toEqual([{ san: 'e5', count: 1 }]);
  });
});
