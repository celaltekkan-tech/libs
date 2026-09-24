import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { canCheckStoreUpdates } from './appVersion';

type InAppUpdatesModule = typeof import('expo-in-app-updates');

// Native modül Expo Go'da yoktur; import anında patlamaması için tembel yüklenir.
let cachedModule: InAppUpdatesModule | null | undefined;
function loadModule(): InAppUpdatesModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('expo-in-app-updates') as InAppUpdatesModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

// Uygulama öne geldiğinde en fazla bu aralıkla tekrar sorulur.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// Google Play Console / Publishing API'de bu öncelik ve üzeri verilen sürüm
// zorunlu (tam ekran, atlanamaz) güncelleme olarak başlatılır.
const IMMEDIATE_PRIORITY = 4;

export type StoreUpdateStatus = 'idle' | 'available' | 'downloading';

export interface StoreUpdateState {
  status: StoreUpdateStatus;
  storeVersion: string | null;
  startUpdate: () => Promise<void>;
  dismiss: () => void;
}

// Google Play In-App Updates (iOS'ta App Store araması) ile mağazada daha yeni
// sürüm olup olmadığını denetler. Play'e yeni sürüm yayınlandığında sunucu
// tarafında ek bir ayar gerekmez.
export function useStoreUpdate(): StoreUpdateState {
  const [status, setStatus] = useState<StoreUpdateStatus>('idle');
  const [storeVersion, setStoreVersion] = useState<string | null>(null);
  const lastCheckRef = useRef(0);
  const dismissedVersionRef = useRef<string | null>(null);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    const mod = canCheckStoreUpdates() ? loadModule() : null;
    if (!mod || checkingRef.current) return;
    checkingRef.current = true;
    lastCheckRef.current = Date.now();
    try {
      const result = await mod.checkForUpdate();
      if (result.updateInProgress) {
        setStatus('downloading');
        return;
      }
      if (!result.updateAvailable) {
        setStatus('idle');
        return;
      }
      if ((result.serverPriority ?? 0) >= IMMEDIATE_PRIORITY && result.immediateAllowed) {
        await mod.startUpdate(true);
        return;
      }
      setStoreVersion(result.storeVersion || null);
      if (dismissedVersionRef.current !== result.storeVersion) setStatus('available');
    } catch {
      // Play Store yoksa, uygulama Play dışından kurulduysa ya da ağ yoksa sessizce geç.
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const mod = canCheckStoreUpdates() ? loadModule() : null;
    if (!mod) return;

    check();

    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - lastCheckRef.current > RECHECK_INTERVAL_MS) check();
    });
    // İndirme bittiğinde modül completeUpdate çağırıp uygulamayı yeniden başlatır.
    const offStart = mod.addUpdateListener('updateStart', () => setStatus('downloading'));
    const offCancel = mod.addUpdateListener('updateCancelled', () => setStatus('available'));

    return () => {
      appStateSub.remove();
      offStart();
      offCancel();
    };
  }, [check]);

  const startUpdate = useCallback(async () => {
    const mod = loadModule();
    if (!mod) return;
    try {
      const started = await mod.startUpdate(false);
      if (started) setStatus('downloading');
    } catch {
      // Kullanıcı mağaza akışını kapatırsa bildirim yerinde kalır.
    }
  }, []);

  const dismiss = useCallback(() => {
    dismissedVersionRef.current = storeVersion;
    setStatus('idle');
  }, [storeVersion]);

  return { status, storeVersion, startUpdate, dismiss };
}
