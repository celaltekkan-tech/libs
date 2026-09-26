import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { fetchUnreadNotificationCount } from '../api/notifications';

const POLL_MS = 60_000;

interface NotificationsContextValue {
  unreadCount: number;
  setUnreadCount: (updater: number | ((prev: number) => number)) => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Zil rozetindeki okunmamış sayısı; uygulama öndeyken periyodik, öne
// gelince anında yenilenir. Push bildirimi yok, sayı sunucudan çekilir.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      setUnreadCount(await fetchUnreadNotificationCount());
    } catch {
      /* sessiz — ağ/oturum hataları header'ı bozmasın */
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void refreshUnreadCount(), POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshUnreadCount();
        if (!timer) timer = setInterval(() => void refreshUnreadCount(), POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, setUnreadCount, refreshUnreadCount }),
    [unreadCount, refreshUnreadCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
