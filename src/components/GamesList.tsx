import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { 
  Search, 
  Calendar, 
  Clock, 
  Trophy, 
  User,
  ExternalLink,
  BarChart3,
  Trash2,
  Eye
} from 'lucide-react';
import { ChessGame } from '../types/game';
import { GameAnalysis } from '../types/analysis';

interface GamesListProps {
  games: ChessGame[];
  onDeleteGame: (gameId: string) => void;
  onAnalyzeGame: (game: ChessGame) => void;
  onViewAnalysis?: (game: ChessGame) => void;
  onViewGame?: (game: ChessGame) => void;
  analyses?: Map<string, GameAnalysis>;
  currentUsername?: string | null; // Add current user's username for proper filtering
}

const GamesList: React.FC<GamesListProps> = ({ 
  games, 
  onDeleteGame, 
  onAnalyzeGame, 
  onViewAnalysis,
  onViewGame,
  analyses = new Map(),
  currentUsername
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResult, setFilterResult] = useState<'all' | 'wins' | 'losses' | 'draws'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'rating' | 'accuracy'>('date');

  // Helper function to determine user's result in a game
  const getUserResult = (game: ChessGame): 'win' | 'loss' | 'draw' | 'unknown' => {
    if (!currentUsername) return 'unknown';
    
    const userIsWhite = game.white.name.toLowerCase() === currentUsername.toLowerCase();
    const userIsBlack = game.black.name.toLowerCase() === currentUsername.toLowerCase();
    
    if (!userIsWhite && !userIsBlack) return 'unknown';
    
    if (game.result === '1/2-1/2') return 'draw';
    if (game.result === '*') return 'unknown';
    
    if (userIsWhite) {
      return game.result === '1-0' ? 'win' : 'loss';
    } else {
      return game.result === '0-1' ? 'win' : 'loss';
    }
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = 
      game.white.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.black.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.opening.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesResult = true;
    if (filterResult !== 'all') {
      const userResult = getUserResult(game);
      switch (filterResult) {
        case 'wins':
          matchesResult = userResult === 'win';
          break;
        case 'losses':
          matchesResult = userResult === 'loss';
          break;
        case 'draws':
          matchesResult = userResult === 'draw';
          break;
      }
    }
    
    return matchesSearch && matchesResult;
  });

  const sortedGames = [...filteredGames].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'rating':
        const aRating = Math.max(a.white.rating || 0, a.black.rating || 0);
        const bRating = Math.max(b.white.rating || 0, b.black.rating || 0);
        return bRating - aRating;
      case 'accuracy':
        const aAccuracy = a.accuracy ? Math.max(a.accuracy.white, a.accuracy.black) : 0;
        const bAccuracy = b.accuracy ? Math.max(b.accuracy.white, b.accuracy.black) : 0;
        return bAccuracy - aAccuracy;
      default:
        return 0;
    }
  });

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

  const getResultText = (result: string) => {
    switch (result) {
      case '1-0': return 'White wins';
      case '0-1': return 'Black wins';
      case '1/2-1/2': return 'Draw';
      default: return 'Unknown';
    }
  };

  const getSiteColor = (site: string) => {
    switch (site) {
      case 'lichess': return 'bg-blue-100 text-blue-800';
      case 'chess.com': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Your Games ({games.length})</span>
          <div className="flex items-center gap-2">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as 'date' | 'rating' | 'accuracy')}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="date">Sort by Date</option>
              <option value="rating">Sort by Rating</option>
              <option value="accuracy">Sort by Accuracy</option>
            </select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by player name or opening..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant={filterResult === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterResult('all')}
            >
              All
            </Button>
            <Button 
              variant={filterResult === 'wins' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterResult('wins')}
              disabled={!currentUsername}
              title={!currentUsername ? 'Import games to enable personal filtering' : ''}
            >
              My Wins
            </Button>
            <Button 
              variant={filterResult === 'losses' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterResult('losses')}
              disabled={!currentUsername}
              title={!currentUsername ? 'Import games to enable personal filtering' : ''}
            >
              My Losses
            </Button>
            <Button 
              variant={filterResult === 'draws' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterResult('draws')}
              disabled={!currentUsername}
              title={!currentUsername ? 'Import games to enable personal filtering' : ''}
            >
              My Draws
            </Button>
          </div>
          {!currentUsername && games.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Personal filtering (My Wins/Losses/Draws) will be available after importing games
            </p>
          )}
        </div>

        {/* Games List */}
        <div className="space-y-3">
          {sortedGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {games.length === 0 ? 'No games imported yet' : 'No games match your search'}
            </div>
          ) : (
            sortedGames.map((game) => (
              <div key={game.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{game.white.name}</span>
                      {game.white.rating && (
                        <span className="text-sm text-gray-500">({game.white.rating})</span>
                      )}
                      <span className="text-gray-500">vs</span>
                      <span className="font-medium">{game.black.name}</span>
                      {game.black.rating && (
                        <span className="text-sm text-gray-500">({game.black.rating})</span>
                      )}
                      <Badge className={getResultColor(game.result)}>
                        {getResultText(game.result)}
                      </Badge>
                      <Badge className={getSiteColor(game.site)}>
                        {game.site}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
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

                    {game.analyzed && game.accuracy && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-blue-600">
                          White: {game.accuracy.white}% accuracy
                        </span>
                        <span className="text-red-600">
                          Black: {game.accuracy.black}% accuracy
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {!game.analyzed && (
                      <Button 
                        size="sm" 
                        onClick={() => onAnalyzeGame(game)}
                        className="flex items-center gap-1"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Analyze
                      </Button>
                    )}
                    
                    {game.analyzed && onViewAnalysis && analyses.has(game.id) && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onViewAnalysis(game)}
                        className="flex items-center gap-1"
                      >
                        <BarChart3 className="w-4 h-4" />
                        View Analysis
                      </Button>
                    )}

                    {onViewGame && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onViewGame(game)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Game
                      </Button>
                    )}
                    
                    {game.url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={game.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => onDeleteGame(game.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GamesList;