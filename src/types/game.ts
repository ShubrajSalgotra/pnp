export interface ChessGame {
  id: string;
  pgn: string;
  white: {
    name: string;
    rating?: number;
  };
  black: {
    name: string;
    rating?: number;
  };
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  timeControl: string;
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
}

export interface ImportGameRequest {
  platform: 'lichess' | 'chess.com';
  username: string;
  count?: number;
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