import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Alert, AlertDescription } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/Tabs';

import { 
  Download, 
  User, 
  Clock, 
  Trophy, 
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { gameImportService } from '../services/gameImport';
import { ChessGame, ImportGameRequest, GameImportError } from '../types/game';

interface GameImportProps {
  onGamesImported: (games: ChessGame[]) => void;
}

const GameImport: React.FC<GameImportProps> = ({ onGamesImported }) => {
  const [activeTab, setActiveTab] = useState<'lichess' | 'chess.com'>('lichess');
  const [username, setUsername] = useState('');
  const [gameCount, setGameCount] = useState(10);
  const [gameType, setGameType] = useState<'all' | 'rated' | 'unrated'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewGames, setPreviewGames] = useState<ChessGame[]>([]);

  const handleImport = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const request: ImportGameRequest = {
        platform: activeTab,
        username: username.trim(),
        count: gameCount,
        rated: gameType === 'rated' ? true : gameType === 'unrated' ? false : undefined
      };

      const response = await gameImportService.importGames(request);
      
      if (response.games.length === 0) {
        setError('No games found for this user');
        return;
      }

      setPreviewGames(response.games);
      setSuccess(`Found ${response.games.length} games`);
    } catch (err) {
      if (err instanceof GameImportError) {
        switch (err.code) {
          case 'INVALID_USERNAME':
            setError('User not found. Please check the username.');
            break;
          case 'RATE_LIMIT':
            setError('Rate limit exceeded. Please try again later.');
            break;
          case 'NETWORK_ERROR':
            setError('Network error. Please check your connection.');
            break;
          case 'INVALID_REQUEST':
            setError(err.message);
            break;
          case 'TIMEOUT':
            setError('Import timed out. Try importing fewer games or try again later.');
            break;
          default:
            setError('Failed to import games. Please try again.');
        }
      } else {
        setError('Unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    onGamesImported(previewGames);
    setPreviewGames([]);
    setSuccess('Games imported successfully!');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case '1-0': return 'bg-green-100 text-green-800';
      case '0-1': return 'bg-red-100 text-red-800';
      case '1/2-1/2': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Import Games
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lichess' | 'chess.com')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="lichess">Lichess</TabsTrigger>
            <TabsTrigger value="chess.com">Chess.com</TabsTrigger>
          </TabsList>
          
          <TabsContent value="lichess" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lichess-username">Lichess Username</Label>
              <Input
                id="lichess-username"
                placeholder="Enter your Lichess username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="chess.com" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chess-com-username">Chess.com Username</Label>
              <Input
                id="chess-com-username"
                placeholder="Enter your Chess.com username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="game-count">Number of Games to Import</Label>
          <Input
            id="game-count"
            type="number"
            min="1"
            max="500"
            value={gameCount}
            onChange={(e) => setGameCount(parseInt(e.target.value) || 10)}
          />
          <p className="text-sm text-gray-500">
            Maximum recommended: 200 games for optimal performance
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="game-type">Game Type</Label>
          <select
            id="game-type"
            value={gameType}
            onChange={(e) => setGameType(e.target.value as 'all' | 'rated' | 'unrated')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Games (Rated + Unrated)</option>
            <option value="rated">Rated Games Only</option>
            <option value="unrated">Unrated Games Only</option>
          </select>
          <p className="text-sm text-gray-500">
            If you're not getting enough games, try "All Games" to include casual/unrated games
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && !previewGames.length && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}

        <Button 
          onClick={handleImport} 
          disabled={loading || !username.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Import Games
            </>
          )}
        </Button>

        {/* Game Preview */}
        {previewGames.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Preview ({previewGames.length} games)</h3>
              <Button onClick={handleConfirmImport} size="sm">
                Confirm Import
              </Button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {previewGames.map((game) => (
                <div key={game.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{game.white.name}</span>
                        <span className="text-gray-500">vs</span>
                        <span className="font-medium">{game.black.name}</span>
                        <Badge className={getResultColor(game.result)}>
                          {game.result}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {game.timeControl}
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {game.opening.name}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(game.date)}
                        </div>
                      </div>
                    </div>
                    
                    {game.url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={game.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GameImport;