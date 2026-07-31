import { gameImportService } from './gameImport';
import { reportService } from './reportService';
import { userDataService } from './userDataService';
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { ChessGame } from '../types/game';
import { ChessReport, GameReportRequest, ReportGenerationProgress } from '../types/report';
import { PlayerAnalysisProfile, ProfileRefreshResult } from '../types/profileAnalysis';

const DEFAULT_GAME_LIMIT = 20;
/** How many recent games to fetch on a normal Refresh (incremental sync). */
const SYNC_BATCH_SIZE = 50;
/** Soft cap so Firestore / localStorage stay healthy. */
const MAX_STORED_GAMES = 2000;
/** Hard cap enforced by gameImportService when allGames is false. */
const MAX_IMPORT_COUNT = 500;
const FIRESTORE_BATCH_LIMIT = 400;

class ProfileAnalysisService {
  private progressCallback?: (progress: ReportGenerationProgress) => void;

  private updateProgress(
    stage: ReportGenerationProgress['stage'],
    message: string,
    progress: number
  ) {
    this.progressCallback?.({ stage, message, progress });
  }

  private storageKey(userId: string) {
    return `player-analysis-profile-${userId}`;
  }

  private firestoreRef(userId: string) {
    return doc(db, 'users', userId, 'analysis', 'profile');
  }

  private gamesCollection(userId: string) {
    return collection(db, 'users', userId, 'games');
  }

  private chessAccountRef(platform: 'lichess' | 'chess.com', username: string) {
    const key = `${platform}_${username.trim().toLowerCase()}`.replace(/[^a-z0-9_.-]/g, '_');
    return doc(db, 'chessAccounts', key);
  }

  private toFirestoreData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private reviveReport(report: ChessReport | null | undefined): ChessReport | null {
    if (!report) return null;
    return {
      ...report,
      generatedAt: new Date(report.generatedAt),
    };
  }

  private reviveProfile(profile: PlayerAnalysisProfile): PlayerAnalysisProfile {
    return {
      ...profile,
      games: Array.isArray(profile.games) ? profile.games : [],
      analyzedGameIds: Array.isArray(profile.analyzedGameIds) ? profile.analyzedGameIds : [],
      report: this.reviveReport(profile.report),
    };
  }

  private profileMetadata(profile: PlayerAnalysisProfile) {
    return {
      userId: profile.userId,
      platform: profile.platform,
      username: profile.username,
      gameLimit: profile.gameLimit,
      syncAllGames: profile.syncAllGames || false,
      rated: profile.rated,
      analyzedGameIds: profile.analyzedGameIds,
      reportId: profile.report?.id || null,
      gamesCount: profile.games.length,
      lastCheckedAt: profile.lastCheckedAt,
      lastAnalyzedAt: profile.lastAnalyzedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  getProfile(userId?: string): PlayerAnalysisProfile | null {
    if (!userId) return null;

    const rawProfile = localStorage.getItem(this.storageKey(userId));
    if (!rawProfile) return null;

    try {
      return this.reviveProfile(JSON.parse(rawProfile));
    } catch (error) {
      console.error('Error loading player analysis profile:', error);
      return null;
    }
  }

  private async loadGamesFromSubcollection(userId: string): Promise<ChessGame[]> {
    const snapshot = await getDocs(this.gamesCollection(userId));
    return snapshot.docs
      .map((item) => item.data() as ChessGame)
      .sort((a, b) => this.gameTimestamp(b) - this.gameTimestamp(a));
  }

  private async loadReportById(userId: string, reportId: string | null | undefined): Promise<ChessReport | null> {
    if (!reportId) return null;
    try {
      const snapshot = await getDoc(doc(db, 'users', userId, 'reports', reportId));
      if (!snapshot.exists()) return null;
      return this.reviveReport(snapshot.data() as ChessReport);
    } catch (error) {
      console.error('Error loading profile report from Firestore:', error);
      return null;
    }
  }

  private async writeGamesSubcollection(userId: string, games: ChessGame[]): Promise<void> {
    const existing = await getDocs(this.gamesCollection(userId));
    const keepIds = new Set(games.map((game) => game.id));
    const existingIds = new Set(existing.docs.map((item) => item.id));
    const toDelete = existing.docs.filter((item) => !keepIds.has(item.id));

    for (let i = 0; i < toDelete.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }

    // Finished games never change, so only write the ones Firestore does not have yet.
    // Rewriting the whole archive on every save made "Saving your report…" take
    // as long as the analysis itself for players with large histories.
    const toWrite = games.filter((game) => !existingIds.has(game.id));

    for (let i = 0; i < toWrite.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      toWrite.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((game) => {
        batch.set(doc(this.gamesCollection(userId), game.id), this.toFirestoreData(game), { merge: true });
      });
      await batch.commit();
    }
  }

  async loadProfile(userId?: string): Promise<PlayerAnalysisProfile | null> {
    if (!userId) return null;

    try {
      const snapshot = await getDoc(this.firestoreRef(userId));
      if (snapshot.exists()) {
        const data = snapshot.data() as PlayerAnalysisProfile & {
          reportId?: string | null;
          gamesCount?: number;
        };

        // Legacy docs may still embed games/report; prefer those when present.
        let games = Array.isArray(data.games) ? data.games : [];
        let report = this.reviveReport(data.report);

        if (games.length === 0) {
          games = await this.loadGamesFromSubcollection(userId);
        }

        if (!report && data.reportId) {
          report = await this.loadReportById(userId, data.reportId);
        }

        const profile = this.reviveProfile({
          userId,
          platform: data.platform,
          username: data.username,
          gameLimit: data.gameLimit,
          syncAllGames: data.syncAllGames,
          rated: data.rated,
          games,
          analyzedGameIds: data.analyzedGameIds || [],
          report,
          lastCheckedAt: data.lastCheckedAt || null,
          lastAnalyzedAt: data.lastAnalyzedAt || null,
        });

        localStorage.setItem(this.storageKey(userId), JSON.stringify(profile));
        return profile;
      }
    } catch (error) {
      console.error('Error loading player analysis profile from Firestore:', error);
    }

    return this.getProfile(userId);
  }

  async saveProfile(profile: PlayerAnalysisProfile) {
    try {
      localStorage.setItem(this.storageKey(profile.userId), JSON.stringify(profile));
    } catch (cacheError) {
      // Quota / private mode — never block Firestore persistence on cache failure.
      console.warn('Could not cache profile in localStorage:', cacheError);
    }

    try {
      await setDoc(this.firestoreRef(profile.userId), this.toFirestoreData(this.profileMetadata(profile)), {
        merge: true,
      });

      await this.writeGamesSubcollection(profile.userId, profile.games);

      if (profile.report) {
        await userDataService.saveReport(profile.userId, {
          ...profile.report,
          userId: profile.userId,
        }, 'self');
      }

      await setDoc(this.chessAccountRef(profile.platform, profile.username), {
        userId: profile.userId,
        platform: profile.platform,
        username: profile.username,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error saving player analysis profile to Firestore:', error);

      // Fallback: attempt legacy monolithic write so users still keep data.
      try {
        await setDoc(this.firestoreRef(profile.userId), this.toFirestoreData(profile), { merge: true });
      } catch (fallbackError) {
        console.error('Fallback profile save also failed:', fallbackError);
      }
    }
  }

  async isChessAccountTaken(platform: 'lichess' | 'chess.com', username: string): Promise<boolean> {
    try {
      const snapshot = await getDoc(this.chessAccountRef(platform, username));
      return snapshot.exists();
    } catch (error) {
      console.error('Error checking chess account ownership:', error);
      return false;
    }
  }

  setProgressCallback(callback: (progress: ReportGenerationProgress) => void) {
    this.progressCallback = callback;
    reportService.setProgressCallback(callback);
  }

  /**
   * First-time profile setup (registration / connect account).
   * Full history only when `allGames: true` (registration / Refresh).
   */
  async setupProfile(
    request: GameReportRequest & { userId: string; generateReport?: boolean }
  ): Promise<ProfileRefreshResult> {
    const syncAllGames = request.allGames === true;

    const profile: PlayerAnalysisProfile = {
      userId: request.userId,
      platform: request.platform,
      username: request.username,
      gameLimit: request.gameCount || DEFAULT_GAME_LIMIT,
      syncAllGames,
      rated: request.rated,
      games: [],
      analyzedGameIds: [],
      report: null,
      lastCheckedAt: null,
      lastAnalyzedAt: null
    };

    this.updateProgress(
      'fetching',
      syncAllGames
        ? 'Importing your full game history (can take a few minutes)…'
        : `Fetching your latest ${profile.gameLimit} games…`,
      8
    );

    await this.saveProfile(profile);

    const synced = await this.syncProfileGames(request.userId, {
      allGames: syncAllGames,
      replaceExisting: true,
    });

    if (request.generateReport === false) {
      return synced;
    }

    return this.generateProfileReport(request.userId, {
      gameCount: request.gameCount || DEFAULT_GAME_LIMIT,
      rated: request.rated,
    });
  }

  /**
   * Dashboard "Refresh profile": pull the player's full game history into Firebase.
   * Never generates a report.
   */
  async refreshProfile(userId: string): Promise<ProfileRefreshResult> {
    this.updateProgress(
      'fetching',
      'Importing your full game history (can take a few minutes)…',
      10
    );
    return this.syncProfileGames(userId, { allGames: true });
  }

  /**
   * Incremental (or full) game sync without touching the report.
   */
  async syncProfileGames(
    userId: string,
    options?: { allGames?: boolean; replaceExisting?: boolean }
  ): Promise<ProfileRefreshResult> {
    const profile = await this.loadProfile(userId);
    if (!profile) {
      throw new Error('Please add your chess username first.');
    }

    // Explicit option wins. Never imply full-history from a stale profile flag —
    // that made "Generate report" hang for minutes with no UI updates.
    const allGames = options?.allGames === true;

    const importCount = Math.min(
      MAX_IMPORT_COUNT,
      Math.max(
        SYNC_BATCH_SIZE,
        Math.min(
          Math.max(profile.gameLimit || DEFAULT_GAME_LIMIT, SYNC_BATCH_SIZE),
          MAX_IMPORT_COUNT
        )
      )
    );

    this.updateProgress(
      'fetching',
      allGames
        ? 'Downloading full archive from chess.com / Lichess…'
        : `Fetching up to ${importCount} recent games…`,
      15
    );

    const latestGames = await gameImportService.importGames({
      platform: profile.platform,
      username: profile.username,
      count: allGames ? undefined : importCount,
      rated: profile.rated,
      allGames,
    });

    this.updateProgress(
      'fetching',
      `Saving ${latestGames.games.length} games…`,
      22
    );

    const knownGameIds = new Set([
      ...profile.games.map((game) => game.id),
      ...profile.analyzedGameIds,
    ]);
    const newGames = latestGames.games.filter((game) => !knownGameIds.has(game.id));

    const mergedGames = options?.replaceExisting
      ? this.mergeGames([], latestGames.games, MAX_STORED_GAMES)
      : this.mergeGames(profile.games, latestGames.games, MAX_STORED_GAMES);

    const nextProfile: PlayerAnalysisProfile = {
      ...profile,
      syncAllGames: allGames || Boolean(profile.syncAllGames),
      games: mergedGames,
      lastCheckedAt: new Date().toISOString(),
    };

    await this.saveProfile(nextProfile);

    return {
      profile: nextProfile,
      newGamesCount: options?.replaceExisting ? latestGames.games.length : newGames.length,
      reusedCache: !options?.replaceExisting && newGames.length === 0,
    };
  }

  /**
   * Manual report generation — uses games already on the dashboard only.
   * Never hits chess.com / Lichess; Refresh profile is for syncing new games.
   */
  async generateProfileReport(
    userId: string,
    request?: Partial<Pick<GameReportRequest, 'gameCount' | 'rated'>>
  ): Promise<ProfileRefreshResult> {
    this.updateProgress('fetching', 'Loading your saved games…', 8);

    const profile = await this.loadProfile(userId);
    if (!profile) {
      throw new Error('Please add your chess username first.');
    }

    if (profile.games.length === 0) {
      throw new Error('No games on your dashboard yet. Use Refresh profile to import games first.');
    }

    const requestedCount = Math.max(
      1,
      Math.min(request?.gameCount || profile.gameLimit || DEFAULT_GAME_LIMIT, 100)
    );
    const gameCount = Math.min(requestedCount, profile.games.length);
    const gamesToAnalyze = profile.games.slice(0, gameCount);

    this.updateProgress(
      'analyzing',
      `Sending ${gamesToAnalyze.length} saved games to your coach (full move lists)…`,
      28
    );

    const report = await reportService.generateReportFromGamesWithUnifiedPrompts(
      {
        platform: profile.platform,
        username: profile.username,
        gameCount: gamesToAnalyze.length,
        rated: request?.rated ?? profile.rated,
      },
      gamesToAnalyze
    );

    const analyzedIds = new Set([
      ...profile.analyzedGameIds,
      ...gamesToAnalyze.map((game) => game.id),
    ]);

    const analyzedProfile: PlayerAnalysisProfile = {
      ...profile,
      gameLimit: request?.gameCount || profile.gameLimit || DEFAULT_GAME_LIMIT,
      rated: request?.rated ?? profile.rated,
      report: {
        ...report,
        userId,
      },
      analyzedGameIds: Array.from(analyzedIds),
      lastAnalyzedAt: new Date().toISOString(),
    };

    this.updateProgress('generating', 'Saving your report…', 96);
    await this.saveProfile(analyzedProfile);

    this.updateProgress('complete', 'Report ready!', 100);

    return {
      profile: analyzedProfile,
      newGamesCount: 0,
      reusedCache: true,
    };
  }

  private mergeGames(existingGames: ChessGame[], incomingGames: ChessGame[], maxGames: number): ChessGame[] {
    const gamesById = new Map<string, ChessGame>();

    // Incoming first so refreshed metadata wins.
    [...incomingGames, ...existingGames].forEach((game) => {
      if (!gamesById.has(game.id)) {
        gamesById.set(game.id, game);
      }
    });

    return Array.from(gamesById.values())
      .sort((a, b) => this.gameTimestamp(b) - this.gameTimestamp(a))
      .slice(0, maxGames);
  }

  private gameTimestamp(game: ChessGame): number {
    const normalized = game.date?.includes('.') ? game.date.replace(/\./g, '-') : game.date;
    const parsed = Date.parse(normalized || '');
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

export const profileAnalysisService = new ProfileAnalysisService();
