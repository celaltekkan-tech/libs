import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearServerUrl, getStoredServerUrl, persistServerUrl, setApiBaseUrl } from '../api/client';

interface ServerConfigContextValue {
  apiBaseUrl: string | null;
  isLoading: boolean;
  saveApiBaseUrl: (url: string) => Promise<void>;
  resetApiBaseUrl: () => Promise<void>;
}

const ServerConfigContext = createContext<ServerConfigContextValue | null>(null);

export function ServerConfigProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrlState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await getStoredServerUrl();
      setApiBaseUrl(stored);
      setApiBaseUrlState(stored);
      setIsLoading(false);
    })();
  }, []);

  const saveApiBaseUrl = useCallback(async (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    await persistServerUrl(trimmed);
    setApiBaseUrlState(trimmed);
  }, []);

  const resetApiBaseUrl = useCallback(async () => {
    await clearServerUrl();
    setApiBaseUrlState(null);
  }, []);

  const value = useMemo(
    () => ({ apiBaseUrl, isLoading, saveApiBaseUrl, resetApiBaseUrl }),
    [apiBaseUrl, isLoading, saveApiBaseUrl, resetApiBaseUrl],
  );

  return <ServerConfigContext.Provider value={value}>{children}</ServerConfigContext.Provider>;
}

export function useServerConfig(): ServerConfigContextValue {
  const ctx = useContext(ServerConfigContext);
  if (!ctx) throw new Error('useServerConfig, ServerConfigProvider içinde kullanılmalıdır');
  return ctx;
}
