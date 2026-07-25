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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { userDataService } from '../services/userDataService';
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

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const saveUserData = useCallback(async (userData: User) => {
    const payload = {
      ...userData,
      preferences: userData.preferences || DEFAULT_USER_PREFERENCES,
      createdAt: userData.createdAt.toISOString(),
      updatedAt: (userData.updatedAt || new Date()).toISOString(),
    };

    localStorage.setItem(`user-${userData.id}`, JSON.stringify(payload));

    try {
      await setDoc(doc(db, 'users', userData.id), payload, { merge: true });
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);
    }
  }, []);

  const loadUserData = useCallback(async (user: FirebaseUser): Promise<User> => {
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid));

      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        return {
          id: user.uid,
          email: data.email || user.email!,
          displayName: data.displayName || user.displayName || 'User',
          role: data.role || 'child',
          isPremium: data.isPremium || false,
          avatarUrl: data.avatarUrl || user.photoURL || null,
          preferences: { ...DEFAULT_USER_PREFERENCES, ...(data.preferences || {}) },
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
        };
      }
    } catch (error) {
      console.error('Error loading user data from Firestore:', error);

      const cachedUser = localStorage.getItem(`user-${user.uid}`);
      if (cachedUser) {
        const data = JSON.parse(cachedUser);
        return {
          ...data,
          avatarUrl: data.avatarUrl || user.photoURL || null,
          preferences: { ...DEFAULT_USER_PREFERENCES, ...(data.preferences || {}) },
          createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
        };
      }
    }

    const storedTheme = localStorage.getItem('pawnsposes-theme');
    const userData: User = {
      id: user.uid,
      email: user.email!,
      displayName: user.displayName || 'User',
      role: 'child',
      isPremium: false,
      avatarUrl: user.photoURL || null,
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        theme: storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : DEFAULT_USER_PREFERENCES.theme,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await saveUserData(userData);
    return userData;
  }, [saveUserData]);

  const loginWithGoogle = async (): Promise<{ user: User; isNewUser: boolean }> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);
      
      const userData = await loadUserData(result.user);
      const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
      setCurrentUser(userData);
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
      const userData: User = {
        id: result.user.uid,
        email: result.user.email!,
        displayName: displayName,
        role: role as 'child' | 'parent' | 'coach' | 'admin',
        isPremium: false,
        avatarUrl: result.user.photoURL || null,
        preferences: {
          ...DEFAULT_USER_PREFERENCES,
          theme: storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : DEFAULT_USER_PREFERENCES.theme,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = await result.user.getIdToken();
      localStorage.setItem('authToken', token);
      
      await saveUserData(userData);
      setCurrentUser(userData);
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
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    await saveUserData(updatedUser);
  }, [saveUserData]);

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
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    await saveUserData(updatedUser);
  }, [saveUserData]);

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
    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    await saveUserData(updatedUser);
  }, [saveUserData]);

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

    currentUserRef.current = updatedUser;
    setCurrentUser(updatedUser);
    await saveUserData(updatedUser);
    await userDataService.savePreferences(prev.id, nextPreferences);
  }, [saveUserData]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      
      if (user) {
        const userData = await loadUserData(user);
        
        setCurrentUser(userData);
        
        const token = await user.getIdToken();
        localStorage.setItem('authToken', token);
      } else {
        setCurrentUser(null);
        localStorage.removeItem('authToken');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [loadUserData]);

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
      {!loading && children}
    </AuthContext.Provider>
  );
};
