import React from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ChessGame } from '../types/game';
import { fenExtractor } from '../utils/fenExtractor';

interface FenExtractionTestProps {
  games: ChessGame[];
  username?: string | null;
}

const FenExtractionTest: React.FC<FenExtractionTestProps> = ({ games, username }) => {
  const handleTestFenExtraction = () => {
    if (games.length === 0) {
      console.log('❌ [FEN TEST] No games available for testing');
      return;
    }

    console.log('🧪 [FEN TEST] === TESTING FEN EXTRACTION ON EXISTING GAMES ===');
    console.log(`📊 [FEN TEST] Testing with ${games.length} games for username: ${username || 'unknown'}`);

    // Extract FEN positions from all games
    const allGamesFenData = fenExtractor.extractAllGamesPositions(games, username || undefined);

    // Display comprehensive results
    console.log('🎯 [FEN TEST] === EXTRACTION RESULTS ===');
    console.log('📈 [FEN TEST] Summary:', {
      username: allGamesFenData.username,
      totalGames: allGamesFenData.totalGames,
      extractedAt: allGamesFenData.extractedAt,
      totalPositions: allGamesFenData.games.reduce((sum, game) => sum + game.positions.length, 0)
    });

    // Display first game in detail
    if (allGamesFenData.games.length > 0) {
      const firstGame = allGamesFenData.games[0];
      console.log('🏆 [FEN TEST] === DETAILED VIEW OF FIRST GAME ===');
      console.log('🎯 [FEN TEST] Game Info:', firstGame.gameInfo);
      console.log('⚡ [FEN TEST] User Color:', firstGame.userColor);
      console.log('📍 [FEN TEST] Total Positions:', firstGame.positions.length);
      console.log('🎮 [FEN TEST] First 5 Positions:');
      
      firstGame.positions.slice(0, 5).forEach((pos, index) => {
        console.log(`  Position ${index + 1}:`);
        console.log(`    Move: ${pos.move} (${pos.turn} to play)`);
        console.log(`    FEN: ${pos.fen}`);
        console.log(`    User Move: ${pos.isUserMove ? 'YES' : 'NO'}`);
        console.log('    ---');
      });
    }

    // Extract user move positions
    const userMovePositions = fenExtractor.getUserMovePositions(allGamesFenData);
    console.log('👤 [FEN TEST] === USER MOVE POSITIONS ===');
    console.log(`🎯 [FEN TEST] Found ${userMovePositions.length} user move positions`);
    
    if (userMovePositions.length > 0) {
      console.log('🧠 [FEN TEST] First 3 User Moves:');
      userMovePositions.slice(0, 3).forEach((pos, index) => {
        console.log(`  User Move ${index + 1}:`);
        console.log(`    Game: ${pos.gameId}`);
        console.log(`    Move ${pos.moveNumber}: ${pos.move}`);
        console.log(`    FEN after move: ${pos.fen}`);
        console.log(`    Playing as: ${pos.userColor}`);
        console.log('    ---');
      });
    }

    // Extract analysis positions
    const analysisPositions = fenExtractor.getPositionsBeforeUserMoves(allGamesFenData);
    console.log('🔍 [FEN TEST] === ANALYSIS POSITIONS (BEFORE USER MOVES) ===');
    console.log(`🎯 [FEN TEST] Found ${analysisPositions.length} positions for analysis`);
    
    if (analysisPositions.length > 0) {
      console.log('🧠 [FEN TEST] First 3 Analysis Positions:');
      analysisPositions.slice(0, 3).forEach((pos, index) => {
        console.log(`  Analysis Position ${index + 1}:`);
        console.log(`    Game: ${pos.gameId}`);
        console.log(`    Move ${pos.moveNumber} - User played: ${pos.userMove} as ${pos.userColor}`);
        console.log(`    FEN before user's move: ${pos.positionBeforeMove}`);
        console.log('    ---');
      });
    }

    console.log('✅ [FEN TEST] FEN extraction test completed!');
    console.log('🎯 [FEN TEST] Check console above for detailed results');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>FEN Extraction Testing</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Test FEN position extraction on your existing games. This will extract every position 
            from every move and display the results in the browser console.
          </p>
          
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTestFenExtraction}
              disabled={games.length === 0}
            >
              Test FEN Extraction ({games.length} games)
            </Button>
            
            {games.length === 0 && (
              <span className="text-sm text-gray-500">
                Import some games first to test FEN extraction
              </span>
            )}
          </div>
          
          {username && (
            <p className="text-xs text-blue-600">
              Testing with detected username: <strong>{username}</strong>
            </p>
          )}
          
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <strong>What this test does:</strong>
            <ul className="mt-1 space-y-1">
              <li>• Extracts every FEN position from every move in all games</li>
              <li>• Identifies which moves are yours vs opponent's</li>
              <li>• Shows positions before your moves (for analysis)</li>
              <li>• Displays detailed JSON data in browser console</li>
              <li>• Prepares data for enhanced Gemini AI analysis</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FenExtractionTest;