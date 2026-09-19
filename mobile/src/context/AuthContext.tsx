import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearToken, getStoredToken, persistToken, setUnauthorizedHandler } from '../api/client';
import { fetchCurrentSession, login as loginRequest } from '../api/auth';
import type { SessionUser } from '../types/api';

interface AuthContextValue {
  user: SessionUser | null;
  permissions: string[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
        // Token geçersiz/süresi dolmuş: 401 interceptor'ı zaten token'ı temizledi.
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

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password);
    await persistToken(session.token);
    setUser(session.user);
    setPermissions(session.permissions);
  }, []);

  const value = useMemo(
    () => ({ user, permissions, isLoading, login, logout }),
    [user, permissions, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalıdır');
  return ctx;
}
