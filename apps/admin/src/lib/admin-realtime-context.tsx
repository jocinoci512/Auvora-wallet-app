'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useAdminRealtime, type UseAdminRealtimeResult } from './realtime/useAdminRealtime';
import type { AdminEvent } from './realtime/admin-event';

type Listener = (event: AdminEvent) => void;

interface AdminRealtimeValue extends UseAdminRealtimeResult {
  subscribe: (listener: Listener) => () => void;
}

const AdminRealtimeContext = createContext<AdminRealtimeValue | null>(null);

export function AdminRealtimeProvider({ children }: { children: ReactNode }): ReactElement {
  const listeners = useRef(new Set<Listener>());
  const realtime = useAdminRealtime({
    onEvent: (event) => {
      listeners.current.forEach((listener) => listener(event));
    },
  });

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value = useMemo(() => ({ ...realtime, subscribe }), [realtime, subscribe]);

  return <AdminRealtimeContext.Provider value={value}>{children}</AdminRealtimeContext.Provider>;
}

export function useAdminRealtimeContext(): AdminRealtimeValue {
  const value = useContext(AdminRealtimeContext);
  if (!value) {
    throw new Error('Admin realtime context is not available');
  }
  return value;
}

export function useRealtimeRefetch(
  shouldRefresh: (event: AdminEvent) => boolean,
  reload: () => void,
  delayMs = 1200,
): void {
  const { subscribe } = useAdminRealtimeContext();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe((event) => {
      if (!shouldRefresh(event)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reloadRef.current(), delayMs);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe, shouldRefresh, delayMs]);
}
