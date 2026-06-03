import { GameAnalysis, AnalysisRequest, AnalysisProgress, MoveAnalysis } from '../types/analysis';

class AnalysisEngineService {
  private analysisQueue: Map<string, AnalysisProgress> = new Map();

  // Mock chess position evaluation
  private mockEvaluatePosition(fen: string, moveNumber: number): number {
    // Simple mock evaluation based on move number and some randomness
    // In real implementation, this would call Stockfish
    const baseEval = Math.sin(moveNumber * 0.1) * 100;
    const randomFactor = (Math.random() - 0.5) * 50;
    return Math.round(baseEval + randomFactor);
  }

  // Mock move classification
  private classifyMove(centipawnLoss: number): MoveAnalysis['classification'] {
    if (centipawnLoss <= 10) return 'excellent';
    if (centipawnLoss <= 25) return 'good';
    if (centipawnLoss <= 60) return 'inaccuracy';
    if (centipawnLoss <= 150) return 'mistake';
    return 'blunder';
  }

  // Mock best move generation
  private generateBestMove(fen: string): string {
    const moves = ['Nf3', 'e4', 'Bc4', 'O-O', 'Qh5', 'Bxf7+'];
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Parse PGN to extract moves
  private parsePGN(pgn: string): string[] {
    const moveRegex = /\d+\.\s*([a-h]?[1-8]?[NBRQK]?[a-h]?[1-8]?[-x]?[a-h][1-8](?:=[NBRQK])?[+#]?)\s*([a-h]?[1-8]?[NBRQK]?[a-h]?[1-8]?[-x]?[a-h][1-8](?:=[NBRQK])?[+#]?)?/g;
    const moves: string[] = [];
    let match;
    
    while ((match = moveRegex.exec(pgn)) !== null) {
      if (match[1]) moves.push(match[1]);
      if (match[2]) moves.push(match[2]);
    }
    
    return moves;
  }

  // Main analysis function - uses mock analysis
  async analyzeGame(request: AnalysisRequest): Promise<GameAnalysis> {
    return await this.mockAnalyzeGame(request);
  }

  // Mock analysis function (fallback)
  private async mockAnalyzeGame(request: AnalysisRequest): Promise<GameAnalysis> {
    const { gameId, pgn, engine, depth } = request;
    
    // Initialize progress
    this.analysisQueue.set(gameId, {
      gameId,
      progress: 0,
      currentMove: 0,
      totalMoves: 0,
      status: 'analyzing'
    });

    const moves = this.parsePGN(pgn);
    const totalMoves = moves.length;

    // Update progress
    this.analysisQueue.set(gameId, {
      gameId,
      progress: 0,
      currentMove: 0,
      totalMoves,
      status: 'analyzing'
    });

    const moveAnalyses: MoveAnalysis[] = [];
    let whiteMistakes = { blunders: 0, mistakes: 0, inaccuracies: 0 };
    let blackMistakes = { blunders: 0, mistakes: 0, inaccuracies: 0 };
    let whiteAccuracySum = 0;
    let blackAccuracySum = 0;
    let whiteMoves = 0;
    let blackMoves = 0;

    // Analyze each move
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isWhiteMove = i % 2 === 0;
      
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 100));

      const evaluation = this.mockEvaluatePosition('mock-fen', i + 1);
      const prevEvaluation = i > 0 ? moveAnalyses[i - 1].evaluation : 0;
      
      // Calculate centipawn loss
      let centipawnLoss = 0;
      if (isWhiteMove) {
        centipawnLoss = Math.max(0, prevEvaluation - evaluation);
      } else {
        centipawnLoss = Math.max(0, evaluation - prevEvaluation);
      }

      const classification = this.classifyMove(centipawnLoss);
      const bestMove = this.generateBestMove('mock-fen');

      const moveAnalysis: MoveAnalysis = {
        moveNumber: Math.floor(i / 2) + 1,
        move,
        fen: `mock-fen-${i}`,
        evaluation,
        bestMove: classification !== 'excellent' ? bestMove : undefined,
        classification,
        centipawnLoss,
        comment: this.generateComment(classification, centipawnLoss)
      };

      moveAnalyses.push(moveAnalysis);

      // Update mistake counters
      if (isWhiteMove) {
        whiteMoves++;
        whiteAccuracySum += Math.max(0, 100 - centipawnLoss);
        if (classification === 'blunder') whiteMistakes.blunders++;
        else if (classification === 'mistake') whiteMistakes.mistakes++;
        else if (classification === 'inaccuracy') whiteMistakes.inaccuracies++;
      } else {
        blackMoves++;
        blackAccuracySum += Math.max(0, 100 - centipawnLoss);
        if (classification === 'blunder') blackMistakes.blunders++;
        else if (classification === 'mistake') blackMistakes.mistakes++;
        else if (classification === 'inaccuracy') blackMistakes.inaccuracies++;
      }

      // Update progress
      this.analysisQueue.set(gameId, {
        gameId,
        progress: Math.round(((i + 1) / totalMoves) * 100),
        currentMove: i + 1,
        totalMoves,
        status: 'analyzing'
      });
    }

    // Calculate final analysis
    const whiteAccuracy = whiteMoves > 0 ? Math.round(whiteAccuracySum / whiteMoves) : 0;
    const blackAccuracy = blackMoves > 0 ? Math.round(blackAccuracySum / blackMoves) : 0;

    const analysis: GameAnalysis = {
      gameId,
      moves: moveAnalyses,
      whiteAccuracy,
      blackAccuracy,
      totalMistakes: {
        white: whiteMistakes,
        black: blackMistakes
      },
      openingEvaluation: {
        name: 'Sicilian Defense',
        eco: 'B20',
        evaluation: moveAnalyses[0]?.evaluation || 0
      },
      criticalMoments: this.findCriticalMoments(moveAnalyses),
      analyzedAt: new Date(),
      engineUsed: engine,
      depth
    };

    // Mark as completed
    this.analysisQueue.set(gameId, {
      gameId,
      progress: 100,
      currentMove: totalMoves,
      totalMoves,
      status: 'completed'
    });

    return analysis;
  }

  private generateComment(classification: MoveAnalysis['classification'], centipawnLoss: number): string {
    switch (classification) {
      case 'excellent':
        return 'Excellent move! This is the best or one of the best moves in the position.';
      case 'good':
        return 'Good move. This move is solid and doesn\'t lose material or position.';
      case 'inaccuracy':
        return `Inaccuracy. This move loses about ${centipawnLoss} centipawns. Consider alternatives.`;
      case 'mistake':
        return `Mistake! This move loses ${centipawnLoss} centipawns. Look for better options.`;
      case 'blunder':
        return `Blunder! This move loses ${centipawnLoss} centipawns. This significantly damages your position.`;
      default:
        return 'Move analyzed.';
    }
  }

  private findCriticalMoments(moves: MoveAnalysis[]): GameAnalysis['criticalMoments'] {
    const criticalMoments: GameAnalysis['criticalMoments'] = [];
    
    for (let i = 1; i < moves.length; i++) {
      const move = moves[i];
      const prevMove = moves[i - 1];
      
      // Look for large evaluation swings
      if (Math.abs(move.evaluation - prevMove.evaluation) > 200) {
        criticalMoments.push({
          moveNumber: move.moveNumber,
          description: `Critical moment: ${move.classification} move ${move.move}`,
          beforeEval: prevMove.evaluation,
          afterEval: move.evaluation
        });
      }
    }
    
    return criticalMoments.slice(0, 5); // Return top 5 critical moments
  }

  getAnalysisProgress(gameId: string): AnalysisProgress | null {
    return this.analysisQueue.get(gameId) || null;
  }

  clearAnalysisProgress(gameId: string): void {
    this.analysisQueue.delete(gameId);
  }
}

export const analysisEngineService = new AnalysisEngineService();