import { ChessGame, ImportGameRequest, ImportGameResponse, GameImportError } from '../types/game';

const LICHESS_API_BASE = 'https://lichess.org/api';
const CHESS_COM_API_BASE = 'https://api.chess.com/pub';

class GameImportService {
  private parseTime(timeControl: string): string {
    // Convert time control to readable format
    const match = timeControl.match(/(\d+)\+(\d+)/);
    if (match) {
      return `${match[1]}+${match[2]}`;
    }
    return timeControl;
  }

  private parsePGN(pgn: string): string[] {
    // Extract moves from PGN - more robust parsing
    const moves: string[] = [];
    
    // Remove PGN headers and comments
    const cleanPgn = pgn.replace(/\[.*?\]/g, '').replace(/\{.*?\}/g, '');
    
    // Match move patterns: number followed by moves
    const moveRegex = /\d+\.\s*([NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:=[NBRQK])?[+#]?|O-O(?:-O)?)\s*([NBRQK]?[a-h]?[1-8]?[x]?[a-h][1-8](?:=[NBRQK])?[+#]?|O-O(?:-O)?)?/g;
    let match;
    
    while ((match = moveRegex.exec(cleanPgn)) !== null) {
      if (match[1] && match[1] !== '1-0' && match[1] !== '0-1' && match[1] !== '1/2-1/2') {
        moves.push(match[1]);
      }
      if (match[2] && match[2] !== '1-0' && match[2] !== '0-1' && match[2] !== '1/2-1/2') {
        moves.push(match[2]);
      }
    }
    
    return moves;
  }

  private async fetchLichessGames(username: string, count = 20, rated?: boolean): Promise<ChessGame[]> {
    const allGames: ChessGame[] = [];
    const maxPerRequest = 100; // Lichess API limit per request
    let since: number | undefined;
    
    console.log(`Fetching ${count} games from Lichess for ${username} (rated: ${rated})`);
    
    while (allGames.length < count) {
      const remainingCount = count - allGames.length;
      const requestCount = Math.min(remainingCount, maxPerRequest);
      
      let url = `${LICHESS_API_BASE}/games/user/${username}?max=${requestCount}&format=pgn&moves=true&tags=true&clocks=false&evals=false&opening=true&sort=dateDesc`;
      
      // Add rated parameter if specified
      if (rated !== undefined) {
        url += `&rated=${rated}`;
      }
      
      if (since) {
        url += `&until=${since}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/x-chess-pgn'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new GameImportError('User not found', 'INVALID_USERNAME');
        }
        if (response.status === 429) {
          throw new GameImportError('Rate limit exceeded', 'RATE_LIMIT');
        }
        throw new GameImportError('Failed to fetch games', 'NETWORK_ERROR');
      }

      const text = await response.text();
      console.log(`Lichess API response length: ${text.length}`);
      
      // Split PGN games - they should be separated by double newlines
      const pgnGames = text.split(/\n\n(?=\[)/g).filter(pgn => pgn.trim());
      console.log(`Split into ${pgnGames.length} games`);
      
      if (pgnGames.length === 0) {
        console.log('No more games available');
        break; // No more games available
      }
      
      const parsedGames = this.parseLichessGames(pgnGames);
      allGames.push(...parsedGames);
      
      // Set since timestamp for next request (get older games)
      if (parsedGames.length > 0) {
        const lastGame = parsedGames[parsedGames.length - 1];
        const lastGameDate = new Date(lastGame.date);
        since = lastGameDate.getTime();
      }
      
      // Add delay to avoid rate limiting
      if (allGames.length < count) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`Lichess: Fetched ${allGames.length}/${count} games so far`);
    }
    
    return allGames.slice(0, count);
  }
  
  private parseLichessGames(pgnGames: string[]): ChessGame[] {

    return pgnGames.map((pgn, index) => {
      const lines = pgn.split('\n');
      const headers: Record<string, string> = {};
      
      // Parse headers
      lines.forEach(line => {
        const match = line.match(/\[(\w+)\s+"(.+)"\]/);
        if (match) {
          headers[match[1]] = match[2];
        }
      });

      // Extract moves
      const moveText = lines.find(line => !line.startsWith('[') && line.trim());
      const moves = moveText ? this.parsePGN(moveText) : [];

      return {
        id: `lichess-${headers.Site?.split('/').pop() || index}`,
        pgn,
        white: {
          name: headers.White || 'Unknown',
          rating: headers.WhiteElo ? parseInt(headers.WhiteElo) : undefined
        },
        black: {
          name: headers.Black || 'Unknown',
          rating: headers.BlackElo ? parseInt(headers.BlackElo) : undefined
        },
        result: headers.Result as '1-0' | '0-1' | '1/2-1/2' | '*',
        timeControl: this.parseTime(headers.TimeControl || 'Unknown'),
        opening: {
          name: headers.Opening || 'Unknown',
          eco: headers.ECO
        },
        date: headers.Date || new Date().toISOString().split('T')[0],
        site: 'lichess' as const,
        url: headers.Site,
        moves,
        analyzed: false
      };
    });
  }

  private async fetchChessComGames(username: string, count = 20, rated?: boolean): Promise<ChessGame[]> {
    // Get user's current games archive
    const archiveResponse = await fetch(`${CHESS_COM_API_BASE}/player/${username}/games/archives`);
    
    if (!archiveResponse.ok) {
      if (archiveResponse.status === 404) {
        throw new GameImportError('User not found', 'INVALID_USERNAME');
      }
      throw new GameImportError('Failed to fetch games', 'NETWORK_ERROR');
    }

    const archiveData = await archiveResponse.json();
    const archives = archiveData.archives || [];
    
    console.log(`Chess.com found ${archives.length} archives`);
    
    if (archives.length === 0) {
      return [];
    }

    // Fetch games from multiple recent archives to get enough games
    const allGames: any[] = [];
    
    // Determine how many archives to fetch based on requested count
    // More games = need more archives (roughly 30-100 games per month)
    const archivesNeeded = Math.min(
      Math.max(3, Math.ceil(count / 50)), // At least 3 archives, more for higher counts
      12 // Maximum 12 months (1 year)
    );
    
    const archivesToFetch = archives.slice(-archivesNeeded);
    
    console.log(`Fetching from ${archivesToFetch.length} archives to get ${count} games from Chess.com for ${username} (rated: ${rated})`);
    
    for (const archive of archivesToFetch.reverse()) { // Start with most recent
      if (allGames.length >= count) break; // Stop if we have enough games
      
      try {
        const gamesResponse = await fetch(archive);
        
        if (!gamesResponse.ok) {
          console.warn(`Failed to fetch archive: ${archive}`);
          continue; // Skip this archive and try the next one
        }

        const gamesData = await gamesResponse.json();
        const games = gamesData.games || [];
        
        // Filter by rated status if specified, then sort by date (newest first)
        let filteredGames = games;
        if (rated !== undefined) {
          filteredGames = games.filter((game: any) => 
            rated ? game.rated !== false : game.rated === false
          );
        }
        
        const sortedGames = filteredGames
          .sort((a: any, b: any) => b.end_time - a.end_time);
        
        allGames.push(...sortedGames);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`Chess.com: Fetched ${allGames.length} games so far from ${archivesToFetch.indexOf(archive) + 1}/${archivesToFetch.length} archives`);
      } catch (error) {
        console.warn(`Error fetching archive ${archive}:`, error);
        continue;
      }
    }

    // Remove duplicates and take only the requested count
    const uniqueGames = allGames.filter((game, index, self) => 
      index === self.findIndex(g => g.uuid === game.uuid)
    ).slice(0, count);

    console.log(`Chess.com processed ${allGames.length} games, ${uniqueGames.length} unique games`);

    return uniqueGames.map((game: any, index: number) => ({
      id: `chess-com-${game.uuid || index}`,
      pgn: game.pgn || '',
      white: {
        name: game.white?.username || 'Unknown',
        rating: game.white?.rating
      },
      black: {
        name: game.black?.username || 'Unknown',
        rating: game.black?.rating
      },
      result: game.pgn?.includes('1-0') ? '1-0' : 
               game.pgn?.includes('0-1') ? '0-1' : 
               game.pgn?.includes('1/2-1/2') ? '1/2-1/2' : '*',
      timeControl: game.time_control || 'Unknown',
      opening: {
        name: 'Unknown' // Chess.com doesn't provide opening in this API
      },
      date: new Date(game.end_time * 1000).toISOString().split('T')[0],
      site: 'chess.com' as const,
      url: game.url,
      moves: game.pgn ? this.parsePGN(game.pgn) : [],
      analyzed: false
    }));
  }

  async importGames(request: ImportGameRequest): Promise<ImportGameResponse> {
    try {
      const { platform, username, count = 20, rated } = request;
      
      // Validate count
      if (count > 500) {
        throw new GameImportError('Maximum 500 games can be imported at once', 'INVALID_REQUEST');
      }
      
      console.log(`Importing ${count} games from ${platform} for user ${username}`);
      
      let games: ChessGame[];
      
      // Set a timeout for large imports
      const timeoutMs = Math.max(30000, count * 100); // At least 30s, more for larger counts
      
      const importPromise = platform === 'lichess' 
        ? this.fetchLichessGames(username, count, rated)
        : this.fetchChessComGames(username, count, rated);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new GameImportError('Import timeout - try importing fewer games', 'TIMEOUT'));
        }, timeoutMs);
      });
      
      games = await Promise.race([importPromise, timeoutPromise]);

      console.log(`Successfully imported ${games.length} games`);

      return {
        games,
        totalGames: games.length,
        hasMore: games.length === count
      };
    } catch (error) {
      console.error('Error importing games:', error);
      if (error instanceof GameImportError) {
        throw error;
      }
      throw new GameImportError('Unexpected error occurred', 'PARSE_ERROR', error);
    }
  }

  async validateUsername(platform: 'lichess' | 'chess.com', username: string): Promise<boolean> {
    try {
      const url = platform === 'lichess' 
        ? `${LICHESS_API_BASE}/user/${username}`
        : `${CHESS_COM_API_BASE}/player/${username}`;
      
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const gameImportService = new GameImportService();