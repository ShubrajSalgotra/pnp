import { Chess } from 'chess.js';
import { ChessGame } from '../types/game';

export interface GamePosition {
  gameId: string;
  moveNumber: number;
  ply: number;
  move: string;
  fen: string;
  turn: 'white' | 'black';
  isUserMove: boolean;
  userColor?: 'white' | 'black';
}

export interface GameFenData {
  gameId: string;
  gameInfo: {
    white: string;
    black: string;
    result: string;
    date: string;
    opening: string;
    timeControl: string;
    site: string;
  };
  positions: GamePosition[];
  totalMoves: number;
  userColor?: 'white' | 'black';
}

export interface AllGamesFenData {
  username: string;
  totalGames: number;
  extractedAt: string;
  games: GameFenData[];
}

class FenExtractor {
  /**
   * Extract all FEN positions from a single chess game
   */
  extractGamePositions(game: ChessGame, username?: string): GameFenData | null {
    try {
      console.log(`[FenExtractor] Processing game ${game.id}...`);
      
      const chess = new Chess();
      
      // Try to load the PGN
      try {
        chess.loadPgn(game.pgn);
      } catch (pgnError) {
        console.error(`[FenExtractor] Failed to load PGN for game ${game.id}:`, pgnError);
        return null;
      }
      
      // Get the move history
      const history = chess.history({ verbose: true });
      
      if (history.length === 0) {
        console.log(`[FenExtractor] No moves found in game ${game.id}`);
        return null;
      }
      
      // Determine user color if username provided
      let userColor: 'white' | 'black' | undefined;
      if (username) {
        const whitePlayer = game.white.name.toLowerCase();
        const blackPlayer = game.black.name.toLowerCase();
        const usernameLower = username.toLowerCase();
        
        if (whitePlayer.includes(usernameLower) || usernameLower.includes(whitePlayer)) {
          userColor = 'white';
        } else if (blackPlayer.includes(usernameLower) || usernameLower.includes(blackPlayer)) {
          userColor = 'black';
        }
      }
      
      // Reset chess board and extract positions for each move
      chess.reset();
      const positions: GamePosition[] = [];
      
      // Add starting position
      positions.push({
        gameId: game.id,
        moveNumber: 0,
        ply: 0,
        move: 'start',
        fen: chess.fen(),
        turn: 'white',
        isUserMove: false,
        userColor
      });
      
      // Extract position after each move
      for (let i = 0; i < history.length; i++) {
        const move = history[i];
        
        // Make the move
        chess.move(move.san);
        
        const moveNumber = Math.floor(i / 2) + 1;
        const ply = i + 1;
        const turn: 'white' | 'black' = chess.turn() === 'w' ? 'white' : 'black';
        const isWhiteMove = i % 2 === 0;
        
        // Determine if this is user's move
        let isUserMove = false;
        if (userColor) {
          isUserMove = (userColor === 'white' && isWhiteMove) || (userColor === 'black' && !isWhiteMove);
        }
        
        positions.push({
          gameId: game.id,
          moveNumber,
          ply,
          move: move.san,
          fen: chess.fen(),
          turn,
          isUserMove,
          userColor
        });
      }
      
      console.log(`[FenExtractor] Extracted ${positions.length} positions from game ${game.id}`);
      
      return {
        gameId: game.id,
        gameInfo: {
          white: game.white.name,
          black: game.black.name,
          result: game.result,
          date: game.date,
          opening: game.opening.name,
          timeControl: game.timeControl,
          site: game.site
        },
        positions,
        totalMoves: history.length,
        userColor
      };
      
    } catch (error) {
      console.error(`[FenExtractor] Error processing game ${game.id}:`, error);
      return null;
    }
  }
  
  /**
   * Extract FEN positions from all games
   */
  extractAllGamesPositions(games: ChessGame[], username?: string): AllGamesFenData {
    console.log(`[FenExtractor] Starting extraction for ${games.length} games...`);
    
    const extractedGames: GameFenData[] = [];
    let successfulExtractions = 0;
    let failedExtractions = 0;
    
    for (const game of games) {
      const gameData = this.extractGamePositions(game, username);
      if (gameData) {
        extractedGames.push(gameData);
        successfulExtractions++;
      } else {
        failedExtractions++;
      }
    }
    
    console.log(`[FenExtractor] Extraction complete:`);
    console.log(`  - Successful: ${successfulExtractions} games`);
    console.log(`  - Failed: ${failedExtractions} games`);
    console.log(`  - Total positions: ${extractedGames.reduce((sum, game) => sum + game.positions.length, 0)}`);
    
    return {
      username: username || 'unknown',
      totalGames: extractedGames.length,
      extractedAt: new Date().toISOString(),
      games: extractedGames
    };
  }
  
  /**
   * Get only user's move positions for analysis
   */
  getUserMovePositions(allData: AllGamesFenData): GamePosition[] {
    const userPositions: GamePosition[] = [];
    
    for (const game of allData.games) {
      const gameUserPositions = game.positions.filter(pos => pos.isUserMove);
      userPositions.push(...gameUserPositions);
    }
    
    console.log(`[FenExtractor] Found ${userPositions.length} user move positions across all games`);
    return userPositions;
  }
  
  /**
   * Get positions before user moves (for analysis and alternative suggestions)
   */
  getPositionsBeforeUserMoves(allData: AllGamesFenData): Array<{
    gameId: string;
    moveNumber: number;
    ply: number;
    positionBeforeMove: string;
    userMove: string;
    userColor: 'white' | 'black';
  }> {
    const analysisPositions: Array<{
      gameId: string;
      moveNumber: number;
      ply: number;
      positionBeforeMove: string;
      userMove: string;
      userColor: 'white' | 'black';
    }> = [];
    
    for (const game of allData.games) {
      if (!game.userColor) continue;
      
      for (let i = 1; i < game.positions.length; i++) {
        const currentPosition = game.positions[i];
        const previousPosition = game.positions[i - 1];
        
        if (currentPosition.isUserMove) {
          analysisPositions.push({
            gameId: game.gameId,
            moveNumber: currentPosition.moveNumber,
            ply: currentPosition.ply,
            positionBeforeMove: previousPosition.fen,
            userMove: currentPosition.move,
            userColor: game.userColor
          });
        }
      }
    }
    
    console.log(`[FenExtractor] Found ${analysisPositions.length} positions before user moves for analysis`);
    return analysisPositions;
  }
}

export const fenExtractor = new FenExtractor();