'use client';

/**
 * Canonical Auvora connectivity / account-health for Web shell.
 * Header Online/Degraded/Offline must match page banners — not navigator.onLine alone.
 */

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
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';
import { isSignedIn } from '../auth/session';

export type AccountHealthLevel = 'online' | 'degraded' | 'offline';

export type AccountHealthSnapshot = {
  level: AccountHealthLevel;
  gatewayOk: boolean;
  accountApiOk: boolean | null;
  connectionsOk: boolean | null;
  message: string;
  checkedAt: string | null;
  refresh: () => void;
};

const AccountHealthContext = createContext<AccountHealthSnapshot>({
  level: 'online',
  gatewayOk: true,
  accountApiOk: null,
  connectionsOk: null,
  message: 'Checking…',
  checkedAt: null,
  refresh: () => undefined,
});

export function useAccountHealth(): AccountHealthSnapshot {
  return useContext(AccountHealthContext);
}

async function probe(url: string, init?: RequestInit): Promise<number | null> {
  try {
    const res = await fetch(url, { ...init, cache: 'no-store' });
    return res.status;
  } catch {
    return null;
  }
}

export function AccountHealthProvider({ children }: { children: ReactNode }): ReactElement {
  const [gatewayOk, setGatewayOk] = useState(true);
  const [accountApiOk, setAccountApiOk] = useState<boolean | null>(null);
  const [connectionsOk, setConnectionsOk] = useState<boolean | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const base = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
      const healthStatus = await probe(`${base}/health`);
      const gw = healthStatus !== null && healthStatus < 500;
      if (cancelled) return;
      setGatewayOk(gw);

      if (!gw || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        setAccountApiOk(false);
        setConnectionsOk(false);
        setCheckedAt(new Date().toISOString());
        return;
      }

      if (!isSignedIn()) {
        setAccountApiOk(null);
        setConnectionsOk(null);
        setCheckedAt(new Date().toISOString());
        return;
      }

      const token = getStoredAccessToken();
      const headers: HeadersInit = {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const meStatus = await probe(`${base}/api/v1/me`, { headers, credentials: 'include' });
      const connStatus = await probe(`${base}/api/v1/connections/dapps/permissions`, {
        headers,
        credentials: 'include',
      });
      if (cancelled) return;
      setAccountApiOk(meStatus !== null && meStatus < 500);
      // 401 is session — still means connections service answered.
      setConnectionsOk(connStatus !== null && connStatus < 500);
      setCheckedAt(new Date().toISOString());
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 45_000);
    const onOnline = () => setTick((n) => n + 1);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, []);

  const value = useMemo<AccountHealthSnapshot>(() => {
    const deviceOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    let level: AccountHealthLevel = 'online';
    let message = 'Connected to Auvora';
    if (!deviceOnline || !gatewayOk) {
      level = 'offline';
      message = !deviceOnline ? 'This device is offline' : 'Cannot reach Auvora';
    } else if (accountApiOk === false || connectionsOk === false) {
      level = 'degraded';
      message = 'Some Auvora services are temporarily unavailable';
    }
    return {
      level,
      gatewayOk,
      accountApiOk,
      connectionsOk,
      message,
      checkedAt,
      refresh,
    };
  }, [gatewayOk, accountApiOk, connectionsOk, checkedAt, refresh]);

  return <AccountHealthContext.Provider value={value}>{children}</AccountHealthContext.Provider>;
}
