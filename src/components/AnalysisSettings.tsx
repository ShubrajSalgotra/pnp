import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { 
  Settings, 
  Brain, 
  Zap, 
  Clock,
  Info,
  CheckCircle2
} from 'lucide-react';

interface AnalysisSettingsProps {
  onStartAnalysis: (settings: AnalysisConfig) => void;
  onCancel: () => void;
  isAnalyzing?: boolean;
}

export interface AnalysisConfig {
  engine: 'stockfish' | 'leela' | 'komodo';
  depth: number;
  timePerMove?: number;
  multiPV?: number;
}

const AnalysisSettings: React.FC<AnalysisSettingsProps> = ({ 
  onStartAnalysis, 
  onCancel, 
  isAnalyzing = false 
}) => {
  const [selectedEngine, setSelectedEngine] = useState<'stockfish' | 'leela' | 'komodo'>('stockfish');
  const [selectedDepth, setSelectedDepth] = useState<number>(15);
  const [timePerMove, setTimePerMove] = useState<number>(3);

  const engines = [
    {
      id: 'stockfish' as const,
      name: 'Stockfish',
      description: 'World\'s strongest chess engine',
      strength: 'Strongest',
      speed: 'Fast',
      available: true,
      icon: <Brain className="w-5 h-5" />
    },
    {
      id: 'leela' as const,
      name: 'Leela Chess Zero',
      description: 'Neural network based engine',
      strength: 'Very Strong',
      speed: 'Slow',
      available: false,
      icon: <Zap className="w-5 h-5" />
    },
    {
      id: 'komodo' as const,
      name: 'Komodo',
      description: 'Commercial chess engine',
      strength: 'Strong',
      speed: 'Medium',
      available: false,
      icon: <Settings className="w-5 h-5" />
    }
  ];

  const depthOptions = [
    { value: 10, label: 'Fast (Depth 10)', time: '~1-2 min', accuracy: 'Good' },
    { value: 15, label: 'Balanced (Depth 15)', time: '~2-4 min', accuracy: 'Very Good' },
    { value: 20, label: 'Deep (Depth 20)', time: '~4-6 min', accuracy: 'Excellent' },
    { value: 25, label: 'Maximum (Depth 25)', time: '~6-8 min', accuracy: 'Perfect' }
  ];

  const handleStartAnalysis = () => {
    const config: AnalysisConfig = {
      engine: selectedEngine,
      depth: selectedDepth,
      timePerMove,
      multiPV: 1
    };
    onStartAnalysis(config);
  };

  const getEngineStatusColor = (available: boolean) => {
    return available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600';
  };

  const getEngineStatusText = (available: boolean) => {
    return available ? 'Available' : 'Coming Soon';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Analysis Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Engine Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Choose Analysis Engine</h3>
            <div className="grid gap-3">
              {engines.map((engine) => (
                <div
                  key={engine.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedEngine === engine.id
                      ? 'border-blue-500 bg-blue-50'
                      : engine.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                  }`}
                  onClick={() => engine.available && setSelectedEngine(engine.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {engine.icon}
                      <div>
                        <div className="font-medium">{engine.name}</div>
                        <div className="text-sm text-gray-600">{engine.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getEngineStatusColor(engine.available)}>
                        {engine.available && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {getEngineStatusText(engine.available)}
                      </Badge>
                      {selectedEngine === engine.id && (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                  
                  {engine.available && (
                    <div className="mt-3 flex gap-4 text-sm text-gray-600">
                      <span>Strength: {engine.strength}</span>
                      <span>Speed: {engine.speed}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Depth Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Analysis Depth</h3>
            <div className="grid gap-2">
              {depthOptions.map((option) => (
                <div
                  key={option.value}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedDepth === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDepth(option.value)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-600">
                        Estimated time: {option.time} • Accuracy: {option.accuracy}
                      </div>
                    </div>
                    {selectedDepth === option.value && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time Control */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Time per Move (seconds)</h3>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={timePerMove}
                onChange={(e) => setTimePerMove(parseInt(e.target.value))}
                className="flex-1"
                disabled={!engines.find(e => e.id === selectedEngine)?.available}
              />
              <span className="font-medium w-12 text-center">{timePerMove}s</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Higher values provide more accurate analysis but take longer
            </div>
          </div>

          {/* Analysis Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Analysis Summary</span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Engine: {engines.find(e => e.id === selectedEngine)?.name}</div>
              <div>Depth: {selectedDepth} plies</div>
              <div>Time per move: {timePerMove} seconds</div>
              <div className="flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3" />
                <span>
                  Estimated total time: {Math.round((selectedDepth * timePerMove) / 10)} minutes
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || !engines.find(e => e.id === selectedEngine)?.available}
              className="flex-1"
            >
              {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              disabled={isAnalyzing}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisSettings;