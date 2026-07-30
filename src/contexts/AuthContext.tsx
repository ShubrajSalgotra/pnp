import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { 
  User as FirebaseUser, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { userDataService } from '../services/userDataService';
import { userProfileService } from '../services/userProfileService';
import { User } from '../types';
import { DEFAULT_USER_PREFERENCES, UserPreferences } from '../types/userData';
import { fileToAvatarDataUrl } from '../utils/avatar';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<{ user: User; isNewUser: boolean }>;
  register: (email: string, password: string, displayName: string, role: string) => Promise<User>;
  logout: () => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  setAvatarUrl: (avatarUrl: string | null) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  const applyUser = useCallback((userData: User) => {
    currentUserRef.current = userData;
    setCurrentUser(userData);
  }, []);

  const syncProfile = useCallback(async (
    authUser: FirebaseUser,
    overrides: Parameters<typeof userProfileService.ensureProfile>[1] = {}
  ): Promise<User> => {
    try {
      return await userProfileService.ensureProfile(authUser, overrides);
    } catch (error) {
      console.error('Firestore profile sync failed; using Auth identity fallback:', error);
      const cached = userProfileService.getCachedProfile(authUser.uid);
      if (cached) {
        return {
          ...cached,
          ...overrides,
          displayName: overrides.displayName || cached.displayName,
          email: overrides.email || cached.email,
          avatarUrl: overrides.avatarUrl ?? cached.avatarUrl,
        };
      }

      return {
        id: authUser.uid,
        email: overrides.email || authUser.email || '',
        displayName:
          overrides.displayName ||
          authUser.displayName ||
          (authUser.email ? authUser.email.split('@')[0] : 'User'),
        role: overrides.role || 'child',
        isPremium: overrides.isPremium ?? false,
        avatarUrl: overrides.avatarUrl ?? authUser.photoURL ?? null,
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          ...(overrides.preferences || {}),
        },
        createdAt: authUser.metadata?.creationTime
          ? new Date(authUser.metadata.creationTime)
          : new Date(),
        updatedAt: new Date(),
      };
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);
      const userData = await syncProfile(result.user);
      applyUser(userData);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (): Promise<{ user: User; isNewUser: boolean }> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);
      
      const userData = await syncProfile(result.user, {
        displayName: result.user.displayName || undefined,
        email: result.user.email || undefined,
        avatarUrl: result.user.photoURL,
      });
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
      applyUser(userData);
      return { user: userData, isNewUser };
      
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, displayName: string, role: string): Promise<User> => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(result.user, {
        displayName: displayName
      });

      const storedTheme = localStorage.getItem('pawnsposes-theme');
      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);

      const userData = await syncProfile(result.user, {
        displayName,
        email: result.user.email || email,
        role: role as User['role'],
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          theme: storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : DEFAULT_USER_PREFERENCES.theme,
        },
      });

      applyUser(userData);
      return userData;
      
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('authToken');
      currentUserRef.current = null;
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const setAvatarUrl = useCallback(async (avatarUrl: string | null) => {
    const prev = currentUserRef.current;
    if (!prev) return;

    const updatedUser: User = { ...prev, avatarUrl, updatedAt: new Date() };
    applyUser(updatedUser);
    await userProfileService.saveProfile(updatedUser);
  }, [applyUser]);

  const updateAvatar = useCallback(async (file: File) => {
    const prev = currentUserRef.current;
    if (!prev) {
      throw new Error('You must be signed in to update your avatar.');
    }

    const dataUrl = await fileToAvatarDataUrl(file);
    let avatarUrl = dataUrl;

    try {
      avatarUrl = await userDataService.uploadAvatar(prev.id, dataUrl);
    } catch (error) {
      console.error('Avatar Storage upload failed, falling back to inline image:', error);
    }

    const updatedUser: User = { ...prev, avatarUrl, updatedAt: new Date() };
    applyUser(updatedUser);
    await userProfileService.saveProfile(updatedUser);
  }, [applyUser]);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const prev = currentUserRef.current;
    const authUser = auth.currentUser;
    if (!prev || !authUser) {
      throw new Error('You must be signed in to update your name.');
    }

    const nextName = displayName.trim();
    if (!nextName) {
      throw new Error('Display name cannot be empty.');
    }

    await updateProfile(authUser, { displayName: nextName });

    const updatedUser: User = { ...prev, displayName: nextName, updatedAt: new Date() };
    applyUser(updatedUser);
    await userProfileService.saveProfile(updatedUser);
  }, [applyUser]);

  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    const prev = currentUserRef.current;
    if (!prev) return;

    const nextPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      ...(prev.preferences || {}),
      ...preferences,
    };

    const updatedUser: User = {
      ...prev,
      preferences: nextPreferences,
      updatedAt: new Date(),
    };

    applyUser(updatedUser);
    await userProfileService.saveProfile(updatedUser);
    await userDataService.savePreferences(prev.id, nextPreferences);
  }, [applyUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // Paint immediately from local cache so reloads aren't blocked on network.
        const cached = userProfileService.getCachedProfile(user.uid);
        if (cached) {
          applyUser({
            ...cached,
            displayName: user.displayName || cached.displayName,
            email: user.email || cached.email,
            avatarUrl: user.photoURL ?? cached.avatarUrl,
          });
          setLoading(false);
        }

        // Upsert Auth identity into Firestore (may refresh fields after first paint).
        const userData = await syncProfile(user, {
          displayName: user.displayName || undefined,
          email: user.email || undefined,
          avatarUrl: user.photoURL,
        });
        applyUser(userData);

        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);

        // Local→cloud migration is best-effort and must not block first paint.
        void (async () => {
          try {
            await userDataService.migrateLocalCachesToCloud(user.uid);
            const { profileAnalysisService } = await import('../services/profileAnalysisService');
            const localProfile = profileAnalysisService.getProfile(user.uid);
            if (localProfile) {
              await profileAnalysisService.saveProfile(localProfile);
            }
          } catch (migrateError) {
            console.error('Local→Firestore migration failed:', migrateError);
          }
        })();
      } else {
        currentUserRef.current = null;
        setCurrentUser(null);
        localStorage.removeItem('authToken');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [applyUser, syncProfile]);

  const value: AuthContextType = {
    currentUser,
    firebaseUser,
    login,
    loginWithGoogle,
    register,
    logout,
    updateAvatar,
    setAvatarUrl,
    updateDisplayName,
    updatePreferences,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="app-canvas flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
