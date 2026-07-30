import { ChessGame, ImportGameRequest, ImportGameResponse, GameImportError } from '../types/game';

const LICHESS_API_BASE = 'https://lichess.org/api';
const CHESS_COM_API_BASE = 'https://api.chess.com/pub';

class GameImportService {
  private parseTime(timeControl: string): string {
    // Convert time control to readable format
    const match = timeControl.match(/(\d+)\+(\d+)/);
    if (match) {
      const base = parseInt(match[1], 10);
      const increment = match[2];
      if (base >= 60) {
        return `${Math.floor(base / 60)}+${increment}`;
      }
      return `${match[1]}+${match[2]}`;
    }
    const secondsOnly = timeControl.match(/^(\d+)$/);
    if (secondsOnly) {
      const seconds = parseInt(secondsOnly[1], 10);
      if (seconds >= 60) {
        return `${Math.floor(seconds / 60)}+0`;
      }
    }
    return timeControl;
  }

  private parsePgnHeaders(pgn: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
    let match;
    while ((match = headerRegex.exec(pgn)) !== null) {
      headers[match[1]] = match[2];
    }
    return headers;
  }

  private openingFromEcoUrl(ecoUrl?: string, eco?: string): { name: string; eco?: string } {
    if (ecoUrl) {
      const slug = ecoUrl.split('/').pop() || '';
      const name = decodeURIComponent(slug)
        .replace(/-\d+\.\.\..*$/, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (name) {
        return { name, eco };
      }
    }
    return { name: 'Unknown', eco };
  }

  private resultFromPlayers(whiteResult?: string, blackResult?: string, pgnResult?: string): '1-0' | '0-1' | '1/2-1/2' | '*' {
    if (whiteResult === 'win') return '1-0';
    if (blackResult === 'win') return '0-1';

    const drawResults = new Set([
      'agreed',
      'repetition',
      'stalemate',
      'insufficient',
      '50move',
      'timevsinsufficient',
    ]);
    if ((whiteResult && drawResults.has(whiteResult)) || (blackResult && drawResults.has(blackResult))) {
      return '1/2-1/2';
    }

    if (pgnResult === '1-0' || pgnResult === '0-1' || pgnResult === '1/2-1/2' || pgnResult === '*') {
      return pgnResult;
    }
    return '*';
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

  private parseLichessTimestampMs(headers: Record<string, string>): number | undefined {
    // Prefer precise UTC tags when present.
    const utcDate = headers.UTCDate || headers.Date;
    if (!utcDate) return undefined;

    const datePart = utcDate.replace(/\./g, '-');
    const timePart = headers.UTCTime || '00:00:00';
    const parsed = Date.parse(`${datePart}T${timePart}Z`);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed;
  }

  private async fetchLichessGames(
    username: string,
    count = 20,
    rated?: boolean,
    allGames = false
  ): Promise<ChessGame[]> {
    const allFetched: ChessGame[] = [];
    const seenIds = new Set<string>();
    const maxPerRequest = 100; // Lichess API limit per request
    let until: number | undefined;
    const target = allGames ? Number.POSITIVE_INFINITY : count;
    
    console.log(
      allGames
        ? `Fetching ALL games from Lichess for ${username} (rated: ${rated})`
        : `Fetching ${count} games from Lichess for ${username} (rated: ${rated})`
    );
    
    while (allFetched.length < target) {
      const remainingCount = allGames ? maxPerRequest : Math.min(target - allFetched.length, maxPerRequest);
      
      let url = `${LICHESS_API_BASE}/games/user/${username}?max=${remainingCount}&format=pgn&moves=true&tags=true&clocks=true&evals=false&opening=true&sort=dateDesc`;
      
      // Add rated parameter if specified
      if (rated !== undefined) {
        url += `&rated=${rated}`;
      }
      
      if (until) {
        url += `&until=${until}`;
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
      let added = 0;
      for (const game of parsedGames) {
        if (seenIds.has(game.id)) continue;
        seenIds.add(game.id);
        allFetched.push(game);
        added += 1;
      }
      
      // Page older than the oldest game in this batch (Lichess `until` is exclusive ms).
      const oldest = parsedGames[parsedGames.length - 1];
      const oldestHeaders = this.parsePgnHeaders(oldest?.pgn || '');
      const oldestMs = this.parseLichessTimestampMs(oldestHeaders);
      if (oldestMs != null) {
        until = oldestMs;
      } else if (oldest?.date) {
        const fallback = Date.parse(oldest.date.replace(/\./g, '-'));
        until = Number.isFinite(fallback) ? fallback : until;
      }

      // No new unique games or fewer than requested ⇒ end of history
      if (added === 0 || parsedGames.length < remainingCount) {
        break;
      }
      
      // Add delay to avoid rate limiting
      if (allFetched.length < target) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(
        allGames
          ? `Lichess: Fetched ${allFetched.length} games so far`
          : `Lichess: Fetched ${allFetched.length}/${count} games so far`
      );
    }
    
    return allGames ? allFetched : allFetched.slice(0, count);
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

  private async fetchChessComGames(
    username: string,
    count = 20,
    rated?: boolean,
    allGames = false
  ): Promise<ChessGame[]> {
    // Get user's current games archive
    const archiveResponse = await fetch(`${CHESS_COM_API_BASE}/player/${username}/games/archives`);
    
    if (!archiveResponse.ok) {
      if (archiveResponse.status === 404) {
        throw new GameImportError('User not found', 'INVALID_USERNAME');
      }
      throw new GameImportError('Failed to fetch games', 'NETWORK_ERROR');
    }

    const archiveData = await archiveResponse.json();
    const archives: string[] = archiveData.archives || [];
    
    console.log(`Chess.com found ${archives.length} archives`);
    
    if (archives.length === 0) {
      return [];
    }

    // Newest first. Keep walking older months until we have enough games
    // (or exhaust history). Previously we only opened ~3 recent archives, which
    // returned far fewer than requested when the opponent was recently inactive.
    const archivesNewestFirst = [...archives].reverse();
    const fetchedGames: any[] = [];
    
    console.log(
      allGames
        ? `Fetching ALL games from ${archivesNewestFirst.length} Chess.com archives for ${username} (rated: ${rated})`
        : `Fetching Chess.com archives newest-first until ${count} games for ${username} (rated: ${rated})`
    );
    
    for (let archiveIndex = 0; archiveIndex < archivesNewestFirst.length; archiveIndex++) {
      const archive = archivesNewestFirst[archiveIndex];
      if (!allGames && fetchedGames.length >= count) break;
      
      try {
        const gamesResponse = await fetch(archive);
        
        if (!gamesResponse.ok) {
          console.warn(`Failed to fetch archive: ${archive}`);
          continue;
        }

        const gamesData = await gamesResponse.json();
        const games = gamesData.games || [];
        
        let filteredGames = games;
        if (rated !== undefined) {
          filteredGames = games.filter((game: any) => 
            rated ? game.rated !== false : game.rated === false
          );
        }
        
        fetchedGames.push(
          ...filteredGames.sort((a: any, b: any) => b.end_time - a.end_time)
        );

        console.log(
          `Chess.com: ${fetchedGames.length} matching games after ${archiveIndex + 1}/${archivesNewestFirst.length} archives`
        );

        if (!allGames && fetchedGames.length >= count) {
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Error fetching archive ${archive}:`, error);
        continue;
      }
    }

    // Remove duplicates; optionally cap to the requested count
    const uniqueGames = fetchedGames
      .filter((game, index, self) => index === self.findIndex((g) => g.uuid === game.uuid))
      .sort((a: any, b: any) => b.end_time - a.end_time);
    const selectedGames = allGames ? uniqueGames : uniqueGames.slice(0, count);

    console.log(`Chess.com processed ${fetchedGames.length} games, returning ${selectedGames.length}`);

    return selectedGames.map((game: any, index: number) => {
      const headers = this.parsePgnHeaders(game.pgn || '');
      const eco = headers.ECO || undefined;
      const ecoUrl = headers.ECOUrl || game.eco;
      const opening = this.openingFromEcoUrl(ecoUrl, eco);
      const pgnResult = headers.Result as '1-0' | '0-1' | '1/2-1/2' | '*' | undefined;

      return {
        id: `chess-com-${game.uuid || index}`,
        pgn: game.pgn || '',
        white: {
          name: game.white?.username || headers.White || 'Unknown',
          rating: game.white?.rating ?? (headers.WhiteElo ? parseInt(headers.WhiteElo, 10) : undefined),
          result: game.white?.result
        },
        black: {
          name: game.black?.username || headers.Black || 'Unknown',
          rating: game.black?.rating ?? (headers.BlackElo ? parseInt(headers.BlackElo, 10) : undefined),
          result: game.black?.result
        },
        result: this.resultFromPlayers(game.white?.result, game.black?.result, pgnResult),
        timeControl: this.parseTime(game.time_control || headers.TimeControl || 'Unknown'),
        timeClass: game.time_class,
        opening,
        date: headers.Date || new Date(game.end_time * 1000).toISOString().split('T')[0].replace(/-/g, '.'),
        site: 'chess.com' as const,
        url: game.url || headers.Link,
        moves: game.pgn ? this.parsePGN(game.pgn) : [],
        analyzed: Boolean(game.accuracies),
        accuracy: game.accuracies
          ? {
              white: Number(game.accuracies.white),
              black: Number(game.accuracies.black)
            }
          : undefined,
        termination: headers.Termination
      };
    });
  }

  async importGames(request: ImportGameRequest): Promise<ImportGameResponse> {
    try {
      const { platform, username, count = 20, rated, allGames = false } = request;
      
      // Validate count (full-history imports skip the capped limit)
      if (!allGames && count > 500) {
        throw new GameImportError('Maximum 500 games can be imported at once', 'INVALID_REQUEST');
      }
      
      console.log(
        allGames
          ? `Importing ALL games from ${platform} for user ${username}`
          : `Importing ${count} games from ${platform} for user ${username}`
      );
      
      let games: ChessGame[];
      
      // Full history can take several minutes for active accounts
      const timeoutMs = allGames
        ? 10 * 60 * 1000
        : Math.max(30000, count * 100);
      
      const importPromise = platform === 'lichess' 
        ? this.fetchLichessGames(username, count, rated, allGames)
        : this.fetchChessComGames(username, count, rated, allGames);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new GameImportError(
            allGames
              ? 'Import timeout while fetching full game history'
              : 'Import timeout - try importing fewer games',
            'TIMEOUT'
          ));
        }, timeoutMs);
      });
      
      games = await Promise.race([importPromise, timeoutPromise]);

      console.log(`Successfully imported ${games.length} games`);

      return {
        games,
        totalGames: games.length,
        hasMore: allGames ? false : games.length === count
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