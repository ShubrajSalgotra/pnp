import { GoogleGenerativeAI } from '@google/generative-ai';
import { Chess } from 'chess.js';
import { ChessGame } from '../types/game';
import { 
  ExecutiveSummary, 
  RecurringWeakness, 
  MiddleGameAnalysis, 
  EndgameAnalysis, 
  ActionableImprovementPlan,
  ReportGenerationError 
} from '../types/report';
import { videoRecommendationService } from './videoRecommendationService';

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelNames: string[];

  constructor() {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not found in environment variables');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);

    const configuredModel = process.env.REACT_APP_GEMINI_MODEL?.trim();
    this.modelNames = Array.from(new Set([
      configuredModel || 'gemini-2.5-flash',
      'gemini-flash-lite-latest',
      'gemini-pro-latest'
    ].filter(Boolean)));

    this.model = this.createModel(this.modelNames[0]);
  }

  private createModel(modelName: string): any {
    return this.genAI.getGenerativeModel({ model: modelName });
  }

  private async generateWithPrompt(prompt: string, maxRetries: number = 5): Promise<string> {
    let lastError: any;

    for (let modelIndex = 0; modelIndex < this.modelNames.length; modelIndex++) {
      const modelName = this.modelNames[modelIndex];
      this.model = this.createModel(modelName);

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.model.generateContent(prompt);
          const response = await result.response;
          return response.text();
        } catch (error: any) {
          lastError = error;

          // Check if this is a rate limit or overload error
          const isRateLimitError = this.isRateLimitError(error);
          const isRetryableError = isRateLimitError || this.isRetryableError(error);
          const hasFallbackModel = modelIndex < this.modelNames.length - 1;

          console.error(`Gemini API Error with ${modelName} (attempt ${attempt}/${maxRetries}):`, error);

          if (hasFallbackModel && this.shouldTryFallbackModel(error)) {
            console.warn(`Gemini model ${modelName} is unavailable or quota-limited. Trying ${this.modelNames[modelIndex + 1]}...`);
            break;
          }

          // If this is the last attempt or not a retryable error, throw immediately
          if (attempt === maxRetries || !isRetryableError) {
            throw this.createGeminiError(lastError);
          }

          // Calculate delay with exponential backoff
          const baseDelay = isRateLimitError ? 3000 : 1000; // Longer delay for rate limits
          const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
          const delay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds

          console.log(`API temporarily unavailable. Retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
    }

    throw this.createGeminiError(lastError);
  }

  private shouldTryFallbackModel(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    return error.status === 404 ||
      error.status === 429 ||
      errorMessage.includes('no longer available') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('limit: 0');
  }

  private createGeminiError(error: any): ReportGenerationError {
    const errorMessage = error?.message?.toLowerCase() || '';

    if (error?.status === 429 || errorMessage.includes('quota exceeded')) {
      return new ReportGenerationError(
        'Gemini quota exceeded for the configured model. Please use an API key/project with available Gemini quota, enable billing, or set REACT_APP_GEMINI_MODEL to a model with available quota.',
        'RATE_LIMIT',
        error
      );
    }

    if (error?.status === 404 || errorMessage.includes('no longer available') || errorMessage.includes('not found')) {
      return new ReportGenerationError(
        'The configured Gemini model is not available for this API key. Set REACT_APP_GEMINI_MODEL to an available model such as gemini-2.5-flash.',
        'AI_ERROR',
        error
      );
    }

    if (error?.status === 400 && errorMessage.includes('api key')) {
      return new ReportGenerationError(
        'Gemini rejected the API key. Please check REACT_APP_GEMINI_API_KEY in your environment settings.',
        'AI_ERROR',
        error
      );
    }

    if (errorMessage.includes('fetch failed') || errorMessage.includes('network')) {
      return new ReportGenerationError(
        'Could not reach Gemini API. Please check your internet connection and try again.',
        'AI_ERROR',
        error
      );
    }

    return new ReportGenerationError(
      'Failed to generate content with Gemini API',
      'AI_ERROR',
      error
    );
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    
    // Check for 503 Service Unavailable (model overloaded)
    if (error.status === 503) return true;
    
    // Check for 429 Too Many Requests
    if (error.status === 429) return true;
    
    // Check error message for overload indicators
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('overloaded') || 
           errorMessage.includes('rate limit') || 
           errorMessage.includes('quota exceeded') ||
           errorMessage.includes('too many requests');
  }

  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    // Rate limit errors are retryable
    if (this.isRateLimitError(error)) return true;
    
    // 500-level server errors (except 501, 505) are generally retryable
    if (error.status >= 500 && error.status < 600 && error.status !== 501 && error.status !== 505) {
      return true;
    }
    
    // Network errors are retryable
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('network') || 
           errorMessage.includes('timeout') || 
           errorMessage.includes('connection');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private validateAndFixMoveRecommendation(example: any, fen: string): void {
    try {
      const chess = new Chess(fen);
      const legalMoves = chess.moves();
      
      // Extract the move from the betterMove recommendation with more comprehensive parsing
      const betterMoveText = example.betterMove || '';
      
      // Try different patterns to extract the move
      let suggestedMove = '';
      
      // Pattern 1: Standard algebraic notation at the beginning
      let moveMatch = betterMoveText.match(/^([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\=[NBRQ])?[\+\#]?)/);
      if (moveMatch) {
        suggestedMove = moveMatch[1];
      } else {
        // Pattern 2: Move after numbers (e.g., "15...Nd7!" or "20.Rb1!")
        moveMatch = betterMoveText.match(/\d+\.+\s*([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\=[NBRQ])?[\+\#]?)/);
        if (moveMatch) {
          suggestedMove = moveMatch[1];
        } else {
          // Pattern 3: Move in quotes or parentheses
          moveMatch = betterMoveText.match(/["']([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\=[NBRQ])?[\+\#]?)["']/) ||
                      betterMoveText.match(/\(([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:\=[NBRQ])?[\+\#]?)\)/);
          if (moveMatch) {
            suggestedMove = moveMatch[1];
          }
        }
      }
      
      console.log(`Validating recommendation for ${example.gameId}: "${suggestedMove}" in position ${fen.substring(0, 50)}...`);
      console.log(`Legal moves (first 8): ${legalMoves.slice(0, 8).join(', ')}`);
      console.log(`Total legal moves: ${legalMoves.length}`);
      
      if (suggestedMove && !legalMoves.includes(suggestedMove)) {
        console.log(`❌ INVALID MOVE: "${suggestedMove}" is not legal in this position!`);
        console.log(`Original recommendation text: "${betterMoveText}"`);
        
        // Try to find a similar legal move by various criteria
        let similarMove = null;
        
        // 1. Same piece type and target square
        const pieceType = suggestedMove.match(/^[NBRQK]/);
        const targetSquare = suggestedMove.match(/[a-h][1-8]$/);
        if (pieceType && targetSquare) {
          similarMove = legalMoves.find(move => 
            move.startsWith(pieceType[0]) && move.endsWith(targetSquare[0])
          );
        }
        
        // 2. Same target square (different piece)
        if (!similarMove && targetSquare) {
          similarMove = legalMoves.find(move => move.endsWith(targetSquare[0]));
        }
        
        // 3. Same piece type (different target)
        if (!similarMove && pieceType) {
          similarMove = legalMoves.find(move => move.startsWith(pieceType[0]));
        }
        
        // 4. Piece development moves (preferred)
        if (!similarMove) {
          const developmentMoves = legalMoves.filter(move => 
            /^[NBR]/.test(move) || // Knight, Bishop, or Rook moves
            /^[a-h][3-6]/.test(move) || // Central pawn moves
            move.includes('O-O') // Castling
          );
          if (developmentMoves.length > 0) {
            similarMove = developmentMoves[0];
          }
        }
        
        if (similarMove) {
          console.log(`✅ FIXED: Replacing with legal move: "${similarMove}"`);
          
          // Preserve the explanation but update the move
          const explanationMatch = betterMoveText.match(/(?:^[^\-]*\s*-\s*)(.+)$/);
          const explanation = explanationMatch ? explanationMatch[1] : 'This move improves the position by developing pieces actively and maintaining better coordination';
          
          example.betterMove = `${similarMove} - ${explanation}`;
        } else {
          console.log(`✅ SAFE FALLBACK: Using first legal move: "${legalMoves[0]}"`);
          example.betterMove = `${legalMoves[0]} - This move maintains a solid position and avoids the issues with the original move`;
        }
      } else if (suggestedMove) {
        console.log(`✅ VALID: "${suggestedMove}" is legal in this position`);
      } else {
        console.log(`⚠️ Could not parse move from: "${betterMoveText.substring(0, 50)}..."`);
        
        // If we can't parse the move, at least provide a good fallback move
        const goodMoves = legalMoves.filter(move => 
          /^[NBR]/.test(move) || // Development moves
          /^[a-h][3-6]/.test(move) || // Central pawn moves
          move.includes('O-O') // Castling
        );
        
        if (goodMoves.length > 0) {
          console.log(`🔄 PROVIDING FALLBACK: "${goodMoves[0]}"`);
          example.betterMove = `${goodMoves[0]} - This move follows sound chess principles and improves the position`;
        }
      }
      
    } catch (error) {
      console.log(`Error validating move for ${example.gameId}:`, error);
      
      // Provide a very safe fallback
      try {
        const chess = new Chess(fen);
        const legalMoves = chess.moves();
        if (legalMoves.length > 0) {
          example.betterMove = `${legalMoves[0]} - This move maintains a solid position`;
          console.log(`🚨 ERROR RECOVERY: Using safe move "${legalMoves[0]}"`);
        }
      } catch (fallbackError) {
        console.log(`Critical error in move validation:`, fallbackError);
      }
    }
  }

  private getPlayerInfo(pgn: string, moveNumber: number, gameId: string, username: string): { playerColor: 'white' | 'black', whitePlayer: string, blackPlayer: string } | null {
    try {
      // Extract player names from PGN headers
      const whiteMatch = pgn.match(/\[White\s+"([^"]+)"\]/);
      const blackMatch = pgn.match(/\[Black\s+"([^"]+)"\]/);
      const whitePlayer = whiteMatch ? whiteMatch[1] : 'Unknown';
      const blackPlayer = blackMatch ? blackMatch[1] : 'Unknown';
      
      console.log(`[${gameId}] Players - White: "${whitePlayer}", Black: "${blackPlayer}", Username: "${username}"`);
      
      // Determine which color the user played
      let playerColor: 'white' | 'black';
      if (whitePlayer.toLowerCase().includes(username.toLowerCase()) || username.toLowerCase().includes(whitePlayer.toLowerCase())) {
        playerColor = 'white';
      } else if (blackPlayer.toLowerCase().includes(username.toLowerCase()) || username.toLowerCase().includes(blackPlayer.toLowerCase())) {
        playerColor = 'black';
      } else {
        // Fallback: determine by move number if we can't match names
        // If moveNumber is odd (1, 3, 5...), it's White's move
        // If moveNumber is even (2, 4, 6...), it's Black's move
        playerColor = (moveNumber % 2) === 1 ? 'white' : 'black';
        console.log(`[${gameId}] Could not match username to player names, using move number fallback`);
      }
      
      console.log(`[${gameId}] Move ${moveNumber} - User played as ${playerColor}. White: ${whitePlayer}, Black: ${blackPlayer}`);
      
      return {
        playerColor,
        whitePlayer,
        blackPlayer
      };
    } catch (error) {
      console.error(`[${gameId}] Error extracting player info:`, error);
      return null;
    }
  }

  private getFenAtMove(pgn: string, moveNumber: number, gameId: string, username?: string): { fen: string, lastMove: string, fromSquare?: string, toSquare?: string } | null {
    try {
      console.log(`[${gameId}] Starting FEN extraction for full move ${moveNumber}`);
      console.log(`[${gameId}] PGN preview:`, pgn.substring(0, 200) + '...');
      
      const chess = new Chess();
      
      // Try to load the PGN - this might throw an error
      try {
        chess.loadPgn(pgn);
        console.log(`[${gameId}] PGN loaded successfully`);
      } catch (pgnError) {
        console.error(`[${gameId}] Failed to load PGN:`, pgnError);
        return null;
      }
      
      const history = chess.history();
      console.log(`[${gameId}] Game has ${history.length} half-moves (plies)`);
      
      if (history.length === 0) {
        console.log(`[${gameId}] No moves found in PGN`);
        return null;
      }
      
      // Reset and play moves up to the specified move number
      chess.reset();
      
      // Convert full move number to ply index
      // Full move 1 = plies 1-2 (White's move 1 + Black's move 1)
      // Full move 2 = plies 3-4 (White's move 2 + Black's move 2)
      // Full move n = plies (2n-1) to (2n)
      
      console.log(`[${gameId}] Full move ${moveNumber} analysis`);
      console.log(`[${gameId}] Total plies in game: ${history.length}`);
      console.log(`[${gameId}] Total full moves in game: ${Math.ceil(history.length / 2)}`);
      
      // Calculate both possible ply indices for this full move
      const whitePlyIndex = (moveNumber * 2) - 2; // 0-based ply index for White's move
      const blackPlyIndex = (moveNumber * 2) - 1; // 0-based ply index for Black's move
      
      console.log(`[${gameId}] Full move ${moveNumber} plies: White=${whitePlyIndex + 1}, Black=${blackPlyIndex + 1}`);
      
      // Determine which ply to use based on what's available and who the user is
      let actualTargetPlyIndex: number;
      
      // First, try to determine which color the user played
      let userColor: 'white' | 'black' | null = null;
      if (username) {
        const whiteMatch = pgn.match(/\[White\s+"([^"]+)"\]/);
        const blackMatch = pgn.match(/\[Black\s+"([^"]+)"\]/);
        const whitePlayer = whiteMatch ? whiteMatch[1] : '';
        const blackPlayer = blackMatch ? blackMatch[1] : '';
        
        if (whitePlayer.toLowerCase().includes(username.toLowerCase()) || 
            username.toLowerCase().includes(whitePlayer.toLowerCase())) {
          userColor = 'white';
        } else if (blackPlayer.toLowerCase().includes(username.toLowerCase()) || 
                   username.toLowerCase().includes(blackPlayer.toLowerCase())) {
          userColor = 'black';
        }
        console.log(`[${gameId}] User ${username} played as ${userColor || 'unknown'} (White: ${whitePlayer}, Black: ${blackPlayer})`);
      }
      
      if (whitePlyIndex >= 0 && whitePlyIndex < history.length && 
          blackPlyIndex >= 0 && blackPlyIndex < history.length) {
        // Both moves exist in this full move
        if (userColor === 'white') {
          actualTargetPlyIndex = whitePlyIndex;
          console.log(`[${gameId}] User played White, using White's move: ply ${actualTargetPlyIndex + 1}`);
        } else if (userColor === 'black') {
          actualTargetPlyIndex = blackPlyIndex;
          console.log(`[${gameId}] User played Black, using Black's move: ply ${actualTargetPlyIndex + 1}`);
        } else {
          // Default to White's move if we can't determine user color
          actualTargetPlyIndex = whitePlyIndex;
          console.log(`[${gameId}] Both moves available, user color unknown, defaulting to White's move: ply ${actualTargetPlyIndex + 1}`);
        }
      } else if (whitePlyIndex >= 0 && whitePlyIndex < history.length) {
        // Only White's move exists
        actualTargetPlyIndex = whitePlyIndex;
        console.log(`[${gameId}] Only White's move available: ply ${actualTargetPlyIndex + 1}`);
      } else if (blackPlyIndex >= 0 && blackPlyIndex < history.length) {
        // Only Black's move exists
        actualTargetPlyIndex = blackPlyIndex;
        console.log(`[${gameId}] Only Black's move available: ply ${actualTargetPlyIndex + 1}`);
      } else {
        // Neither move exists - the full move is out of range
        console.log(`[${gameId}] Full move ${moveNumber} is out of range (game has ${Math.ceil(history.length / 2)} full moves)`);
        return null;
      }
      
      console.log(`[${gameId}] Moves around target: ${history.slice(Math.max(0, actualTargetPlyIndex - 2), actualTargetPlyIndex + 3).join(', ')}`);
      console.log(`[${gameId}] Target move (the user's move that we're analyzing): "${history[actualTargetPlyIndex]}"`);
      
      const isWhiteTurn = (actualTargetPlyIndex % 2) === 0;
      console.log(`[${gameId}] Full move ${moveNumber}, ply ${actualTargetPlyIndex + 1} is ${isWhiteTurn ? "White's" : "Black's"} turn`);
      
      if (actualTargetPlyIndex < 0 || actualTargetPlyIndex >= history.length) {
        console.log(`[${gameId}] Ply index ${actualTargetPlyIndex} out of range (game has ${history.length} plies)`);
        return null;
      }
      
      // CRITICAL FIX: Get position BEFORE the user's move (so we can suggest alternatives)
      let userMove = '';
      let fromSquare = '';
      let toSquare = '';
      
      console.log(`[${gameId}] Playing ${actualTargetPlyIndex} plies to get position BEFORE user's move...`);
      
      // Play all moves up to (but not including) the target ply to get position before user's move
      for (let i = 0; i < actualTargetPlyIndex; i++) {
        try {
          const playedMove = chess.move(history[i]);
          console.log(`[${gameId}] Played ply ${i + 1}: ${history[i]} (${playedMove.san})`);
        } catch (moveError) {
          console.error(`[${gameId}] Failed to play ply ${i + 1}: ${history[i]}`, moveError);
          return null;
        }
      }
      
      // Get the position before the user's move (this is where we want to suggest alternatives)
      const fen = chess.fen();
      console.log(`[${gameId}] Position BEFORE user's move: ${fen}`);
      console.log(`[${gameId}] Current turn: ${chess.turn() === 'w' ? 'White' : 'Black'}`);
      
      // Store the user's actual move for reference (but don't play it yet)
      try {
        const moveResult = chess.move(history[actualTargetPlyIndex]);
        userMove = moveResult.san; // Store the actual move the user played
        fromSquare = moveResult.from;
        toSquare = moveResult.to;
        console.log(`[${gameId}] User's actual move: ${userMove} from ${fromSquare} to ${toSquare}`);
        
        // Undo the move to get back to the position before the user's move
        chess.undo();
      } catch (moveError) {
        console.error(`[${gameId}] Failed to parse user's move: ${history[actualTargetPlyIndex]}`, moveError);
        return null;
      }
      
      console.log(`[${gameId}] Successfully generated FEN (position BEFORE user's move): ${fen}`);
      console.log(`[${gameId}] User's move that we're analyzing: ${userMove}, From: ${fromSquare}, To: ${toSquare}`);
      
      return { fen, lastMove: userMove, fromSquare, toSquare };
    } catch (error) {
      console.error(`[${gameId}] Unexpected error in FEN extraction:`, error);
      return null;
    }
  }

  private formatGamesForAnalysis(games: ChessGame[], username: string): string {
    return games.map((game, index) => {
      const userColor = game.white.name.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
      const opponent = userColor === 'white' ? game.black : game.white;
      
      return `
Game ${index + 1} (ID: ${game.id}):
- Date: ${game.date}
- User played: ${userColor}
- Opponent: ${opponent.name} (${opponent.rating || 'Unrated'})
- Result: ${game.result}
- Opening: ${game.opening.name} ${game.opening.eco ? `(${game.opening.eco})` : ''}
- Time Control: ${game.timeControl}
- Moves: ${game.moves.join(' ')}
- PGN: ${game.pgn}
      `.trim();
    }).join('\n\n');
  }

  private formatGamesWithPositionalContext(games: ChessGame[], username: string): string {
    return games.map((game, index) => {
      const userColor = game.white.name.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
      const opponent = userColor === 'white' ? game.black : game.white;
      
      // Get key positions from the game for analysis
      const chess = new Chess();
      let positionAnalysis = '';
      
      try {
        chess.loadPgn(game.pgn);
        const history = chess.history();
        
        // Reset and provide key positions where user made moves
        chess.reset();
        const keyPositions: string[] = [];
        
        // Sample every 3-4 moves to show key decision points
        for (let moveIndex = 0; moveIndex < Math.min(history.length, 30); moveIndex += 1) {
          const fullMoveNum = Math.floor(moveIndex / 2) + 1;
          const isUserMove = (userColor === 'white' && moveIndex % 2 === 0) || 
                            (userColor === 'black' && moveIndex % 2 === 1);
          
          if (isUserMove && moveIndex < history.length && (moveIndex % 4 === 0 || moveIndex % 4 === 1)) {
            const fenBefore = chess.fen();
            const userMove = history[moveIndex];
            keyPositions.push(`  Move ${fullMoveNum}${userColor === 'black' ? '...' : '.'} Position: ${fenBefore} -> User played: ${userMove}`);
          }
          
          if (moveIndex < history.length) {
            chess.move(history[moveIndex]);
          }
        }
        
        if (keyPositions.length > 0) {
          positionAnalysis = `\n- Key Positions:\n${keyPositions.slice(0, 5).join('\n')}`;
        }
      } catch (error) {
        console.log(`Error analyzing positions for game ${game.id}:`, error);
      }
      
      return `
Game ${index + 1} (ID: ${game.id}):
- Date: ${game.date}
- User played: ${userColor}
- Opponent: ${opponent.name} (${opponent.rating || 'Unrated'})
- Result: ${game.result}
- Opening: ${game.opening.name} ${game.opening.eco ? `(${game.opening.eco})` : ''}
- Time Control: ${game.timeControl}
- Moves: ${game.moves.join(' ')}${positionAnalysis}
- PGN: ${game.pgn}
      `.trim();
    }).join('\n\n');
  }

  async generateExecutiveSummary(games: ChessGame[], username: string): Promise<ExecutiveSummary> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**EXECUTIVE SUMMARY SECTION:**
Start with a brief, encouraging but blunt paragraph summarizing the player's overall style and the key theme of this report. Write as if coming from you, their world-class coach, giving an overview of the student's progress, strengths, and current developmental priorities.

Please provide a comprehensive executive summary in JSON format with the following structure:
{
  "totalGames": number,
  "winRate": number (percentage),
  "averageAccuracy": number (estimated percentage),
  "favoriteOpenings": [array of most played openings],
  "timeControlPreference": "most common time control",
  "overallRating": number (estimated current strength),
  "strengthAreas": [array of 3-4 main strengths],
  "keyInsights": [array of 3-4 key insights about the player's style]
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Tailor the analysis to the player's actual rating level—provide sophisticated insights appropriate for their strength
- Use the psychological insight approach that uncovers flawed thinking patterns

Focus on:
- Win/loss statistics with pattern analysis and rating-specific context
- Opening repertoire analysis with theoretical depth and preparation gaps
- Time control impact on decision-making quality and time management efficiency
- Rating-appropriate strategic and tactical assessment
- Advanced patterns in playing style, positional understanding, and calculation depth
- Psychological patterns and recurring mental habits that hold the player back
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating executive summary:', error);
      throw new ReportGenerationError(
        'Failed to generate executive summary',
        'AI_ERROR',
        error
      );
    }
  }

  async generateRecurringWeaknesses(games: ChessGame[], username: string): Promise<RecurringWeakness[]> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach with STOCKFISH-LEVEL EVALUATION PRECISION. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

**CRITICAL TACTICAL RULES:**
- You have COMPUTER-LEVEL evaluation accuracy. Only identify moves as mistakes if they are objectively inferior by at least 0.5 pawns.
- **FORCED MOVES ARE SACRED**: Recaptures (Rxq, Bxn, etc.) are usually MANDATORY and correct!
- **NEVER** criticize recaptures - when your piece is captured, you must recapture!
- **SEQUENCE AWARENESS**: Queen trades (Qxq, Rxq) are forced sequences, not optional moves!
- **PIECE SAFETY IS PARAMOUNT**: When a Queen/Rook is attacked, moving it to safety is usually the CORRECT move!
- **NEVER** suggest other moves when a valuable piece is under attack (unless they win material or deliver mate)
- **NEVER** criticize moving an attacked piece - this shows good tactical awareness!
- Never suggest moves that hang material or create tactical vulnerabilities.

**CRITICAL POSITION CONTEXT UNDERSTANDING:**
- You are analyzing positions BEFORE the user made their move
- When suggesting "better moves", suggest alternatives to REPLACE the user's move
- Example: If user played h6 to develop their bishop, analyze the position BEFORE h6 and suggest what should have been played INSTEAD of h6
- DO NOT suggest moves that assume the user's move was already played
- Think: "In this position, instead of playing [user's move], what would have been better?"

**MANDATORY MOVE VERIFICATION PROCESS:**
- BEFORE suggesting any move, mentally verify it's legal in the given position
- Check that all pieces required for your suggested move exist and are correctly placed
- Confirm the move follows chess rules (no moving through pieces, correct piece movement patterns)
- NEVER suggest moves that require pieces to be on squares they're not actually on
- If unsure about legality, choose a safe development move (like Nf3, Bc4, d4, e4, etc.)
- Remember: A wrong move suggestion is worse than a safe, legal move

**BALANCED ANALYSIS APPROACH**:

**SEEK DIVERSE STRATEGIC MISTAKES**:
- Pawn structure errors (h6/g6 weakening king, creating holes)
- Piece misplacement (knight on rim, bishop blocked by own pawns)
- Planning mistakes (attacking wrong side, ignoring opponent's threats)
- Weak square creation (permanently weakening key squares)
- Poor trades (giving up good pieces for inferior ones)

**MANDATORY CHECKS**: Before calling any move a "mistake":
1. "Was a piece under attack? If yes, moving it is probably correct!"
2. "Is this a recapture? If yes, it's usually forced and correct!"  
3. "Am I analyzing the USER's move or the opponent's move?"
4. "Is this a genuine strategic choice with better alternatives, not a forced move?"

Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**RECURRING WEAKNESSES (3 items):** This is the most critical section. For each weakness:
a. Give it a clear, descriptive title like you need to work on - outposts/weaksquares, pawnbreaks/pawntension, trading good vs bad pieces, exchange sacrifice tactical, counter attack, static and dynamic weakness, blockade or restriction, space advantage, minority attacks, isolated queen pawn, passed pawn, how to evaluate the position at given time, improving pieces or vision of board, candidate moves or deep advanced tactics 3-4 move visualisation, Clearance, Quiet Move, Weak Squares, Pawn Breaks, Space Advantage, Piece Activity, Open Files, Bishop vs Knight, Improving the Worst Piece, Good Knight vs Bad Bishop, Control of Key Squares, King Safety, Doubled Pawns, Isolated Pawns, Hanging Pawns, Backward Pawns, Pawn Majorities, Pawn Chains, Minority Attack, Pawn Levers, Fixed Weaknesses, Creating a Plan, Prophylaxis, Maneuvering Pieces, Transition to Endgame, Exchanging Pieces, Avoiding Exchanges, Opposite Side Castling, Centralization, Attacking the King, Attacking the Center, Exploiting Open Lines, Principle of Two Weaknesses, Overprotection, Domination, Restriction, Blockade, Initiative, Tempo, Color Complexes, Asymmetrical Positions, Flank Attacks, Strong vs Weak Color Bishops, Accumulating Advantages, Trade Evaluation, Transition from Tactics to Strategy

b. Write a detailed explanation of *why* this is a weakness, explaining the long-term positional or strategic consequences.

c. **RIGOROUS EXAMPLE ANALYSIS with STOCKFISH-LEVEL ACCURACY (EXACTLY 2 EXAMPLES PER WEAKNESS):**
   - Use EXACT game IDs from the data (e.g., "lichess-abc123" or "chess-com-xyz789")
   - Include precise move numbers (e.g., 15 for the 15th full move)
   - Show the move played (e.g., "15...g5?!")
   - **MANDATORY**: Only analyze moves that are genuinely inferior by 0.5+ pawns
   - **VERIFICATION**: Ensure no tactical oversights in your evaluation
   - Focus on STRATEGIC/POSITIONAL mistakes, not obvious tactical blunders
   - Explain why the move is objectively inferior with concrete consequences
   - **CRITICAL**: Provide EXACTLY 2 examples for each weakness, no more, no less

d. **SUPERIOR MOVE RECOMMENDATIONS with ENGINE-LEVEL VERIFICATION:**
   - **CRITICAL CONTEXT**: You receive the FEN position that existed just BEFORE the user played their move
   - **REPLACEMENT LOGIC**: In this given FEN position, what move should the user have played INSTEAD?
   - **MOVE VALIDATION**: Every suggested move MUST be legal in the provided FEN position
   - **NEVER suggest moves that**:
     * Assume pieces have moved from their positions in the given FEN
     * Require pieces to be on squares they're not actually on in the FEN
     * Are based on a different board position than the one provided
   - **ALWAYS verify your suggestion**:
     * Check that all pieces needed for your move exist in the correct squares in the FEN
     * Confirm the move is actually legal from the given position
     * Calculate the resulting position after your suggested move
   - Provide specific moves in algebraic notation with evaluation advantage
   - Example: "15...Nd7! (+0.6) instead of 15...g5?! (-0.4)" 
   - **VERIFICATION PROCESS**: Before suggesting any move, mentally place the board according to the FEN and confirm your move is legal
   - Explain concrete strategic advantages: piece activity, pawn structure, king safety
   - Calculate 2-3 moves deep to ensure tactical soundness

e. **CRITICAL - Improvement Suggestion:** Provide ONE concise, technical line using advanced chess concepts. No generic advice, no elaboration, no justification. Use master principles with exact applications. 
   
   Examples of required format:
   - "Apply Nimzowitsch's principle of centralization before attacking: establish your knight on e5/d5 with pawn support first."
   - "Use Dvoretsky's method for evaluating exchanges: calculate the resulting pawn structure 3-4 moves ahead."
   - "Implement Silman's imbalance theory: identify your imbalances and create a plan that amplifies these advantages."
   - "Apply Karpov's principle of improving your worst piece before making committal moves."
   
   FORBIDDEN: Multiple questions, step-by-step instructions, basic advice, or any elaboration beyond one technical line.

Please provide detailed analysis in JSON format with the following structure:
[
  {
    "title": "weakness title",
    "description": "detailed description of the weakness",
    "frequency": number (how often it occurs),
    "examples": [
      {
        "gameId": "actual game ID from the game data above",
        "moveNumber": number,
        "position": "brief position description",
        "mistake": "what the player did wrong",
        "betterMove": "what would have been better"
      }
      // EXACTLY 2 examples per weakness - provide only 2 objects in this array
    ],
    "improvementSuggestion": "highly technical, advanced advice using chess jargon and master principles - NO basic advice"
  }
]

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Use sophisticated chess terminology for 1500+ FIDE level players—assume strong understanding of chess concepts
- FORBIDDEN: Basic advice like "think about your moves", "analyze the position", "consider your options", "be careful", "look for tactics", "improve your planning", "study more", "practice calculating"
- REQUIRED: Reference specific master principles, advanced positional concepts, technical evaluation methods
- Provide sophisticated analysis that challenges the player to improve beyond their current level
- Focus on advanced psychological patterns and sophisticated technical methods

Focus on:
- Strategic and positional mistakes (not tactical blunders)
- Long-term positional consequences of moves
- Flawed thinking patterns that lead to recurring mistakes
- Advanced concepts like weak squares, pawn structure evaluation, piece activity
- Technical improvement methods must reference specific master principles and advanced positional concepts
- Every suggestion must include concrete implementation methods and specific techniques
- Plans and ideas rather than just individual moves

For improvement suggestions, provide advanced technical recommendations with future plans:
- Explain the superior plan and future ideas
- Show how to convert positional advantages
- Demonstrate long-term strategic thinking
- Reference specific positional concepts and their application

**MANDATORY VERIFICATION CHECKLIST:**
1. **VARIETY AND BALANCE**: 
   - **DIVERSE EXAMPLES**: Not just queen exchanges - find varied strategic mistakes
   - **STRATEGIC FOCUS**: Include pawn structure, piece placement, king safety errors
   - **AVOID OVER-CAUTION**: Don't only analyze "safe" forced moves - find genuine strategic errors

2. **TACTICAL SOUNDNESS**: Every recommended move verified for:
   - No hanging pieces or material loss
   - **FORCED MOVE CHECK**: Is original move a mandatory recapture? (If yes, don't criticize!)
   - **PIECE SAFETY CHECK**: If original move saved an attacked piece, is alternative also safe?
   - **QUEEN SAFETY RULE**: Never suggest alternatives when Queen was attacked unless they win material
   - **RECAPTURE VERIFICATION**: Never suggest alternatives to logical recaptures
   - No tactical vulnerabilities (pins, forks, discovered attacks)
   - Calculated 2-3 moves deep for accuracy
   - **FUNDAMENTAL RULE**: Moving attacked pieces is usually the correct response!
   - **CONTEXT CHECK**: Am I analyzing the correct player's move?
   - **POSITION CONTEXT CHECK**: Am I suggesting alternatives from the position BEFORE the user's move, not after?

2. **EVALUATION PRECISION**: Every "mistake" meets criteria:
   - Objectively inferior by minimum 0.5 pawns
   - Creates measurable disadvantages
   - Not a reasonable practical alternative

3. **RECOMMENDATION ACCURACY**: Every suggested improvement:
   - Genuinely superior by concrete margin
   - Tactically sound and verified
   - Serves clear strategic purpose

CRITICAL: Focus on POSITIONAL chess mistakes that players above 1300-2600 struggle with, not tactical blunders. Use Stockfish-level evaluation accuracy.

Identify exactly 3 most significant recurring weaknesses with specific examples from the games.
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const weaknesses: RecurringWeakness[] = JSON.parse(jsonMatch[0]);
      
      // Log all available game IDs for debugging
      console.log('=== FEN ENHANCEMENT START ===');
      console.log('Available game IDs:', games.map(g => g.id));
      console.log('Number of weaknesses:', weaknesses.length);
      
      // Enhance each weakness example with FEN positions and validate recommendations
      for (let w = 0; w < weaknesses.length; w++) {
        const weakness = weaknesses[w];
        console.log(`Processing weakness ${w + 1}: ${weakness.title}`);
        console.log(`This weakness has ${weakness.examples.length} examples`);
        
        for (let e = 0; e < weakness.examples.length; e++) {
          const example = weakness.examples[e];
          console.log(`--- Example ${e + 1} ---`);
          console.log('Looking for game with ID:', example.gameId);
          console.log('Move number:', example.moveNumber);
          
          const game = games.find(g => g.id === example.gameId);
          console.log('Game found:', !!game);
          
          if (!game) {
            console.log(`Game ${example.gameId} not found!`);
            console.log('Available game IDs:', games.map(g => g.id));
            // Try to find by partial match or different formatting
            const partialMatch = games.find(g => 
              g.id.includes(example.gameId) || example.gameId.includes(g.id)
            );
            if (partialMatch) {
              console.log(`Found partial match: ${partialMatch.id} for requested ${example.gameId}`);
              const fenResult = this.getFenAtMove(partialMatch.pgn, example.moveNumber, example.gameId, username);
              const playerInfo = this.getPlayerInfo(partialMatch.pgn, example.moveNumber, example.gameId, username);
              if (fenResult) {
                example.fenPosition = fenResult.fen;
                example.lastMove = fenResult.lastMove;
                example.fromSquare = fenResult.fromSquare;
                example.toSquare = fenResult.toSquare;
                if (playerInfo) {
                  example.playerColor = playerInfo.playerColor;
                  example.whitePlayer = playerInfo.whitePlayer;
                  example.blackPlayer = playerInfo.blackPlayer;
                }
                
                // Validate the better move recommendation
                this.validateAndFixMoveRecommendation(example, fenResult.fen);
              }
            } else {
              // Add a test FEN to the first example just to verify the chessboard works
              if (w === 0 && e === 0) {
                console.log('Adding test FEN to first example');
                example.fenPosition = "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3";
              }
            }
          } else {
            console.log(`Found game ${example.gameId}`);
            if (game.pgn) {
              console.log(`Extracting FEN for move ${example.moveNumber} in game ${example.gameId}`);
              const fenResult = this.getFenAtMove(game.pgn, example.moveNumber, example.gameId, username);
              const playerInfo = this.getPlayerInfo(game.pgn, example.moveNumber, example.gameId, username);
              console.log(`Extracted FEN for ${example.gameId}:`, fenResult);
              if (fenResult) {
                example.fenPosition = fenResult.fen;
                example.lastMove = fenResult.lastMove;
                example.fromSquare = fenResult.fromSquare;
                example.toSquare = fenResult.toSquare;
                if (playerInfo) {
                  example.playerColor = playerInfo.playerColor;
                  example.whitePlayer = playerInfo.whitePlayer;
                  example.blackPlayer = playerInfo.blackPlayer;
                }
                
                // Validate the better move recommendation
                this.validateAndFixMoveRecommendation(example, fenResult.fen);
              }
            } else {
              console.log(`Game ${example.gameId} has no PGN data`);
            }
          }
        }
      }
      
      console.log('=== FEN ENHANCEMENT COMPLETE ===');
      // Log final state
      let totalExamples = 0;
      let examplesWithFen = 0;
      weaknesses.forEach(weakness => {
        weakness.examples.forEach(example => {
          totalExamples++;
          if (example.fenPosition) {
            examplesWithFen++;
          }
        });
      });
      console.log(`Total examples: ${totalExamples}, Examples with FEN: ${examplesWithFen}`);
      
      return weaknesses;
    } catch (error) {
      console.error('Error generating recurring weaknesses:', error);
      throw new ReportGenerationError(
        'Failed to generate recurring weaknesses analysis',
        'AI_ERROR',
        error
      );
    }
  }

  async generateMiddleGameAnalysis(games: ChessGame[], username: string): Promise<MiddleGameAnalysis> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**MIDDLEGAME MASTERY FOCUS:**
a. Analyze the player's typical middlegame plans. Are they coherent? Do they correctly identify which side of the board to play on?
b. Identify one key middlegame concept they need to study, based on their mistakes - Clearance, Quiet Move, Weak Squares, Pawn Breaks, Space Advantage, Piece Activity, Open Files, Bishop vs Knight, Improving the Worst Piece, Good Knight vs Bad Bishop, Control of Key Squares, King Safety, Doubled Pawns, Isolated Pawns, Hanging Pawns, Backward Pawns, Pawn Majorities, Pawn Chains, Minority Attack, Pawn Levers, Fixed Weaknesses, Creating a Plan, Prophylaxis, Maneuvering Pieces, Transition to Endgame, Exchanging Pieces, Avoiding Exchanges, Opposite Side Castling, Centralization, Attacking the King, Attacking the Center, Exploiting Open Lines, Principle of Two Weaknesses, Overprotection, Domination, Restriction, Blockade, Initiative, Tempo, Color Complexes, Asymmetrical Positions, Flank Attacks, Strong vs Weak Color Bishops, Accumulating Advantages, Trade Evaluation, Transition from Tactics to Strategy

Please provide detailed middlegame analysis in JSON format with the following structure:
{
  "overallRating": number (1-10 scale),
  "strengths": [array of middlegame strengths],
  "weaknesses": [array of middlegame weaknesses],
  "patterns": {
    "positionalUnderstanding": number (1-10),
    "tacticalAwareness": number (1-10),
    "planFormation": number (1-10),
    "pieceCoordination": number (1-10)
  },
  "recommendations": [array of specific improvement recommendations],
  "examplePositions": [
    {
      "gameId": "actual game ID from the game data above",
      "position": "position description",
      "analysis": "what happened in this position",
      "suggestion": "how to improve"
    }
  ]
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Use sophisticated chess terminology appropriate for their rating level
- When using technical terms, briefly explain them so parents can understand
- Focus on advanced middlegame concepts that will elevate their strategic understanding
- Analyze the psychological patterns in their middlegame decision-making

Focus on:
- Plan coherence and ability to identify correct side of the board to play on
- Advanced positional concepts: controlling key squares, piece activity, pawn structure changes
- Complex tactical patterns: in-between moves, deflection, decoy, clearance
- Strategic planning: long-term advantages, piece maneuvering, breakthrough preparation
- Dynamic piece play: piece coordination, optimizing piece scope, repositioning
- Attack and defense: timing of breaks, preventive thinking, counterplay creation
- Advanced middlegame patterns: typical plans in specific pawn structures
- Psychological decision-making patterns and flawed thinking in complex positions
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating middlegame analysis:', error);
      throw new ReportGenerationError(
        'Failed to generate middlegame analysis',
        'AI_ERROR',
        error
      );
    }
  }

  async generateEndgameAnalysis(games: ChessGame[], username: string): Promise<EndgameAnalysis> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**ENDGAME TECHNIQUE REVIEW:**
a. Assess the player's technique in the endgame phases of the provided games. Are they confident in converting advantages? Do they defend well in difficult endgames?
b. Pinpoint one specific endgame skill to practice (e.g., Opposition, Distant Opposition, Shouldering, Lucena Position, Philidor Position, Vancura Defense, Cutting Off the King, Checking from Behind, Active Rook vs Passive Rook, Bishop of Wrong Color, Knight Maneuvering, Bishop vs Knight, Same Color Bishop Endgames, Opposite Color Bishop Endgames, Fortresses, Outside Passed Pawn, Passed Pawn Principle, Triangulation, Zugzwang, Breakthrough, Corresponding Squares, Don't Rush, Convert One Advantage, Avoid Unnecessary Pawn Moves, Keep Rooks Active, Centralize King Early, Avoid Traps in Simpler Positions)

Please provide detailed endgame analysis in JSON format with the following structure:
{
  "overallRating": number (1-10 scale),
  "strengths": [array of endgame strengths],
  "weaknesses": [array of endgame weaknesses],
  "commonMistakes": [array of common endgame mistakes],
  "endgameTypes": [
    {
      "type": "endgame type (e.g., King+Pawn, Rook endgame)",
      "performance": number (1-10),
      "gamesPlayed": number,
      "successRate": number (percentage)
    }
  ],
  "recommendations": [array of specific study recommendations],
  "studyMaterial": [array of recommended study materials],
  "examplePositions": [
    {
      "gameId": "actual game ID from the game data above",
      "endgameType": "type of endgame",
      "position": "position description",
      "analysis": "what happened",
      "correctPlay": "what the correct play should be"
    }
  ]
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Use advanced endgame terminology appropriate for their rating level
- When using technical terms, briefly explain them so parents can understand
- Focus on sophisticated endgame concepts that will strengthen their technical play
- Analyze psychological patterns in endgame decision-making and confidence levels

Focus on:
- Confidence in converting advantages and defending difficult positions
- Advanced endgame technique: precise calculation, tempo, triangulation, forcing moves
- Complex pawn endgames: breakthrough, outside passed pawns, pawn races
- Rook endgames: winning and drawing techniques, active vs passive rook play
- Minor piece endgames: bishop vs knight dynamics, good vs bad bishops
- Queen endgames: perpetual check avoidance, queen vs pawns, queen endings
- King and pawn vs king: critical squares, opposition, distant opposition
- Multi-piece endgames: coordination, piece activity, conversion techniques
- Psychological aspects: confidence, time pressure effects, defensive mindset
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating endgame analysis:', error);
      throw new ReportGenerationError(
        'Failed to generate endgame analysis',
        'AI_ERROR',
        error
      );
    }
  }

  async generateImprovementPlan(
    games: ChessGame[], 
    username: string, 
    weaknesses: RecurringWeakness[],
    middlegameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): Promise<ActionableImprovementPlan> {
    // Get personalized video recommendation using our new service
    const videoRecommendation = videoRecommendationService.getPersonalizedVideoRecommendation(
      weaknesses,
      middlegameAnalysis,
      endgameAnalysis
    );

    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

**USER PROMPT**
Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Previous Analysis Summary:
- Recurring Weaknesses: ${JSON.stringify(weaknesses, null, 2)}
- Middlegame Analysis: ${JSON.stringify(middlegameAnalysis, null, 2)}
- Endgame Analysis: ${JSON.stringify(endgameAnalysis, null, 2)}

**PERSONALIZED VIDEO RECOMMENDATION:**
Based on the user's specific weakness patterns, the following video has been selected:
- Title: ${videoRecommendation.title}
- Channel: ${videoRecommendation.channel}
- URL: ${videoRecommendation.url}
- Description: ${videoRecommendation.description}
- Addresses: ${videoRecommendation.relevantWeakness}
- Duration: ${videoRecommendation.duration || 'N/A'}

Games Data:
${gamesData}

**ANALYSIS STRUCTURE:**

5. **Actionable Improvement Plan:**
   a. Provide a 3-step checklist of concrete things the player should focus on in their next 10 games to fix the error or recurring problem in their game (this must be customized for each player)
   
   b. Use the EXACT video recommendation provided above - do not suggest a different video. This video has been specifically selected based on their weakness patterns.
   
   c. Suggest one classic master game that perfectly illustrates a concept they need to learn. Use actual historical games with real players, dates, and tournaments.

Provide a 3-point checklist the student can follow in upcoming games. Each point should be sophisticated, technically sound, and based on their specific rating-level errors (e.g., "Before committing to a pawn break, calculate the resulting pawn structure and ensure your pieces are optimally placed for the resulting position").

Please provide a comprehensive improvement plan in JSON format with the following structure:
{
  "immediateActions": [
    {
      "priority": "high|medium|low",
      "action": "specific action to take",
      "description": "detailed description",
      "timeframe": "timeframe for implementation"
    }
  ],
  "weeklyFocus": [
    {
      "week": number,
      "focus": "main focus area",
      "exercises": [array of specific exercises],
      "goals": [array of measurable goals]
    }
  ],
  "monthlyGoals": [
    {
      "month": number,
      "goal": "main goal for the month",
      "milestones": [array of milestones],
      "trackingMethod": "how to track progress"
    }
  ],
  "resources": {
    "recommendedVideo": {
      "title": "${videoRecommendation.title}",
      "channel": "${videoRecommendation.channel}",
      "url": "${videoRecommendation.url}",
      "description": "${videoRecommendation.description}",
      "relevantWeakness": "${videoRecommendation.relevantWeakness}",
      "duration": "${videoRecommendation.duration || 'N/A'}"
    },
    "exercises": [array of specific exercises],
    "masterGame": {
      "players": "White vs Black (Year)",
      "event": "Tournament/Match name",
      "description": "Why this game perfectly illustrates the concept they need to learn",
      "relevantConcept": "Which specific concept this game demonstrates",
      "keyMoves": "Important moves or positions to study"
    }
  }
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach and not an AI
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Use sophisticated chess concepts appropriate for their rating level
- When using technical terms, briefly explain them so parents can understand
- Focus on advanced, technically sound actions that will accelerate their improvement
- Incorporate psychological insights about flawed thinking patterns that hold players back
- Provide the 3-step checklist customized for this specific player's recurring problems
- IMPROVEMENT SUGGESTIONS: Provide exactly ONE concise technical line per suggestion. NO elaboration, NO multiple questions, NO step-by-step instructions beyond the main principle

Focus on:
- Immediate high-priority fixes with sophisticated technical explanations
- Progressive skill development targeting advanced concepts for their rating level
- Specific study recommendations based on complex patterns in their games
- Practice routines focusing on advanced tactical and positional themes
- Measurable goals with concrete rating-level benchmarks
- Resource recommendations for advanced study (not beginner materials)

CRITICAL REQUIREMENTS for Videos and Puzzles:
- For VIDEOS: Use ONLY the personalized video recommendation provided above. This video has been specifically selected based on the user's exact weakness patterns and should not be changed.
- The video recommendation is dynamically generated to target their most critical weakness area.

- For PUZZLES: Provide DIRECT links to specific puzzle themes/categories that match their weaknesses
- ONLY use these VERIFIED, SPECIFIC puzzle URLs:

FOR TACTICAL WEAKNESSES:
  * Lichess Pin Puzzles: https://lichess.org/training/pin
  * Lichess Fork Puzzles: https://lichess.org/training/fork  
  * Lichess Back Rank Puzzles: https://lichess.org/training/backRankMate
  * Lichess Skewer Puzzles: https://lichess.org/training/skewer
  * Lichess Discovered Attack: https://lichess.org/training/discoveredAttack
  * Lichess Deflection: https://lichess.org/training/deflection
  * Chess.com General Puzzles: https://chess.com/puzzles (filter by difficulty in interface)

FOR ENDGAME WEAKNESSES:
  * Lichess Endgame Training: https://lichess.org/training/endgame
  * Chess.com Pawn Endgames: https://chess.com/endgames (select Pawn theme)
  * Chess.com Rook Endgames: https://chess.com/endgames (select Rook theme)
  * Chess.com Basic Checkmates: https://chess.com/endgames (select Checkmates theme)

FOR OPENING WEAKNESSES:
  * Chess.com Opening Drills: https://chess.com/drills/openings
  * Lichess Opening Trainer: https://lichess.org/learn#/15

- Match puzzle difficulty and theme EXACTLY to their identified weakness
- Each puzzle URL should lead directly to the relevant puzzle type, not general training

IMPORTANT: The video recommendation has been pre-selected based on the user's specific weakness analysis. Use the exact video details provided above in the PERSONALIZED VIDEO RECOMMENDATION section.

Make each recommendation SPECIFIC to their actual game mistakes, not generic advice.
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      // Ensure the video recommendation is included and matches our personalized selection
      if (!parsedResponse.resources || !parsedResponse.resources.recommendedVideo) {
        parsedResponse.resources = parsedResponse.resources || {};
        parsedResponse.resources.recommendedVideo = {
          title: videoRecommendation.title,
          channel: videoRecommendation.channel,
          url: videoRecommendation.url,
          description: videoRecommendation.description,
          relevantWeakness: videoRecommendation.relevantWeakness,
          duration: videoRecommendation.duration || 'N/A'
        };
      } else {
        // Override with our personalized recommendation to ensure consistency
        parsedResponse.resources.recommendedVideo = {
          title: videoRecommendation.title,
          channel: videoRecommendation.channel,
          url: videoRecommendation.url,
          description: videoRecommendation.description,
          relevantWeakness: videoRecommendation.relevantWeakness,
          duration: videoRecommendation.duration || 'N/A'
        };
      }
      
      return parsedResponse;
    } catch (error) {
      console.error('Error generating improvement plan:', error);
      throw new ReportGenerationError(
        'Failed to generate improvement plan',
        'AI_ERROR',
        error
      );
    }
  }

  // NEW UNIFIED EXECUTIVE SUMMARY METHOD FOR TESTING
  async generateUnifiedExecutiveSummary(games: ChessGame[], username: string): Promise<ExecutiveSummary> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

**USER PROMPT**
Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**ANALYSIS STRUCTURE:**

1. **Executive Summary:** Start with a brief, encouraging but blunt paragraph summarizing the player's overall style and the key theme of this report.

Please provide a comprehensive executive summary in JSON format with the following structure:
{
  "totalGames": number,
  "winRate": number (percentage),
  "averageAccuracy": number (estimated percentage),
  "favoriteOpenings": [array of most played openings],
  "timeControlPreference": "most common time control",
  "overallRating": number (estimated current strength),
  "strengthAreas": [array of 3-4 main strengths],
  "keyInsights": [array of 3-4 key insights about the player's style]
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Tailor the analysis to the player's actual rating level—provide sophisticated insights appropriate for their strength
- Use the psychological insight approach that uncovers flawed thinking patterns

Focus on:
- Win/loss statistics with pattern analysis and rating-specific context
- Opening repertoire analysis with theoretical depth and preparation gaps
- Time control impact on decision-making quality and time management efficiency
- Rating-appropriate strategic and tactical assessment
- Advanced patterns in playing style, positional understanding, and calculation depth
- Psychological patterns and recurring mental habits that hold the player back
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error generating unified executive summary:', error);
      throw new ReportGenerationError(
        'Failed to generate unified executive summary',
        'AI_ERROR',
        error
      );
    }
  }

  // NEW UNIFIED METHOD FOR TESTING - HYBRID APPROACH
  async generateUnifiedAnalysis(games: ChessGame[], username: string): Promise<{
    recurringWeaknesses: RecurringWeakness[];
    middlegameAnalysis: MiddleGameAnalysis;
    endgameAnalysis: EndgameAnalysis;
  }> {
    const gamesData = this.formatGamesForAnalysis(games, username);
    
    const prompt = `
You are "Pawnsposes," a world-renowned chess Grandmaster (FIDE 2650+) and elite coach. Your analysis is famous for being insightful, practical, and deeply psychological. You don't just point out tactical mistakes; you uncover the flawed thinking and recurring habits that hold players back. Your tone is encouraging but direct.

**USER PROMPT**
Analyze the games of the user '${username}', who has a Chess.com rating. The games are provided above in PGN format.

Games Data:
${gamesData}

**CRITICAL ANALYSIS REQUIREMENTS:**
You are a WORLD-CLASS CHESS COMPUTER with Stockfish-level evaluation precision. You are analyzing a 1500+ FIDE rated player. This player already knows basic chess principles. Your analysis must be:

**FUNDAMENTAL TACTICAL PRINCIPLES - MANDATORY TO FOLLOW:**

**FORCED MOVES AND RECAPTURES (HIGHEST PRIORITY):**
1. **When Your Queen is Captured**: 
   - **MANDATORY**: Recapture immediately if possible (Qxq, Rxq is forced sequence)
   - **NEVER** suggest alternatives to recapturing your queen - this is always correct!
   - Only skip recapture if it leads to immediate mate or major material loss

2. **When Your Rook/Minor Piece is Captured**:
   - Recapture with equal or lesser value piece when possible
   - **NEVER** criticize logical recaptures - they're usually mandatory

3. **Queen Trades and Exchanges**:
   - When queens are traded (Qxq, Rxq), the recapture is **FORCED** and correct
   - **NEVER** suggest alternatives to completing the trade
   - Recognize this as a sequence, not individual moves to criticize

**PIECE SAFETY HIERARCHY (SECOND PRIORITY):**
1. **When Queen is Attacked**: 
   - PRIMARY response: Move queen to safety (unless counter-attack wins material)
   - NEVER suggest other moves unless they win material or deliver checkmate
   - Calculate all queen escape squares before suggesting alternatives

2. **When Rook is Attacked**:
   - Move rook to safety unless counter-attack gains significant material (minor piece+)
   - Only suggest alternatives if they create overwhelming tactical compensation

3. **When Minor Piece is Attacked**:
   - Move piece to safety unless you can win equal/greater material in return
   - Consider if the piece can retreat while maintaining useful function

**STRATEGIC VS TACTICAL ANALYSIS BALANCE:**

**DO ANALYZE (Strategic Mistakes):**
- Poor pawn advances (weakening king safety, creating holes)
- Bad piece placements (knights on rim, bishops blocked by pawns)
- Weak square creation (playing moves that permanently weaken squares)
- Poor trade decisions (trading good pieces for bad ones)
- Strategic planning errors (attacking wrong side, poor king safety)
- Pawn structure mistakes (creating isolated/doubled pawns without compensation)
- Positional oversights (allowing opponent's strategic plans)

**DON'T ANALYZE (Forced/Tactical Responses):**
- Obvious recaptures (Rxq, Bxn when piece was captured)
- Moving attacked pieces to safety (Queen retreats when attacked)
- Forced defensive moves (preventing mate, saving material)
- Mandatory responses in tactical sequences

**SEQUENCE UNDERSTANDING:**
- Recognize forced sequences but focus analysis on STRATEGIC choices within games
- Look for moves where player had genuine strategic alternatives
- Avoid analyzing moves that were tactically forced

**EVALUATION ACCURACY STANDARDS:**
- Only identify moves as "mistakes" if they are objectively inferior by at least 0.5 pawns according to engine evaluation
- NEVER suggest obviously bad moves (piece sacrifices without compensation, hanging pieces, etc.)
- **CRITICAL**: When a piece is attacked, moving it to safety is usually the correct response
- Distinguish between "inaccuracies" (0.2-0.5 pawn disadvantage) and "mistakes" (0.5+ pawn disadvantage)
- Consider tactical motifs: pins, forks, skewers, discovered attacks, deflection, interference
- Evaluate pawn structure changes: isolated pawns, doubled pawns, pawn majorities, weak squares
- Assess piece activity: centralization, piece coordination, controlling key squares
- Factor in king safety: pawn shield, escape squares, potential mating attacks

**MOVE EVALUATION CRITERIA:**
Before labeling ANY move as a mistake, verify:
1. **Tactical Soundness**: Does the move hang material or allow tactics?
   - **SPECIAL CHECK**: If a piece was attacked, did the player move it to safety? (This is usually correct!)
   - **DANGER**: Never criticize moving an attacked piece unless you can prove a better defense exists
2. **Piece Safety Logic**: 
   - If queen/rook/piece was under attack, was it moved to safety? (Usually the right move!)
   - Only suggest alternatives if they win material or deliver mate
3. **Positional Logic**: Does it improve piece activity or pawn structure?
4. **Strategic Purpose**: Does it serve a clear plan (attack, defense, improvement)?
5. **Comparative Analysis**: Is the suggested alternative genuinely superior by meaningful margin?
   - **CRITICAL**: When suggesting alternatives to piece moves, ensure they don't allow the piece to be captured!

**FORBIDDEN ANALYSIS ERRORS:**
- **NEVER** call moving an attacked Queen/Rook/piece a "mistake" (this is usually the correct response!)
- **NEVER** criticize recaptures (Rxq, Bxn, etc.) - these are usually forced and correct!
- **NEVER** suggest alternatives to mandatory recaptures - they're not optional moves!
- **NEVER** analyze queen trades as separate moves - Qxq, Rxq is one sequence!
- **NEVER** suggest other moves when a valuable piece is under attack (unless they win material/mate)
- **NEVER** criticize Queen moves when the Queen was attacked (basic tactical common sense!)
- **NEVER** call retreating an attacked piece a "mistake" unless there was a genuinely better defense
- **NEVER** suggest moves that hang material without clear compensation
- **NEVER** criticize reasonable defensive moves as "passive" without concrete alternatives
- **NEVER** recommend tactics that don't work (verify all forcing sequences)
- **NEVER** suggest positional moves that worsen the position
- **NEVER** ignore piece safety in favor of "strategic" considerations
- **NEVER** confuse which player you're analyzing - focus on the USER's moves, not the opponent's!

**CRITICAL POSITION CONTEXT UNDERSTANDING:**
- You are analyzing positions BEFORE the user made their move
- When suggesting "better moves", suggest alternatives to REPLACE the user's move
- Example: If user played h6 to develop their bishop, analyze the position BEFORE h6 and suggest what should have been played INSTEAD of h6
- DO NOT suggest moves that assume the user's move was already played
- Think: "In this position, instead of playing [user's move], what would have been better?"

**MANDATORY MOVE VERIFICATION PROCESS:**
- BEFORE suggesting any move, mentally verify it's legal in the given position
- Check that all pieces required for your suggested move exist and are correctly placed
- Confirm the move follows chess rules (no moving through pieces, correct piece movement patterns)
- NEVER suggest moves that require pieces to be on squares they're not actually on
- If unsure about legality, choose a safe development move (like Nf3, Bc4, d4, e4, etc.)
- Remember: A wrong move suggestion is worse than a safe, legal move

**MANDATORY CONTEXT CHECKS:**
- Before analyzing any move, understand: "Is this a forced response to the previous move?"
- If analyzing a recapture: "Was the player's piece just captured?" (If yes, recapturing is usually correct!)
- Always confirm you're analyzing the CORRECT player's move (not the opponent's)
- Recognize forced sequences: capture → recapture → continuation

**SOPHISTICATED ANALYSIS REQUIREMENTS:**
1. DEEPLY analyze their actual games using computer-level precision
2. Find recurring strategic mistakes that are objectively holding them back
3. Provide advanced, technical solutions based on concrete evaluation
4. Reference exact games, moves, and positions with accurate assessment
5. Use master-level concepts appropriate for 1500+ players

**ANALYSIS STRUCTURE:**

2. **Recurring Weaknesses (3 items):** This is the most critical section. For each weakness (PROVIDE EXACTLY 2 EXAMPLES PER WEAKNESS):
   a. Give it a clear, descriptive title like you need to work on - outposts/weaksquares, pawnbreaks/pawntension, trading good vs bad pieces, exchange sacrifice tactical, counter attack, static and dynamic weakness, blockade or restriction, space advantage, minority attacks, isolated queen pawn, passed pawn, how to evaluate the position at given time, improving pieces or vision of board, candidate moves or deep advanced tactics 3-4 move visualisation, Clearance, Quiet Move, Weak Squares, Pawn Breaks, Space Advantage, Piece Activity, Open Files, Bishop vs Knight, Improving the Worst Piece, Good Knight vs Bad Bishop, Control of Key Squares, King Safety, Doubled Pawns, Isolated Pawns, Hanging Pawns, Backward Pawns, Pawn Majorities, Pawn Chains, Minority Attack, Pawn Levers, Fixed Weaknesses, Creating a Plan, Prophylaxis, Maneuvering Pieces, Transition to Endgame, Exchanging Pieces, Avoiding Exchanges, Opposite Side Castling, Centralization, Attacking the King, Attacking the Center, Exploiting Open Lines, Principle of Two Weaknesses, Overprotection, Domination, Restriction, Blockade, Initiative, Tempo, Color Complexes, Asymmetrical Positions, Flank Attacks, Strong vs Weak Color Bishops, Accumulating Advantages, Trade Evaluation, Transition from Tactics to Strategy, Opposition, Distant Opposition, Shouldering, Lucena Position, Philidor Position, Vancura Defense, Cutting Off the King, Checking from Behind, Active Rook vs Passive Rook, Bishop of Wrong Color, Knight Maneuvering, Bishop vs Knight, Same Color Bishop Endgames, Opposite Color Bishop Endgames, Fortresses, Outside Passed Pawn, Passed Pawn Principle, Triangulation, Zugzwang, Breakthrough, Corresponding Squares, Don't Rush, Convert One Advantage, Avoid Unnecessary Pawn Moves, Keep Rooks Active, Centralize King Early, Avoid Traps in Simpler Positions
   
   b. Write a detailed explanation of *why* this is a weakness, explaining the long-term positional or strategic consequences.
   
   c. **RIGOROUS EXAMPLE ANALYSIS:** Provide EXACTLY 2 concrete examples from the games with COMPUTER-LEVEL ACCURACY:
      - Use actual game IDs (not "Game 1")
      - Include exact move number and notation (e.g., "15...g5?!")
      - **CRITICAL**: Only analyze moves that are genuinely inferior by significant margin (0.5+ pawns)
      - **BALANCED APPROACH**: Analyze strategic/positional mistakes while avoiding forced moves
      - **FOCUS ON STRATEGIC ERRORS**: Look for genuine positional mistakes, planning errors, weak squares, poor pawn structure decisions
      - **AVOID FORCED MOVES**: Skip obvious recaptures and piece-saving moves, but DO analyze strategic choices
      - **VARIETY REQUIRED**: Don't just analyze queen exchanges - find diverse strategic mistakes
      - **POSITIONAL FOCUS**: Pawn structure errors, piece placement mistakes, king safety issues, strategic planning failures
      - Verify each "mistake" meets evaluation criteria before including it
      - **PLAYER VERIFICATION**: Confirm you're analyzing the USER's move, not opponent's
   
   d. **SUPERIOR MOVE RECOMMENDATIONS with ENGINE-LEVEL ACCURACY:**
      - **CRITICAL CONTEXT**: You receive the FEN position that existed just BEFORE the user played their move
      - **REPLACEMENT LOGIC**: In this given FEN position, what move should the user have played INSTEAD?
      - **MOVE VALIDATION**: Every suggested move MUST be legal in the provided FEN position
      - **NEVER suggest moves that**:
        * Assume pieces have moved from their positions in the given FEN
        * Require pieces to be on squares they're not actually on in the FEN
        * Are based on a different board position than the one provided
      - **ALWAYS verify your suggestion**:
        * Check that all pieces needed for your move exist in the correct squares in the FEN
        * Confirm the move is actually legal from the given position
        * Calculate the resulting position after your suggested move
      - Provide specific move in algebraic notation (e.g., "15...Nd7!" or "20.Rb1!")
      - **VERIFICATION PROCESS**: Before suggesting any move, mentally place the board according to the FEN and confirm your move is legal
      - Explain concrete advantages: material gain, positional improvement, tactical themes
      - **VERIFICATION REQUIRED**: Ensure recommended move is genuinely superior
      - Calculate consequences 2-3 moves deep to verify soundness
      - Example format: "15...Nd7! (+0.7) - Controls e5, prepares f6-f5 pawn storm, while 15...g5?! (-0.4) weakens kingside and allows tactical shots"
      
   **MOVE RECOMMENDATION STANDARDS:**
   - Calculate evaluation changes: Show why suggested move is superior (e.g., +0.6 pawns)
   - Verify tactical soundness: No hanging pieces, no tactical vulnerabilities  
   - Confirm strategic logic: Better piece coordination, improved pawn structure, or tactical motifs
   - Double-check consequences: Ensure recommendation doesn't create new weaknesses

   e. **Technical Improvement Suggestion:** Provide ONE concise, technical line using advanced chess concepts. Reference specific games and use master principles with exact applications. No generic advice, no elaboration, no step-by-step instructions.
   
   Examples of required format:
   - "Apply Kasparov's principle: when you have a light-squared bishop on g7, your knight belongs on d7 to support the e5 break, not on f6."
   - "Use Dvoretsky's method: control the outpost square before executing the pawn break."
   - "Apply Capablanca's rook principle: in rook endgames, activity trumps material - keep your rook on the 7th rank or active files."
   
   FORBIDDEN: Multiple questions, step-by-step instructions, basic advice, or any elaboration beyond one technical line.

3. **Middlegame Mastery Focus:**
   a. Analyze the player's typical middlegame plans. Are they coherent? Do they correctly identify which side of the board to play on?
   
   b. Identify one key middlegame concept they need to study, based on their mistakes - Clearance, Quiet Move, Weak Squares, Pawn Breaks, Space Advantage, Piece Activity, Open Files, Bishop vs Knight, Improving the Worst Piece, Good Knight vs Bad Bishop, Control of Key Squares, King Safety, Doubled Pawns, Isolated Pawns, Hanging Pawns, Backward Pawns, Pawn Majorities, Pawn Chains, Minority Attack, Pawn Levers, Fixed Weaknesses, Creating a Plan, Prophylaxis, Maneuvering Pieces, Transition to Endgame, Exchanging Pieces, Avoiding Exchanges, Opposite Side Castling, Centralization, Attacking the King, Attacking the Center, Exploiting Open Lines, Principle of Two Weaknesses, Overprotection, Domination, Restriction, Blockade, Initiative, Tempo, Color Complexes, Asymmetrical Positions, Flank Attacks, Strong vs Weak Color Bishops, Accumulating Advantages, Trade Evaluation, Transition from Tactics to Strategy

4. **Endgame Technique Review:**
   a. Assess the player's technique in the endgame phases of the provided games. Are they confident in converting advantages? Do they defend well in difficult endgames?
   
   b. Pinpoint one specific endgame skill to practice (e.g., Opposition, Distant Opposition, Shouldering, Lucena Position, Philidor Position, Vancura Defense, Cutting Off the King, Checking from Behind, Active Rook vs Passive Rook, Bishop of Wrong Color, Knight Maneuvering, Bishop vs Knight, Same Color Bishop Endgames, Opposite Color Bishop Endgames, Fortresses, Outside Passed Pawn, Passed Pawn Principle, Triangulation, Zugzwang, Breakthrough, Corresponding Squares, Don't Rush, Convert One Advantage, Avoid Unnecessary Pawn Moves, Keep Rooks Active, Centralize King Early, Avoid Traps in Simpler Positions

Please provide the analysis in the following JSON format:
{
  "recurringWeaknesses": [
    {
      "title": "weakness title",
      "description": "detailed description of the weakness",
      "frequency": number,
      "examples": [
        {
          "gameId": "actual game ID from the game data above",
          "moveNumber": number,
          "position": "brief position description",
          "mistake": "what the player did wrong - include the actual move played (e.g., '15...g5?! - weakens the kingside')",
          "betterMove": "specific move in algebraic notation with brief explanation (e.g., '15...Nd7! - prepares e5 break while defending')"
        }
        // CRITICAL: Provide EXACTLY 2 examples per weakness - no more, no less
      ],
      "improvementSuggestion": "highly technical, advanced advice using chess jargon and master principles - NO basic advice",
      "technicalImprovement": "highly specific technical method using advanced chess concepts and master principles"
    }
  ],
  "middlegameAnalysis": {
    "overallRating": number (1-10),
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2", "weakness3"],
    "patterns": {
      "positionalUnderstanding": number (1-10),
      "tacticalAwareness": number (1-10),
      "planFormation": number (1-10),
      "pieceCoordination": number (1-10)
    },
    "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
    "examplePositions": [
      {
        "gameId": "actual game ID from the game data above",
        "position": "position description",
        "analysis": "detailed analysis",
        "suggestion": "improvement suggestion"
      }
    ]
  },
  "endgameAnalysis": {
    "overallRating": number (1-10),
    "strengths": ["strength1", "strength2", "strength3"],
    "weaknesses": ["weakness1", "weakness2", "weakness3"],
    "commonMistakes": ["mistake1", "mistake2", "mistake3"],
    "endgameTypes": [
      {
        "type": "endgame type",
        "performance": number (1-10),
        "gamesPlayed": number,
        "successRate": number (percentage)
      }
    ],
    "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
    "studyMaterial": ["study material1", "study material2", "study material3"],
    "examplePositions": [
      {
        "gameId": "actual game ID from the game data above",
        "endgameType": "type of endgame",
        "position": "position description",
        "analysis": "detailed analysis",
        "correctPlay": "correct continuation"
      }
    ]
  }
}

Output Style Requirements:
- Make the language coach-like and natural, so that it reads like it was written by a world-renowned Grandmaster coach
- Keep the tone encouraging but direct—remember this will be shared with the student and their parents
- Do not mention AI or that this report was auto-generated
- Tailor the analysis to the player's actual rating level—provide sophisticated insights appropriate for their strength
- Use the psychological insight approach that uncovers flawed thinking patterns
- Focus on POSITIONAL chess mistakes that players above 1300-2600 struggle with, not tactical blunders

CRITICAL: Focus on POSITIONAL chess mistakes and strategic concepts. Provide detailed explanations of why certain moves are mistakes and suggest superior plans with future ideas.

TECHNICAL IMPROVEMENT REQUIREMENTS:
- MANDATORY: Base every suggestion on specific patterns from their actual games
- Reference exact game numbers, move numbers, and positions from their PGN data
- Use advanced chess terminology and jargon appropriately for 1500+ FIDE level
- Reference specific methods from chess masters (Dvoretsky, Silman, Nimzowitsch, Karpov, Petrosian, Capablanca, Kasparov, etc.)
- Provide concrete evaluation criteria and calculation methods
- Give sophisticated technical advice that 1500+ rated players can implement
- FORBIDDEN: Generic suggestions like "think about your moves", "analyze the position", "improve your planning", "be careful", "look for tactics", "study more", "practice calculating", "consider your options", "evaluate the position", "make better moves"
- REQUIRED: Reference specific master principles (Nimzowitsch's centralization, Dvoretsky's calculation method, Silman's imbalances, Karpov's prophylaxis, Petrosian's exchanges, Capablanca's endgame technique)
- IMPROVEMENT SUGGESTIONS FORMAT: Provide exactly ONE concise technical line. NO elaboration, NO multiple questions, NO step-by-step instructions, NO justification beyond the main principle
- Focus on systematic approaches and advanced concepts with specific implementation methods
- Include specific piece maneuvering techniques with game references
- Reference positional principles with their tactical implementations
- Every weakness must be supported by at least 3 concrete examples from their games
- Every improvement suggestion must reference specific games where they made these mistakes
- Use advanced chess jargon: zugzwang, zwischenzug, luft, fianchetto, minority attack, pawn storm, space advantage, color complex, outpost, backward pawn, isolated pawn pair, hanging pawns, pawn majority, piece activity, initiative, tempo, overprotection, blockade, restriction

**FINAL VERIFICATION CHECKLIST - MANDATORY BEFORE SUBMITTING ANALYSIS:**

1. **ANALYSIS VARIETY CHECK**: 
   - **NOT just queen exchanges**: Examples should include diverse strategic mistakes
   - **STRATEGIC FOCUS**: Pawn structure, piece placement, king safety, planning errors
   - **AVOID OVER-FILTERING**: Don't be so cautious that you only show "safe" forced moves
   - **GENUINE MISTAKES**: Look for real strategic errors where player had better alternatives

2. **TACTICAL VERIFICATION**: Every recommended move has been checked for:
   - No hanging pieces or material loss
   - **FORCED MOVE CHECK**: Is this move a mandatory recapture? (If yes, don't suggest alternatives!)
   - **SEQUENCE CONTEXT**: Is this move part of a forced sequence (queen trade, etc.)?
   - **PIECE SAFETY PRIORITY**: If original move saved an attacked piece, alternative must also save it!
   - **Queen Safety**: Never suggest alternatives when Queen was under attack unless they win material
   - **RECAPTURE RULE**: Never criticize logical recaptures - they're usually mandatory!
   - No tactical vulnerabilities (pins, forks, skewers)
   - No back-rank weaknesses or mating threats
   - Verified 2-3 moves deep for tactical soundness
   - **FUNDAMENTAL CHECK**: When a piece is attacked, moving it is usually correct!
   - **PLAYER CONTEXT**: Confirming I'm analyzing the USER's move, not the opponent's move
   - **POSITION CONTEXT CHECK**: Am I suggesting alternatives from the position BEFORE the user's move, not after?

2. **EVALUATION ACCURACY**: Every identified "mistake" meets these criteria:
   - Objectively inferior by minimum 0.5 pawns
   - Not a reasonable practical choice under time pressure
   - Not a valid alternative approach to the position
   - Creates concrete disadvantages (material, positional, or tactical)

3. **RECOMMENDATION QUALITY**: Every suggested "better move":
   - Is genuinely superior by measurable margin
   - Serves a concrete strategic purpose
   - Doesn't create new weaknesses
   - Is practical and human-playable at 1500+ level

4. **PATTERN RECOGNITION**: Focus on patterns that separate 1500 from 2000+ players:
   - Advanced pawn structure understanding
   - Sophisticated piece coordination
   - Prophylactic thinking
   - Transition between game phases
   - Complex positional evaluation

CRITICAL: You are analyzing a 1500+ FIDE rated player. They already know basic principles. Provide Stockfish-level accurate analysis with practical, human-understandable explanations.
`;

    try {
      const response = await this.generateWithPrompt(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from Gemini');
      }
      
      const unifiedAnalysis = JSON.parse(jsonMatch[0]);
      
      // Enhance recurring weaknesses with FEN positions
      console.log('=== FEN ENHANCEMENT START (Unified Analysis) ===');
      console.log('Available game IDs:', games.map(g => g.id));
      console.log('Number of weaknesses:', unifiedAnalysis.recurringWeaknesses.length);
      
      // Enhance each weakness example with FEN positions
      for (let w = 0; w < unifiedAnalysis.recurringWeaknesses.length; w++) {
        const weakness = unifiedAnalysis.recurringWeaknesses[w];
        console.log(`Processing weakness ${w + 1}: ${weakness.title}`);
        console.log(`This weakness has ${weakness.examples.length} examples`);
        
        for (let e = 0; e < weakness.examples.length; e++) {
          const example = weakness.examples[e];
          console.log(`--- Example ${e + 1} ---`);
          console.log('Looking for game with ID:', example.gameId);
          console.log('Move number:', example.moveNumber);
          
          const game = games.find(g => g.id === example.gameId);
          console.log('Game found:', !!game);
          
          if (!game) {
            console.log(`Game ${example.gameId} not found!`);
            console.log('Available game IDs:', games.map(g => g.id));
            // Try to find by partial match or different formatting
            const partialMatch = games.find(g => 
              g.id.includes(example.gameId) || example.gameId.includes(g.id)
            );
            if (partialMatch) {
              console.log(`Found partial match: ${partialMatch.id} for requested ${example.gameId}`);
              const fenResult = this.getFenAtMove(partialMatch.pgn, example.moveNumber, example.gameId, username);
              const playerInfo = this.getPlayerInfo(partialMatch.pgn, example.moveNumber, example.gameId, username);
              if (fenResult) {
                example.fenPosition = fenResult.fen;
                example.lastMove = fenResult.lastMove;
                example.fromSquare = fenResult.fromSquare;
                example.toSquare = fenResult.toSquare;
                if (playerInfo) {
                  example.playerColor = playerInfo.playerColor;
                  example.whitePlayer = playerInfo.whitePlayer;
                  example.blackPlayer = playerInfo.blackPlayer;
                }
                
                // Validate the better move recommendation
                this.validateAndFixMoveRecommendation(example, fenResult.fen);
              }
            } else {
              // Add a test FEN to the first example just to verify the chessboard works
              if (w === 0 && e === 0) {
                console.log('Adding test FEN to first example');
                example.fenPosition = "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3";
              }
            }
          } else {
            console.log(`Found game ${example.gameId}`);
            if (game.pgn) {
              console.log(`Extracting FEN for move ${example.moveNumber} in game ${example.gameId}`);
              const fenResult = this.getFenAtMove(game.pgn, example.moveNumber, example.gameId, username);
              const playerInfo = this.getPlayerInfo(game.pgn, example.moveNumber, example.gameId, username);
              console.log(`Extracted FEN for ${example.gameId}:`, fenResult);
              if (fenResult) {
                example.fenPosition = fenResult.fen;
                example.lastMove = fenResult.lastMove;
                example.fromSquare = fenResult.fromSquare;
                example.toSquare = fenResult.toSquare;
                if (playerInfo) {
                  example.playerColor = playerInfo.playerColor;
                  example.whitePlayer = playerInfo.whitePlayer;
                  example.blackPlayer = playerInfo.blackPlayer;
                }
                
                // Validate the better move recommendation
                this.validateAndFixMoveRecommendation(example, fenResult.fen);
              }
            } else {
              console.log(`Game ${example.gameId} has no PGN data`);
            }
          }
        }
      }
      
      console.log('=== FEN ENHANCEMENT COMPLETE ===');
      // Log final state
      let totalExamples = 0;
      let examplesWithFen = 0;
      unifiedAnalysis.recurringWeaknesses.forEach((weakness: any) => {
        weakness.examples.forEach((example: any) => {
          totalExamples++;
          if (example.fenPosition) {
            examplesWithFen++;
          }
        });
      });
      console.log(`Total examples: ${totalExamples}, Examples with FEN: ${examplesWithFen}`);
      
      return unifiedAnalysis;
    } catch (error) {
      console.error('Error generating unified analysis:', error);
      throw new ReportGenerationError(
        'Failed to generate unified analysis',
        'AI_ERROR',
        error
      );
    }
  }
}

export const geminiService = new GeminiService();
