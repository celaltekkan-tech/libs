import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearToken, getStoredToken, persistToken, setUnauthorizedHandler } from '../api/client';
import {
  changePassword as changePasswordRequest,
  fetchCurrentSession,
  login as loginRequest,
} from '../api/auth';
import type { AuthSession, SessionUser } from '../types/api';

interface AuthContextValue {
  user: SessionUser | null;
  permissions: string[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  applySession: (session: AuthSession) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
    setPermissions([]);
  }, []);

  const applySession = useCallback(async (session: AuthSession) => {
    await persistToken(session.token);
    setUser(session.user);
    setPermissions(session.permissions);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      try {
        const session = await fetchCurrentSession();
        setUser(session.user);
        setPermissions(session.permissions);
      } catch {
        setUser(null);
        setPermissions([]);
      } finally {
        setIsLoading(false);
      }
    })();
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await loginRequest(email, password);
      await applySession(session);
    },
    [applySession],
  );

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await changePasswordRequest(currentPassword, newPassword);
    await persistToken(result.token);
  }, []);

  const value = useMemo(
    () => ({ user, permissions, isLoading, login, applySession, changePassword, logout }),
    [user, permissions, isLoading, login, applySession, changePassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  return ctx;
}
