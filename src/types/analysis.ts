export interface MoveAnalysis {
  moveNumber: number;
  move: string;
  fen: string;
  evaluation: number; // Centipawn evaluation
  bestMove?: string;
  classification: 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
  centipawnLoss: number;
  comment?: string;
}

export interface GameAnalysis {
  gameId: string;
  moves: MoveAnalysis[];
  whiteAccuracy: number;
  blackAccuracy: number;
  totalMistakes: {
    white: {
      blunders: number;
      mistakes: number;
      inaccuracies: number;
    };
    black: {
      blunders: number;
      mistakes: number;
      inaccuracies: number;
    };
  };
  openingEvaluation: {
    name: string;
    eco: string;
    evaluation: number;
  };
  criticalMoments: {
    moveNumber: number;
    description: string;
    beforeEval: number;
    afterEval: number;
  }[];
  analyzedAt: Date;
  engineUsed: 'stockfish' | 'leela' | 'komodo';
  depth: number;
}

export interface AnalysisRequest {
  gameId: string;
  pgn: string;
  engine: 'stockfish' | 'leela' | 'komodo';
  depth: number;
}

export interface AnalysisProgress {
  gameId: string;
  progress: number; // 0-100
  currentMove: number;
  totalMoves: number;
  status: 'analyzing' | 'completed' | 'error';
  message?: string;
}