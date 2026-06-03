export interface GameReportRequest {
  platform: 'lichess' | 'chess.com';
  username: string;
  gameCount: number;
  rated?: boolean;
}

export interface ExecutiveSummary {
  totalGames: number;
  winRate: number;
  averageAccuracy: number;
  favoriteOpenings: string[];
  timeControlPreference: string;
  overallRating: number;
  strengthAreas: string[];
  keyInsights: string[];
}

export interface RecurringWeakness {
  title: string;
  description: string;
  frequency: number;
  examples: {
    gameId: string;
    moveNumber: number;
    position: string;
    mistake: string;
    betterMove: string;
    fenPosition?: string; // FEN position before the mistake
    lastMove?: string; // The actual move played (the mistake)
    fromSquare?: string; // From square of the move
    toSquare?: string; // To square of the move
    playerColor?: 'white' | 'black'; // Color the user played
    whitePlayer?: string; // Name of white player
    blackPlayer?: string; // Name of black player
  }[];
  improvementSuggestion: string;
  technicalImprovement?: string; // Optional for backward compatibility
}

export interface MiddleGameAnalysis {
  overallRating: number;
  strengths: string[];
  weaknesses: string[];
  patterns: {
    positionalUnderstanding: number;
    tacticalAwareness: number;
    planFormation: number;
    pieceCoordination: number;
  };
  recommendations: string[];
  examplePositions: {
    gameId: string;
    position: string;
    analysis: string;
    suggestion: string;
  }[];
}

export interface EndgameAnalysis {
  overallRating: number;
  strengths: string[];
  weaknesses: string[];
  commonMistakes: string[];
  endgameTypes: {
    type: string;
    performance: number;
    gamesPlayed: number;
    successRate: number;
  }[];
  recommendations: string[];
  studyMaterial: string[];
  examplePositions: {
    gameId: string;
    endgameType: string;
    position: string;
    analysis: string;
    correctPlay: string;
  }[];
}

export interface ActionableImprovementPlan {
  immediateActions: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    description: string;
    timeframe: string;
  }[];
  weeklyFocus: {
    week: number;
    focus: string;
    exercises: string[];
    goals: string[];
  }[];
  monthlyGoals: {
    month: number;
    goal: string;
    milestones: string[];
    trackingMethod: string;
  }[];
  resources: {
    recommendedVideo: {
      title: string;
      channel: string;
      url: string;
      description: string;
      relevantWeakness: string;
      duration?: string;
    };
    exercises: string[];
    masterGame: {
      players: string;
      event: string;
      description: string;
      relevantConcept: string;
      keyMoves: string;
    };
  };
}

export interface ChessReport {
  id: string;
  userId: string;
  username: string;
  platform: 'lichess' | 'chess.com';
  gameCount: number;
  generatedAt: Date;
  executiveSummary: ExecutiveSummary;
  recurringWeaknesses: RecurringWeakness[];
  middleGameAnalysis: MiddleGameAnalysis;
  endgameAnalysis: EndgameAnalysis;
  improvementPlan: ActionableImprovementPlan;
  rawGameData: any[]; // Store game data for reference
}

export interface ReportGenerationProgress {
  stage: 'fetching' | 'analyzing' | 'generating' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  error?: string;
}

export class ReportGenerationError extends Error {
  constructor(
    message: string,
    public code: 'FETCH_ERROR' | 'ANALYSIS_ERROR' | 'AI_ERROR' | 'INVALID_INPUT' | 'RATE_LIMIT',
    public details?: any
  ) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}