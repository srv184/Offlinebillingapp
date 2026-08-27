import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AuthenticationService } from '@/services/AuthenticationService';

interface AuthContextValue {
  isSetupComplete: boolean;
  isLocked: boolean;
  userName: string | null;
  loading: boolean;
  completeSetup: (name: string, pin: string, confirmPin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  lockNow: () => void;
  refreshUserName: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Owns the app-wide lock/unlock state. Locking is driven purely by:
 *  1. App lifecycle events (background/foreground) via AppState.
 *  2. A persisted lastAuthenticatedAt timestamp + configurable timeout.
 *  3. Whatever locked state we start up in (fresh process launch always
 *     re-checks against the persisted timestamp -- it never assumes the
 *     previous session's in-memory unlocked state survived).
 * This deliberately never tries to infer whether the app was "still in
 * RAM" -- that's an OS-level detail this app does not rely on.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const refreshUserName = useCallback(async () => {
    const name = await AuthenticationService.getUserName();
    setUserName(name);
  }, []);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    const setupComplete = await AuthenticationService.isSetupComplete();
    setIsSetupComplete(setupComplete);
    if (setupComplete) {
      const name = await AuthenticationService.getUserName();
      setUserName(name);
      const needsAuth = await AuthenticationService.isAuthenticationRequired();
      setIsLocked(needsAuth);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;

      if ((prevState === 'active') && (nextState === 'background' || nextState === 'inactive')) {
        await AuthenticationService.recordBackgrounded();
      }

      if (prevState.match(/inactive|background/) && nextState === 'active') {
        if (!isSetupComplete) return;
        const needsAuth = await AuthenticationService.isAuthenticationRequired();
        if (needsAuth) setIsLocked(true);
      }
    });
    return () => subscription.remove();
  }, [isSetupComplete]);

  const completeSetup = useCallback(async (name: string, pin: string, confirmPin: string) => {
    await AuthenticationService.setup(name, pin, confirmPin);
    setIsSetupComplete(true);
    setUserName(name.trim());
    setIsLocked(false);
  }, []);

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const ok = await AuthenticationService.verifyPin(pin);
    if (ok) setIsLocked(false);
    return ok;
  }, []);

  const lockNow = useCallback(() => {
    setIsLocked(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isSetupComplete, isLocked, userName, loading, completeSetup, unlock, lockNow, refreshUserName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
