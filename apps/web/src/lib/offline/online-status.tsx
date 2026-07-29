'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useToast } from '@auvora/ui';

type OnlineContextValue = {
  online: boolean;
  since: number | null;
};

const OnlineContext = createContext<OnlineContextValue>({ online: true, since: null });

export function useOnlineStatus(): OnlineContextValue {
  return useContext(OnlineContext);
}

function OnlineStatusInner({ children }: { children: ReactNode }): ReactElement {
  const [online, setOnline] = useState(true);
  const [since, setSince] = useState<number | null>(null);
  const { push } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      setSince(Date.now());
      push({
        tone: 'success',
        title: 'Back online',
        description: 'Connection restored. Refreshing live data when available.',
      });
    };
    const onOffline = () => {
      setOnline(false);
      setSince(Date.now());
      push({
        tone: 'warning',
        title: 'You are offline',
        description: 'Showing cached and preview data until the network returns.',
      });
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [push]);

  const value = useMemo(() => ({ online, since }), [online, since]);

  return (
    <OnlineContext.Provider value={value}>
      {!online ? (
        <div className="auvora-network-banner" role="status" aria-live="polite">
          <strong>Offline</strong>
          <span>
            Cached portfolio, metadata, and preview surfaces remain available. Retry when
            reconnected.
          </span>
        </div>
      ) : null}
      {children}
    </OnlineContext.Provider>
  );
}

/** Must nest inside ToastProvider. */
export function OnlineStatusProvider({ children }: { children: ReactNode }): ReactElement {
  return <OnlineStatusInner>{children}</OnlineStatusInner>;
}

export function useRetryWhenOnline(callback: () => void): () => void {
  const { online } = useOnlineStatus();
  return useCallback(() => {
    if (!online) return;
    callback();
  }, [online, callback]);
}
