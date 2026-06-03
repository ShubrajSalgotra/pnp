import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Brain
} from 'lucide-react';
import { GameAnalysis, MoveAnalysis } from '../types/analysis';
import { ChessGame } from '../types/game';

interface GameViewerProps {
  game: ChessGame;
  analysis?: GameAnalysis;
  onClose: () => void;
}

const GameViewer: React.FC<GameViewerProps> = ({ game, analysis, onClose }) => {
  const [chess] = useState(new Chess());
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [gameHistory, setGameHistory] = useState<any[]>([]);

  useEffect(() => {
    // Load the game
    chess.reset();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    setGameHistory(history);
    
    // Reset to starting position
    chess.reset();
    setCurrentMoveIndex(-1);
  }, [game.pgn, chess]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && currentMoveIndex < gameHistory.length - 1) {
      interval = setInterval(() => {
        setCurrentMoveIndex(prev => {
          if (prev >= gameHistory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, currentMoveIndex, gameHistory.length]);

  useEffect(() => {
    // Update board position based on current move
    chess.reset();
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (gameHistory[i]) {
        chess.move(gameHistory[i]);
      }
    }
  }, [currentMoveIndex, gameHistory, chess]);

  const getCurrentMove = (): MoveAnalysis | undefined => {
    if (!analysis || currentMoveIndex < 0) return undefined;
    return analysis.moves[currentMoveIndex];
  };

  const getClassificationColor = (classification: MoveAnalysis['classification']) => {
    switch (classification) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'inaccuracy': return 'bg-yellow-100 text-yellow-800';
      case 'mistake': return 'bg-orange-100 text-orange-800';
      case 'blunder': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClassificationIcon = (classification: MoveAnalysis['classification']) => {
    switch (classification) {
      case 'excellent': return <Target className="w-4 h-4" />;
      case 'good': return <TrendingUp className="w-4 h-4" />;
      case 'inaccuracy': return <AlertCircle className="w-4 h-4" />;
      case 'mistake': return <AlertTriangle className="w-4 h-4" />;
      case 'blunder': return <TrendingDown className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const formatEvaluation = (evaluation: number) => {
    if (evaluation > 0) return `+${(evaluation / 100).toFixed(1)}`;
    return (evaluation / 100).toFixed(1);
  };

  const goToMove = (moveIndex: number) => {
    setCurrentMoveIndex(Math.max(-1, Math.min(moveIndex, gameHistory.length - 1)));
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (currentMoveIndex >= gameHistory.length - 1) {
      setCurrentMoveIndex(-1);
    }
    setIsPlaying(!isPlaying);
  };

  const currentMove = getCurrentMove();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Game Viewer</h2>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chess Board */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span>{game.white.name} vs {game.black.name}</span>
                  {game.result && (
                    <Badge variant="outline">{game.result}</Badge>
                  )}
                </CardTitle>
                <Button
                  onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-square max-w-lg mx-auto">
                <Chessboard
                  options={{
                    position: chess.fen(),
                    boardOrientation: boardOrientation,
                    allowDragging: false,
                    boardStyle: {
                      borderRadius: '4px',
                      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
                    }
                  }}
                />
              </div>

              {/* Playback Controls */}
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    onClick={() => goToMove(-1)}
                    variant="outline"
                    size="sm"
                    disabled={currentMoveIndex <= -1}
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => goToMove(currentMoveIndex - 1)}
                    variant="outline"
                    size="sm"
                    disabled={currentMoveIndex <= -1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={togglePlayback}
                    variant="outline"
                    size="sm"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={() => goToMove(currentMoveIndex + 1)}
                    variant="outline"
                    size="sm"
                    disabled={currentMoveIndex >= gameHistory.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => goToMove(gameHistory.length - 1)}
                    variant="outline"
                    size="sm"
                    disabled={currentMoveIndex >= gameHistory.length - 1}
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-center text-sm text-gray-600">
                  Move {currentMoveIndex + 1} of {gameHistory.length}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Panel */}
        <div className="space-y-4">
          {/* Current Move Analysis */}
          {currentMove && analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current Move Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {currentMove.moveNumber}{currentMoveIndex % 2 === 0 ? '.' : '...'} {currentMove.move}
                  </span>
                  <Badge className={getClassificationColor(currentMove.classification)}>
                    {getClassificationIcon(currentMove.classification)}
                    <span className="ml-1 capitalize">{currentMove.classification}</span>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Evaluation:</span>
                    <span className="font-medium">{formatEvaluation(currentMove.evaluation)}</span>
                  </div>
                  
                  {currentMove.centipawnLoss > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Centipawn Loss:</span>
                      <span className="font-medium text-red-600">{currentMove.centipawnLoss}</span>
                    </div>
                  )}

                  {currentMove.bestMove && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Best Move:</span>
                      <span className="font-medium font-mono">{currentMove.bestMove}</span>
                    </div>
                  )}
                </div>

                {currentMove.comment && (
                  <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                    {currentMove.comment}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Game Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Game Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">White</div>
                  <div className="font-medium">{game.white.name}</div>
                  <div className="text-gray-500">({game.white.rating})</div>
                </div>
                <div>
                  <div className="text-gray-600">Black</div>
                  <div className="font-medium">{game.black.name}</div>
                  <div className="text-gray-500">({game.black.rating})</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Time Control</div>
                  <div className="font-medium">{game.timeControl}</div>
                </div>
                <div>
                  <div className="text-gray-600">Date</div>
                  <div className="font-medium">{new Date(game.date).toLocaleDateString()}</div>
                </div>
              </div>

              {analysis && (
                <div className="pt-3 border-t">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">White Accuracy</div>
                      <div className="font-medium">{analysis.whiteAccuracy}%</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Black Accuracy</div>
                      <div className="font-medium">{analysis.blackAccuracy}%</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Move List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Move List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {gameHistory.map((move, index) => {
                  const moveAnalysis = analysis?.moves[index];
                  const isCurrentMove = index === currentMoveIndex;
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isCurrentMove 
                          ? 'bg-blue-100 border border-blue-300' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => goToMove(index)}
                    >
                      <span className="font-mono text-sm">
                        {Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '...'} {move.san}
                      </span>
                      {moveAnalysis && (
                        <Badge 
                          className={`${getClassificationColor(moveAnalysis.classification)} text-xs`}
                          variant="outline"
                        >
                          {getClassificationIcon(moveAnalysis.classification)}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GameViewer;