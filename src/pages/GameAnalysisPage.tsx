import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import GameImport from '../components/GameImport';
import GamesList from '../components/GamesList';
import AnalysisProgress from '../components/AnalysisProgress';
import AnalysisResults from '../components/AnalysisResults';
import AnalysisSettings, { AnalysisConfig } from '../components/AnalysisSettings';
import GameViewer from '../components/GameViewer';
import FenExtractionTest from '../components/FenExtractionTest';
import { ChessGame } from '../types/game';
import { GameAnalysis } from '../types/analysis';
import { useAuth } from '../contexts/AuthContext';
import { analysisEngineService } from '../services/analysisEngine';
import { fenExtractor } from '../utils/fenExtractor';

const GameAnalysisPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [games, setGames] = useState<ChessGame[]>([]);
  const [activeTab, setActiveTab] = useState('import');
  const [analyzingGameId, setAnalyzingGameId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<GameAnalysis | null>(null);
  const [analyses, setAnalyses] = useState<Map<string, GameAnalysis>>(new Map());
  const [importedUsername, setImportedUsername] = useState<string | null>(null);
  const [gameToAnalyze, setGameToAnalyze] = useState<ChessGame | null>(null);
  const [gameToView, setGameToView] = useState<ChessGame | null>(null);
  const [showAnalysisSettings, setShowAnalysisSettings] = useState(false);

  // Function to detect the most likely username from imported games
  const detectUsernameFromGames = (importedGames: ChessGame[]): string | null => {
    const playerCounts = new Map<string, number>();
    
    importedGames.forEach(game => {
      const whiteName = game.white.name.toLowerCase();
      const blackName = game.black.name.toLowerCase();
      
      playerCounts.set(whiteName, (playerCounts.get(whiteName) || 0) + 1);
      playerCounts.set(blackName, (playerCounts.get(blackName) || 0) + 1);
    });
    
    // Find the player who appears most frequently (likely the imported user)
    let mostFrequentPlayer = '';
    let maxCount = 0;
    
    playerCounts.forEach((count, player) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentPlayer = player;
      }
    });
    
    return mostFrequentPlayer || null;
  };

  // Load games and analyses from localStorage on component mount
  useEffect(() => {
    const savedGames = localStorage.getItem(`chess-games-${currentUser?.id}`);
    const savedAnalyses = localStorage.getItem(`chess-analyses-${currentUser?.id}`);
    const savedUsername = localStorage.getItem(`chess-username-${currentUser?.id}`);
    
    if (savedGames) {
      try {
        const loadedGames = JSON.parse(savedGames);
        setGames(loadedGames);
        
        // If no saved username but we have games, try to detect it
        if (!savedUsername && loadedGames.length > 0) {
          const detectedUsername = detectUsernameFromGames(loadedGames);
          setImportedUsername(detectedUsername);
        }
      } catch (error) {
        console.error('Error loading saved games:', error);
      }
    }
    
    if (savedAnalyses) {
      try {
        const analysesArray = JSON.parse(savedAnalyses);
        setAnalyses(new Map(analysesArray));
      } catch (error) {
        console.error('Error loading saved analyses:', error);
      }
    }
    
    if (savedUsername) {
      setImportedUsername(savedUsername);
    }
  }, [currentUser?.id]);

  // Save games to localStorage whenever games change
  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`chess-games-${currentUser.id}`, JSON.stringify(games));
    }
  }, [games, currentUser?.id]);

  // Save analyses to localStorage whenever analyses change
  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`chess-analyses-${currentUser.id}`, JSON.stringify(Array.from(analyses.entries())));
    }
  }, [analyses, currentUser?.id]);

  // Save importedUsername to localStorage whenever it changes
  useEffect(() => {
    if (currentUser?.id && importedUsername) {
      localStorage.setItem(`chess-username-${currentUser.id}`, importedUsername);
    }
  }, [importedUsername, currentUser?.id]);

  const handleGamesImported = (importedGames: ChessGame[]) => {
    // Filter out duplicate games
    const existingIds = new Set(games.map(g => g.id));
    const newGames = importedGames.filter(g => !existingIds.has(g.id));
    
    // Detect and set the imported username
    if (newGames.length > 0) {
      const detectedUsername = detectUsernameFromGames(newGames);
      setImportedUsername(detectedUsername);
      
      // Extract FEN positions from all imported games
      console.log('🔍 [FEN EXTRACTION] Starting FEN extraction for imported games...');
      console.log(`📊 [FEN EXTRACTION] Processing ${newGames.length} new games for user: ${detectedUsername}`);
      
      // Extract FEN positions from all games and display in console
      const allGamesFenData = fenExtractor.extractAllGamesPositions(newGames, detectedUsername || undefined);
      
      // Display comprehensive FEN data in console
      console.log('🎯 [FEN EXTRACTION] === COMPLETE FEN EXTRACTION RESULTS ===');
      console.log('📈 [FEN EXTRACTION] Summary:', {
        username: allGamesFenData.username,
        totalGames: allGamesFenData.totalGames,
        extractedAt: allGamesFenData.extractedAt,
        totalPositions: allGamesFenData.games.reduce((sum, game) => sum + game.positions.length, 0)
      });
      
      // Display detailed JSON for each game
      allGamesFenData.games.forEach((gameData, index) => {
        console.log(`🏆 [FEN EXTRACTION] Game ${index + 1} (${gameData.gameId}):`);
        console.log(`🎯 [FEN EXTRACTION] Game Info:`, gameData.gameInfo);
        console.log(`📍 [FEN EXTRACTION] Total Positions: ${gameData.positions.length}`);
        console.log(`⚡ [FEN EXTRACTION] User Color: ${gameData.userColor}`);
        console.log(`🎮 [FEN EXTRACTION] Full Game Positions (JSON):`, JSON.stringify(gameData, null, 2));
      });
      
      // Extract and display user's move positions for analysis
      const userMovePositions = fenExtractor.getUserMovePositions(allGamesFenData);
      console.log('👤 [FEN EXTRACTION] === USER MOVE POSITIONS FOR ANALYSIS ===');
      console.log(`🎯 [FEN EXTRACTION] Found ${userMovePositions.length} positions where user made moves`);
      console.log('📊 [FEN EXTRACTION] User Move Positions (JSON):', JSON.stringify(userMovePositions, null, 2));
      
      // Extract positions before user moves (for alternative move suggestions)
      const analysisPositions = fenExtractor.getPositionsBeforeUserMoves(allGamesFenData);
      console.log('🔍 [FEN EXTRACTION] === POSITIONS BEFORE USER MOVES (FOR ANALYSIS) ===');
      console.log(`🎯 [FEN EXTRACTION] Found ${analysisPositions.length} positions before user moves`);
      console.log('🧠 [FEN EXTRACTION] Analysis Positions (JSON):', JSON.stringify(analysisPositions, null, 2));
      
      // Sample display of first few positions with FEN strings
      if (analysisPositions.length > 0) {
        console.log('📋 [FEN EXTRACTION] === SAMPLE ANALYSIS POSITIONS ===');
        analysisPositions.slice(0, 5).forEach((pos, index) => {
          console.log(`🎯 [FEN EXTRACTION] Sample ${index + 1}:`);
          console.log(`  🏆 Game: ${pos.gameId}`);
          console.log(`  🎲 Move: ${pos.moveNumber}`);
          console.log(`  ⚡ User played: ${pos.userMove} as ${pos.userColor}`);
          console.log(`  📍 Position before move (FEN): ${pos.positionBeforeMove}`);
          console.log('---');
        });
      }
      
      console.log('✅ [FEN EXTRACTION] FEN extraction completed successfully!');
      console.log('🎯 [FEN EXTRACTION] This data can now be used for enhanced Gemini analysis');
    }
    
    setGames(prevGames => [...prevGames, ...newGames]);
    setActiveTab('games');
  };

  const handleDeleteGame = (gameId: string) => {
    setGames(prevGames => prevGames.filter(g => g.id !== gameId));
  };

  const handleAnalyzeGame = (game: ChessGame) => {
    setGameToAnalyze(game);
    setShowAnalysisSettings(true);
    setActiveTab('analysis');
  };

  const handleStartAnalysis = async (config: AnalysisConfig) => {
    if (!gameToAnalyze) return;
    
    setShowAnalysisSettings(false);
    setAnalyzingGameId(gameToAnalyze.id);
    
    try {
      const analysis = await analysisEngineService.analyzeGame({
        gameId: gameToAnalyze.id,
        pgn: gameToAnalyze.pgn,
        engine: config.engine,
        depth: config.depth
      });
      
      // Save analysis
      setAnalyses(prev => new Map(prev).set(gameToAnalyze.id, analysis));
      
      // Update game with analysis results
      setGames(prevGames => 
        prevGames.map(g => 
          g.id === gameToAnalyze.id 
            ? { 
                ...g, 
                analyzed: true, 
                accuracy: { 
                  white: analysis.whiteAccuracy, 
                  black: analysis.blackAccuracy 
                },
                mistakes: { 
                  blunders: analysis.totalMistakes.white.blunders + analysis.totalMistakes.black.blunders,
                  mistakes: analysis.totalMistakes.white.mistakes + analysis.totalMistakes.black.mistakes,
                  inaccuracies: analysis.totalMistakes.white.inaccuracies + analysis.totalMistakes.black.inaccuracies
                }
              }
            : g
        )
      );
      
      setCurrentAnalysis(analysis);
      setGameToAnalyze(null);
    } catch (error) {
      console.error('Analysis failed:', error);
      setGameToAnalyze(null);
    } finally {
      setAnalyzingGameId(null);
    }
  };

  const handleCancelAnalysis = () => {
    if (analyzingGameId) {
      analysisEngineService.clearAnalysisProgress(analyzingGameId);
    }
    setAnalyzingGameId(null);
    setShowAnalysisSettings(false);
    setGameToAnalyze(null);
    setActiveTab('games');
  };

  const handleAnalysisComplete = () => {
    // Analysis is handled in handleAnalyzeGame, just clean up
    setAnalyzingGameId(null);
  };

  const handleViewAnalysis = (game: ChessGame) => {
    const analysis = analyses.get(game.id);
    if (analysis) {
      setCurrentAnalysis(analysis);
      setActiveTab('analysis');
    }
  };

  const handleViewGame = (game: ChessGame) => {
    setGameToView(game);
    setActiveTab('viewer');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Game Analysis</h1>
        <p className="text-gray-600 mt-2">
          Import and analyze your chess games from Lichess and Chess.com
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="import">Import Games</TabsTrigger>
          <TabsTrigger value="games">My Games ({games.length})</TabsTrigger>
          {games.length > 0 && (
            <TabsTrigger value="fen-test">FEN Test</TabsTrigger>
          )}
          {(analyzingGameId || currentAnalysis || showAnalysisSettings) && (
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          )}
          {gameToView && (
            <TabsTrigger value="viewer">Game Viewer</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="import">
          <GameImport onGamesImported={handleGamesImported} />
        </TabsContent>

        <TabsContent value="games">
          <GamesList 
            games={games}
            onDeleteGame={handleDeleteGame}
            onAnalyzeGame={handleAnalyzeGame}
            onViewAnalysis={handleViewAnalysis}
            onViewGame={handleViewGame}
            analyses={analyses}
            currentUsername={importedUsername}
          />
        </TabsContent>

        <TabsContent value="fen-test">
          <FenExtractionTest 
            games={games}
            username={importedUsername}
          />
        </TabsContent>

        <TabsContent value="analysis">
          {showAnalysisSettings && gameToAnalyze && (
            <AnalysisSettings
              onStartAnalysis={handleStartAnalysis}
              onCancel={handleCancelAnalysis}
              isAnalyzing={!!analyzingGameId}
            />
          )}

          {analyzingGameId && !showAnalysisSettings && (
            <AnalysisProgress 
              gameId={analyzingGameId}
              onComplete={handleAnalysisComplete}
              onCancel={handleCancelAnalysis}
            />
          )}
          
          {currentAnalysis && !analyzingGameId && !showAnalysisSettings && (
            <AnalysisResults 
              analysis={currentAnalysis}
              onClose={() => {
                setCurrentAnalysis(null);
                setActiveTab('games');
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="viewer">
          {gameToView && (
            <GameViewer
              game={gameToView}
              analysis={analyses.get(gameToView.id)}
              onClose={() => {
                setGameToView(null);
                setActiveTab('games');
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GameAnalysisPage;