import { ChessGame } from './game';
import { ChessReport } from './report';

export interface PlayerAnalysisProfile {
  userId: string;
  platform: 'lichess' | 'chess.com';
  username: string;
  gameLimit: number;
  rated?: boolean;
  games: ChessGame[];
  analyzedGameIds: string[];
  report: ChessReport | null;
  lastCheckedAt: string | null;
  lastAnalyzedAt: string | null;
}

export interface ProfileRefreshResult {
  profile: PlayerAnalysisProfile;
  newGamesCount: number;
  reusedCache: boolean;
}
