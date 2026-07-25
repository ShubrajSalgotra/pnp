import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from './firebase';
import { User } from '../types';
import { DEFAULT_USER_PREFERENCES, UserPreferences } from '../types/userData';

export interface UserProfileInput {
  id: string;
  email: string;
  displayName: string;
  role?: User['role'];
  isPremium?: boolean;
  avatarUrl?: string | null;
  preferences?: UserPreferences;
  createdAt?: Date;
}

const toIso = (value?: Date | string | null) => {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

class UserProfileService {
  private cacheKey(userId: string) {
    return `user-${userId}`;
  }

  toFirestorePayload(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isPremium: user.isPremium,
      avatarUrl: user.avatarUrl ?? null,
      preferences: user.preferences || DEFAULT_USER_PREFERENCES,
      createdAt: toIso(user.createdAt),
      updatedAt: toIso(user.updatedAt || new Date()),
    };
  }

  fromFirestore(userId: string, data: Record<string, any>, authUser?: FirebaseUser | null): User {
    return {
      id: userId,
      email: data.email || authUser?.email || '',
      displayName: data.displayName || authUser?.displayName || 'User',
      role: data.role || 'child',
      isPremium: Boolean(data.isPremium),
      avatarUrl: data.avatarUrl ?? authUser?.photoURL ?? null,
      preferences: { ...DEFAULT_USER_PREFERENCES, ...(data.preferences || {}) },
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    };
  }

  getCachedProfile(userId: string): User | null {
    const raw = localStorage.getItem(this.cacheKey(userId));
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return this.fromFirestore(userId, data);
    } catch {
      return null;
    }
  }

  cacheProfile(user: User) {
    localStorage.setItem(this.cacheKey(user.id), JSON.stringify(this.toFirestorePayload(user)));
  }

  async saveProfile(user: User): Promise<void> {
    const payload = this.toFirestorePayload({ ...user, updatedAt: new Date() });
    this.cacheProfile({ ...user, updatedAt: new Date() });
    await setDoc(doc(db, 'users', user.id), payload, { merge: true });
  }

  /**
   * Always upserts a Firestore profile for the signed-in Auth user.
   * Merges existing Firestore fields with Auth identity so name/email stay current.
   */
  async ensureProfile(
    authUser: FirebaseUser,
    overrides: Partial<UserProfileInput> = {}
  ): Promise<User> {
    const ref = doc(db, 'users', authUser.uid);
    let existing: Record<string, any> | null = null;

    try {
      const snapshot = await getDoc(ref);
      if (snapshot.exists()) {
        existing = snapshot.data() as Record<string, any>;
      }
    } catch (error) {
      console.error('Error reading user profile from Firestore:', error);
      existing = this.getCachedProfile(authUser.uid)
        ? this.toFirestorePayload(this.getCachedProfile(authUser.uid)!)
        : null;
    }

    const storedTheme = localStorage.getItem('pawnsposes-theme');
    const theme =
      overrides.preferences?.theme ||
      existing?.preferences?.theme ||
      (storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : DEFAULT_USER_PREFERENCES.theme);

    const profile: User = {
      id: authUser.uid,
      email: overrides.email || existing?.email || authUser.email || '',
      displayName:
        overrides.displayName ||
        existing?.displayName ||
        authUser.displayName ||
        (authUser.email ? authUser.email.split('@')[0] : 'User'),
      role: overrides.role || existing?.role || 'child',
      isPremium: overrides.isPremium ?? existing?.isPremium ?? false,
      avatarUrl: overrides.avatarUrl ?? existing?.avatarUrl ?? authUser.photoURL ?? null,
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        ...(existing?.preferences || {}),
        ...(overrides.preferences || {}),
        theme,
      },
      createdAt: existing?.createdAt
        ? new Date(existing.createdAt)
        : authUser.metadata?.creationTime
          ? new Date(authUser.metadata.creationTime)
          : new Date(),
      updatedAt: new Date(),
    };

    try {
      await this.saveProfile(profile);
    } catch (error) {
      console.error('Error saving user profile to Firestore:', error);
      // Keep local cache so the app still works offline, but surface the failure.
      this.cacheProfile(profile);
      throw error;
    }

    return profile;
  }
}

export const userProfileService = new UserProfileService();
