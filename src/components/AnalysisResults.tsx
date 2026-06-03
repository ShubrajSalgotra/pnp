import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  AlertCircle, 
  Target,
  ChevronRight,
  ChevronDown,
  Clock,
  Brain
} from 'lucide-react';
import { GameAnalysis, MoveAnalysis } from '../types/analysis';

interface AnalysisResultsProps {
  analysis: GameAnalysis;
  onClose: () => void;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ analysis, onClose }) => {
  const [expandedMoves, setExpandedMoves] = useState<Set<number>>(new Set());
  const [selectedTab, setSelectedTab] = useState<'overview' | 'moves' | 'critical'>('overview');

  const toggleMove = (moveNumber: number) => {
    const newExpanded = new Set(expandedMoves);
    if (newExpanded.has(moveNumber)) {
      newExpanded.delete(moveNumber);
    } else {
      newExpanded.add(moveNumber);
    }
    setExpandedMoves(newExpanded);
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

  const totalWhiteMistakes = analysis.totalMistakes.white.blunders + 
                            analysis.totalMistakes.white.mistakes + 
                            analysis.totalMistakes.white.inaccuracies;
  
  const totalBlackMistakes = analysis.totalMistakes.black.blunders + 
                            analysis.totalMistakes.black.mistakes + 
                            analysis.totalMistakes.black.inaccuracies;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Game Analysis</h2>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <Button
          variant={selectedTab === 'overview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </Button>
        <Button
          variant={selectedTab === 'moves' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('moves')}
        >
          Move Analysis
        </Button>
        <Button
          variant={selectedTab === 'critical' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('critical')}
        >
          Critical Moments
        </Button>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Accuracy Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  White Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{analysis.whiteAccuracy}%</span>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Total Mistakes</div>
                      <div className="text-lg font-semibold">{totalWhiteMistakes}</div>
                    </div>
                  </div>
                  <Progress value={analysis.whiteAccuracy} className="h-2" />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Blunders: {analysis.totalMistakes.white.blunders}</span>
                    <span>Mistakes: {analysis.totalMistakes.white.mistakes}</span>
                    <span>Inaccuracies: {analysis.totalMistakes.white.inaccuracies}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Black Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{analysis.blackAccuracy}%</span>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Total Mistakes</div>
                      <div className="text-lg font-semibold">{totalBlackMistakes}</div>
                    </div>
                  </div>
                  <Progress value={analysis.blackAccuracy} className="h-2" />
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Blunders: {analysis.totalMistakes.black.blunders}</span>
                    <span>Mistakes: {analysis.totalMistakes.black.mistakes}</span>
                    <span>Inaccuracies: {analysis.totalMistakes.black.inaccuracies}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Info */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Engine</div>
                  <div className="font-semibold capitalize">{analysis.engineUsed}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Depth</div>
                  <div className="font-semibold">{analysis.depth}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Opening</div>
                  <div className="font-semibold">{analysis.openingEvaluation.name}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Analyzed</div>
                  <div className="font-semibold flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {analysis.analyzedAt.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Moves Tab */}
      {selectedTab === 'moves' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Move by Move Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {analysis.moves.map((move, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">
                          {move.moveNumber}{index % 2 === 0 ? '.' : '...'} {move.move}
                        </span>
                        <Badge className={getClassificationColor(move.classification)}>
                          {getClassificationIcon(move.classification)}
                          <span className="ml-1 capitalize">{move.classification}</span>
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {formatEvaluation(move.evaluation)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleMove(index)}
                      >
                        {expandedMoves.has(index) ? 
                          <ChevronDown className="w-4 h-4" /> : 
                          <ChevronRight className="w-4 h-4" />
                        }
                      </Button>
                    </div>
                    
                    {expandedMoves.has(index) && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-sm text-gray-600 mb-2">
                          {move.comment}
                        </div>
                        {move.bestMove && (
                          <div className="text-sm">
                            <span className="font-medium">Best move: </span>
                            <span className="font-mono">{move.bestMove}</span>
                          </div>
                        )}
                        {move.centipawnLoss > 0 && (
                          <div className="text-sm text-red-600">
                            Centipawn loss: {move.centipawnLoss}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Critical Moments Tab */}
      {selectedTab === 'critical' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Critical Moments</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.criticalMoments.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  No critical moments found in this game.
                </p>
              ) : (
                <div className="space-y-4">
                  {analysis.criticalMoments.map((moment, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Move {moment.moveNumber}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {formatEvaluation(moment.beforeEval)}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm text-gray-600">
                            {formatEvaluation(moment.afterEval)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{moment.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};

export default AnalysisResults;
