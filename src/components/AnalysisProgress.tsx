import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Progress } from './ui/Progress';
import { Button } from './ui/Button';
import { 
  Brain, 
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { AnalysisProgress as AnalysisProgressType } from '../types/analysis';
import { analysisEngineService } from '../services/analysisEngine';

interface AnalysisProgressProps {
  gameId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ 
  gameId, 
  onComplete, 
  onCancel 
}) => {
  const [progress, setProgress] = useState<AnalysisProgressType | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentProgress = analysisEngineService.getAnalysisProgress(gameId);
      setProgress(currentProgress);
      
      if (currentProgress?.status === 'completed') {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 1000);
      } else if (currentProgress?.status === 'error') {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [gameId, onComplete]);

  const getStatusIcon = () => {
    switch (progress?.status) {
      case 'analyzing':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getStatusText = () => {
    switch (progress?.status) {
      case 'analyzing':
        return `Analyzing move ${progress.currentMove} of ${progress.totalMoves}`;
      case 'completed':
        return 'Analysis completed!';
      case 'error':
        return 'Analysis failed';
      default:
        return 'Starting analysis...';
    }
  };

  const getStatusColor = () => {
    switch (progress?.status) {
      case 'analyzing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          Game Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className={`text-lg font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {progress?.message && (
            <div className="text-sm text-gray-600 mt-1">
              {progress.message}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress</span>
            <span>{progress?.progress || 0}%</span>
          </div>
          <Progress value={progress?.progress || 0} className="h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Current Move</div>
            <div className="font-medium">{progress?.currentMove || 0}</div>
          </div>
          <div>
            <div className="text-gray-600">Total Moves</div>
            <div className="font-medium">{progress?.totalMoves || 0}</div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={onCancel}
            variant="outline"
            size="sm"
            disabled={progress?.status === 'completed'}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalysisProgress;