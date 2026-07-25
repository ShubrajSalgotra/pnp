import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadString } from 'firebase/storage';
import { db, storage } from './firebase';
import { ChessReport } from '../types/report';
import { GameAnalysis } from '../types/analysis';
import {
  DEFAULT_PUZZLE_PROGRESS,
  DEFAULT_USER_PREFERENCES,
  PuzzleProgress,
  UserPreferences,
} from '../types/userData';

const toPlain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const reviveReport = (report: ChessReport): ChessReport => ({
  ...report,
  generatedAt: report.generatedAt instanceof Date ? report.generatedAt : new Date(report.generatedAt),
});

const reviveAnalysis = (analysis: GameAnalysis): GameAnalysis => ({
  ...analysis,
  analyzedAt: analysis.analyzedAt instanceof Date ? analysis.analyzedAt : new Date(analysis.analyzedAt),
});

class UserDataService {
  private prefsKey(userId: string) {
    return `user-prefs-${userId}`;
  }

  private opponentReportsKey(userId: string) {
    return `opponent-analysis-reports-${userId}`;
  }

  private puzzleProgressKey(userId: string) {
    return `puzzle-progress-${userId}`;
  }

  private analysesKey(userId: string) {
    return `chess-analyses-${userId}`;
  }

  private opponentReportsCollection(userId: string) {
    return collection(db, 'users', userId, 'opponentReports');
  }

  private reportsCollection(userId: string) {
    return collection(db, 'users', userId, 'reports');
  }

  private analysesCollection(userId: string) {
    return collection(db, 'users', userId, 'gameAnalyses');
  }

  private puzzleProgressRef(userId: string) {
    return doc(db, 'users', userId, 'puzzleProgress', 'stats');
  }

  // --- Preferences ---

  getCachedPreferences(userId?: string): UserPreferences | null {
    if (!userId) return null;
    const raw = localStorage.getItem(this.prefsKey(userId));
    if (!raw) return null;
    try {
      return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return null;
    }
  }

  async loadPreferences(userId?: string): Promise<UserPreferences> {
    if (!userId) return { ...DEFAULT_USER_PREFERENCES };

    try {
      const snapshot = await getDoc(doc(db, 'users', userId));
      if (snapshot.exists()) {
        const data = snapshot.data() as { preferences?: UserPreferences };
        const preferences = { ...DEFAULT_USER_PREFERENCES, ...(data.preferences || {}) };
        localStorage.setItem(this.prefsKey(userId), JSON.stringify(preferences));
        return preferences;
      }
    } catch (error) {
      console.error('Error loading user preferences from Firestore:', error);
    }

    return this.getCachedPreferences(userId) || { ...DEFAULT_USER_PREFERENCES };
  }

  async savePreferences(userId: string, preferences: UserPreferences): Promise<void> {
    localStorage.setItem(this.prefsKey(userId), JSON.stringify(preferences));

    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          preferences,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving user preferences to Firestore:', error);
    }
  }

  // --- Avatar (Firebase Storage) ---

  async uploadAvatar(userId: string, dataUrl: string): Promise<string> {
    const avatarRef = ref(storage, `avatars/${userId}.jpg`);
    await uploadString(avatarRef, dataUrl, 'data_url');
    return getDownloadURL(avatarRef);
  }

  async deleteAvatar(userId: string): Promise<void> {
    try {
      await deleteObject(ref(storage, `avatars/${userId}.jpg`));
    } catch (error: any) {
      if (error?.code !== 'storage/object-not-found') {
        console.error('Error deleting avatar from Storage:', error);
      }
    }
  }

  // --- Opponent reports ---

  getCachedOpponentReports(userId?: string): ChessReport[] {
    if (!userId) return [];
    const raw = localStorage.getItem(this.opponentReportsKey(userId));
    if (!raw) return [];
    try {
      return (JSON.parse(raw) as ChessReport[]).map(reviveReport);
    } catch {
      return [];
    }
  }

  async loadOpponentReports(userId?: string): Promise<ChessReport[]> {
    if (!userId) return [];

    try {
      const snapshot = await getDocs(
        query(this.opponentReportsCollection(userId), orderBy('generatedAt', 'desc'))
      );

      if (!snapshot.empty) {
        const reports = snapshot.docs.map((item) => reviveReport(item.data() as ChessReport));
        localStorage.setItem(this.opponentReportsKey(userId), JSON.stringify(reports));
        return reports;
      }
    } catch (error) {
      console.error('Error loading opponent reports from Firestore:', error);
    }

    const cached = this.getCachedOpponentReports(userId);
    if (cached.length > 0) {
      // Migrate legacy localStorage reports into Firestore.
      await this.saveOpponentReports(userId, cached);
    }
    return cached;
  }

  async saveOpponentReports(userId: string, reports: ChessReport[]): Promise<void> {
    localStorage.setItem(this.opponentReportsKey(userId), JSON.stringify(reports));

    try {
      const existing = await getDocs(this.opponentReportsCollection(userId));
      const keepIds = new Set(reports.map((report) => report.id));
      const deletions = existing.docs.filter((item) => !keepIds.has(item.id));

      for (let i = 0; i < deletions.length; i += 400) {
        const batch = writeBatch(db);
        deletions.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
        await batch.commit();
      }

      for (let i = 0; i < reports.length; i += 400) {
        const batch = writeBatch(db);
        reports.slice(i, i + 400).forEach((report) => {
          batch.set(doc(this.opponentReportsCollection(userId), report.id), toPlain(report), {
            merge: true,
          });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error saving opponent reports to Firestore:', error);
    }
  }

  async upsertOpponentReport(userId: string, report: ChessReport): Promise<ChessReport[]> {
    const existing = await this.loadOpponentReports(userId);
    const reportKey = `${report.platform}:${report.username.trim().toLowerCase()}`;
    const next = [
      report,
      ...existing.filter(
        (item) => `${item.platform}:${item.username.trim().toLowerCase()}` !== reportKey
      ),
    ].sort(
      (left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime()
    );

    await this.saveOpponentReports(userId, next);
    return next;
  }

  // --- Self / profile report history ---

  async saveReport(userId: string, report: ChessReport, kind: 'self' | 'opponent' = 'self'): Promise<void> {
    try {
      await setDoc(
        doc(this.reportsCollection(userId), report.id),
        toPlain({ ...report, kind, userId }),
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving report history to Firestore:', error);
    }
  }

  async loadReportHistory(userId?: string): Promise<ChessReport[]> {
    if (!userId) return [];

    try {
      const snapshot = await getDocs(
        query(this.reportsCollection(userId), orderBy('generatedAt', 'desc'))
      );
      return snapshot.docs.map((item) => reviveReport(item.data() as ChessReport));
    } catch (error) {
      console.error('Error loading report history from Firestore:', error);
      return [];
    }
  }

  // --- Puzzle progress ---

  getCachedPuzzleProgress(userId?: string): PuzzleProgress | null {
    if (!userId) return null;
    const raw = localStorage.getItem(this.puzzleProgressKey(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PuzzleProgress;
    } catch {
      return null;
    }
  }

  async loadPuzzleProgress(userId?: string): Promise<PuzzleProgress> {
    if (!userId) return DEFAULT_PUZZLE_PROGRESS('');

    try {
      const snapshot = await getDoc(this.puzzleProgressRef(userId));
      if (snapshot.exists()) {
        const progress = snapshot.data() as PuzzleProgress;
        localStorage.setItem(this.puzzleProgressKey(userId), JSON.stringify(progress));
        return progress;
      }
    } catch (error) {
      console.error('Error loading puzzle progress from Firestore:', error);
    }

    return this.getCachedPuzzleProgress(userId) || DEFAULT_PUZZLE_PROGRESS(userId);
  }

  async savePuzzleProgress(progress: PuzzleProgress): Promise<void> {
    const next = { ...progress, updatedAt: new Date().toISOString() };
    localStorage.setItem(this.puzzleProgressKey(progress.userId), JSON.stringify(next));

    try {
      await setDoc(this.puzzleProgressRef(progress.userId), toPlain(next), { merge: true });
    } catch (error) {
      console.error('Error saving puzzle progress to Firestore:', error);
    }
  }

  // --- Game analyses (for puzzle context / review history) ---

  getCachedGameAnalyses(userId?: string): GameAnalysis[] {
    if (!userId) return [];
    const raw = localStorage.getItem(this.analysesKey(userId));
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
        return (parsed as Array<[string, GameAnalysis]>).map(([, analysis]) => reviveAnalysis(analysis));
      }
      return (parsed as GameAnalysis[]).map(reviveAnalysis);
    } catch {
      return [];
    }
  }

  async loadGameAnalyses(userId?: string): Promise<GameAnalysis[]> {
    if (!userId) return [];

    try {
      const snapshot = await getDocs(
        query(this.analysesCollection(userId), orderBy('analyzedAt', 'desc'))
      );
      if (!snapshot.empty) {
        const analyses = snapshot.docs.map((item) => reviveAnalysis(item.data() as GameAnalysis));
        localStorage.setItem(this.analysesKey(userId), JSON.stringify(analyses));
        return analyses;
      }
    } catch (error) {
      console.error('Error loading game analyses from Firestore:', error);
    }

    const cached = this.getCachedGameAnalyses(userId);
    if (cached.length > 0) {
      await this.saveGameAnalyses(userId, cached);
    }
    return cached;
  }

  async saveGameAnalyses(userId: string, analyses: GameAnalysis[]): Promise<void> {
    localStorage.setItem(this.analysesKey(userId), JSON.stringify(analyses));

    try {
      for (let i = 0; i < analyses.length; i += 400) {
        const batch = writeBatch(db);
        analyses.slice(i, i + 400).forEach((analysis) => {
          batch.set(doc(this.analysesCollection(userId), analysis.gameId), toPlain(analysis), {
            merge: true,
          });
        });
        await batch.commit();
      }
    } catch (error) {
      console.error('Error saving game analyses to Firestore:', error);
    }
  }

  async upsertGameAnalysis(userId: string, analysis: GameAnalysis): Promise<void> {
    const existing = await this.loadGameAnalyses(userId);
    const next = [analysis, ...existing.filter((item) => item.gameId !== analysis.gameId)].slice(0, 50);
    await this.saveGameAnalyses(userId, next);
  }

  async deleteOpponentReport(userId: string, reportId: string): Promise<void> {
    const next = (await this.loadOpponentReports(userId)).filter((report) => report.id !== reportId);
    await this.saveOpponentReports(userId, next);
    try {
      await deleteDoc(doc(this.opponentReportsCollection(userId), reportId));
    } catch (error) {
      console.error('Error deleting opponent report:', error);
    }
  }
}

export const userDataService = new UserDataService();
