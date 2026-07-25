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
    const toDelete = existing.docs.filter((item) => !keepIds.has(item.id));

    for (let i = 0; i < toDelete.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      toDelete.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }

    for (let i = 0; i < games.length; i += FIRESTORE_BATCH_LIMIT) {
      const batch = writeBatch(db);
      games.slice(i, i + FIRESTORE_BATCH_LIMIT).forEach((game) => {
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
    localStorage.setItem(this.storageKey(profile.userId), JSON.stringify(profile));

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
    reportService.setProgressCallback(callback);
  }

  /**
   * First-time profile setup (registration / connect account).
   * Can optionally pull full history, then optionally generate a report.
   */
  async setupProfile(
    request: GameReportRequest & { userId: string; generateReport?: boolean }
  ): Promise<ProfileRefreshResult> {
    const profile: PlayerAnalysisProfile = {
      userId: request.userId,
      platform: request.platform,
      username: request.username,
      gameLimit: request.gameCount || DEFAULT_GAME_LIMIT,
      rated: request.rated,
      games: [],
      analyzedGameIds: [],
      report: null,
      lastCheckedAt: null,
      lastAnalyzedAt: null
    };

    await this.saveProfile(profile);

    const synced = await this.syncProfileGames(request.userId, {
      allGames: request.allGames,
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
   * Dashboard "Refresh profile": pull only recent/new games. Never generates a report.
   */
  async refreshProfile(userId: string): Promise<ProfileRefreshResult> {
    return this.syncProfileGames(userId);
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

    const importCount = Math.min(
      MAX_IMPORT_COUNT,
      Math.max(SYNC_BATCH_SIZE, Math.min(profile.gameLimit || SYNC_BATCH_SIZE, MAX_IMPORT_COUNT))
    );

    const latestGames = await gameImportService.importGames({
      platform: profile.platform,
      username: profile.username,
      count: options?.allGames ? undefined : importCount,
      rated: profile.rated,
      allGames: Boolean(options?.allGames),
    });

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
   * Manual report generation only — uses games already on the profile
   * (optionally after a light incremental sync first).
   */
  async generateProfileReport(
    userId: string,
    request?: Partial<Pick<GameReportRequest, 'gameCount' | 'rated'>>
  ): Promise<ProfileRefreshResult> {
    // Pick up any brand-new games before analyzing, without re-pulling full history.
    const synced = await this.syncProfileGames(userId);
    const profile = synced.profile;

    const gameCount = Math.max(
      1,
      Math.min(request?.gameCount || profile.gameLimit || DEFAULT_GAME_LIMIT, profile.games.length || DEFAULT_GAME_LIMIT)
    );

    const gamesToAnalyze = profile.games.slice(0, gameCount);
    if (gamesToAnalyze.length === 0) {
      throw new Error('No games available to analyze. Refresh your profile first.');
    }

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

    await this.saveProfile(analyzedProfile);

    return {
      profile: analyzedProfile,
      newGamesCount: synced.newGamesCount,
      reusedCache: false,
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
