import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Keeps theme preference bidirectional between ThemeContext and the signed-in user doc.
 */
const UserPrefsSync: React.FC = () => {
  const { currentUser, updatePreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const lastSyncedUserId = useRef<string | null>(null);
  const skipNextWrite = useRef(false);

  // Apply cloud theme when the signed-in user changes.
  useEffect(() => {
    if (!currentUser) {
      lastSyncedUserId.current = null;
      return;
    }

    if (lastSyncedUserId.current === currentUser.id) return;
    lastSyncedUserId.current = currentUser.id;

    const cloudTheme = currentUser.preferences?.theme;
    if (cloudTheme && cloudTheme !== theme) {
      skipNextWrite.current = true;
      setTheme(cloudTheme);
    }
  }, [currentUser, setTheme, theme]);

  // Persist theme changes for the signed-in user.
  useEffect(() => {
    if (!currentUser) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    if (currentUser.preferences?.theme === theme) return;

    void updatePreferences({ theme });
  }, [currentUser, theme, updatePreferences]);

  return null;
};

export default UserPrefsSync;
