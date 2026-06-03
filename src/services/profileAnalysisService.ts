import { gameImportService } from './gameImport';
import { reportService } from './reportService';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ChessGame } from '../types/game';
import { GameReportRequest, ReportGenerationProgress } from '../types/report';
import { PlayerAnalysisProfile, ProfileRefreshResult } from '../types/profileAnalysis';

const DEFAULT_GAME_LIMIT = 20;

class ProfileAnalysisService {
  private storageKey(userId: string) {
    return `player-analysis-profile-${userId}`;
  }

  private firestoreRef(userId: string) {
    return doc(db, 'users', userId, 'analysis', 'profile');
  }

  private chessAccountRef(platform: 'lichess' | 'chess.com', username: string) {
    const key = `${platform}_${username.trim().toLowerCase()}`.replace(/[^a-z0-9_.-]/g, '_');
    return doc(db, 'chessAccounts', key);
  }

  private toFirestoreData(profile: PlayerAnalysisProfile) {
    return JSON.parse(JSON.stringify(profile));
  }

  private reviveProfile(profile: PlayerAnalysisProfile): PlayerAnalysisProfile {
    return {
      ...profile,
      report: profile.report ? {
        ...profile.report,
        generatedAt: new Date(profile.report.generatedAt)
      } : null
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

  async loadProfile(userId?: string): Promise<PlayerAnalysisProfile | null> {
    if (!userId) return null;

    try {
      const snapshot = await getDoc(this.firestoreRef(userId));
      if (snapshot.exists()) {
        const profile = this.reviveProfile(snapshot.data() as PlayerAnalysisProfile);
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
      await setDoc(this.firestoreRef(profile.userId), this.toFirestoreData(profile), { merge: true });
      await setDoc(this.chessAccountRef(profile.platform, profile.username), {
        userId: profile.userId,
        platform: profile.platform,
        username: profile.username,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving player analysis profile to Firestore:', error);
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

  async setupProfile(request: GameReportRequest & { userId: string }): Promise<ProfileRefreshResult> {
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
    return this.refreshProfile(request.userId, true);
  }

  async refreshProfile(userId: string, forceAnalyze = false): Promise<ProfileRefreshResult> {
    const profile = await this.loadProfile(userId);
    if (!profile) {
      throw new Error('Please add your chess username first.');
    }

    const latestGames = await gameImportService.importGames({
      platform: profile.platform,
      username: profile.username,
      count: profile.gameLimit || DEFAULT_GAME_LIMIT,
      rated: profile.rated
    });

    const knownGameIds = new Set(profile.analyzedGameIds);
    const newGames = latestGames.games.filter(game => !knownGameIds.has(game.id));

    const nextProfile: PlayerAnalysisProfile = {
      ...profile,
      games: this.mergeLatestGames(profile.games, latestGames.games, profile.gameLimit || DEFAULT_GAME_LIMIT),
      lastCheckedAt: new Date().toISOString()
    };

    if (!forceAnalyze && profile.report && newGames.length === 0) {
      await this.saveProfile(nextProfile);
      return {
        profile: nextProfile,
        newGamesCount: 0,
        reusedCache: true
      };
    }

    const gamesToAnalyze = profile.report && newGames.length > 0 && !forceAnalyze
      ? newGames
      : latestGames.games;

    const report = await reportService.generateReportFromGamesWithUnifiedPrompts(
      {
        platform: profile.platform,
        username: profile.username,
        gameCount: gamesToAnalyze.length,
        rated: profile.rated
      },
      gamesToAnalyze
    );

    const analyzedIds = new Set([
      ...profile.analyzedGameIds,
      ...gamesToAnalyze.map(game => game.id)
    ]);

    const analyzedProfile: PlayerAnalysisProfile = {
      ...nextProfile,
      report: {
        ...report,
        userId
      },
      analyzedGameIds: Array.from(analyzedIds),
      lastAnalyzedAt: new Date().toISOString()
    };

    await this.saveProfile(analyzedProfile);

    return {
      profile: analyzedProfile,
      newGamesCount: gamesToAnalyze.length,
      reusedCache: false
    };
  }

  private mergeLatestGames(existingGames: ChessGame[], latestGames: ChessGame[], limit: number): ChessGame[] {
    const gamesById = new Map<string, ChessGame>();

    [...latestGames, ...existingGames].forEach(game => {
      if (!gamesById.has(game.id)) {
        gamesById.set(game.id, game);
      }
    });

    return Array.from(gamesById.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }
}

export const profileAnalysisService = new ProfileAnalysisService();
