export interface ChessGame {
  id: string;
  pgn: string;
  white: {
    name: string;
    rating?: number;
    result?: string;
  };
  black: {
    name: string;
    rating?: number;
    result?: string;
  };
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  timeControl: string;
  timeClass?: string;
  opening: {
    name: string;
    eco?: string;
  };
  date: string;
  site: 'lichess' | 'chess.com';
  url?: string;
  moves: string[];
  analyzed?: boolean;
  accuracy?: {
    white: number;
    black: number;
  };
  mistakes?: {
    blunders: number;
    mistakes: number;
    inaccuracies: number;
  };
  termination?: string;
}

export interface ImportGameRequest {
  platform: 'lichess' | 'chess.com';
  username: string;
  /** Number of recent games to import. Ignored when `allGames` is true. */
  count?: number;
  /** When true, fetch the player's full game history from the platform API. */
  allGames?: boolean;
  rated?: boolean;
  variant?: string;
}

export interface ImportGameResponse {
  games: ChessGame[];
  totalGames: number;
  hasMore: boolean;
  nextCursor?: string;
}

export class GameImportError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_USERNAME' | 'RATE_LIMIT' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'INVALID_REQUEST' | 'TIMEOUT',
    public details?: any
  ) {
    super(message);
    this.name = 'GameImportError';
  }
}