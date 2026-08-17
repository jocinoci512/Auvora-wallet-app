'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '../../env';
import { ACCESS_TOKEN_CHANGED_EVENT, getStoredAccessToken, isProductionBuild } from '../api-client';
import {
  SseParser,
  nextBackoffMs,
  parseAdminEvent,
  type AdminEvent,
  type RealtimeStatus,
} from './admin-event';

const MAX_BUFFERED_EVENTS = 100;

export interface UseAdminRealtimeOptions {
  /** Called for every parsed event (targeted refetch / feed updates live here). */
  onEvent?: (event: AdminEvent) => void;
  /** Ring-buffer size for the in-memory activity feed. */
  bufferSize?: number;
  /** Allow tests/pages to disable auto-connect. */
  enabled?: boolean;
}

export interface UseAdminRealtimeResult {
  status: RealtimeStatus;
  events: AdminEvent[];
  lastEventAt: number | null;
  reconnect: () => void;
}

/**
 * Admin realtime client. Production uses HttpOnly admin_access_token cookies
 * (`credentials: 'include'`). Non-production may still send a pasted Bearer token.
 */
export function useAdminRealtime(options: UseAdminRealtimeOptions = {}): UseAdminRealtimeResult {
  const { onEvent, bufferSize = MAX_BUFFERED_EVENTS, enabled = true } = options;
  const [status, setStatus] = useState<RealtimeStatus>('offline');
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const abortRef = useRef<AbortController | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const runIdRef = useRef(0);

  const clearTimer = (): void => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  };

  const connect = useCallback(async () => {
    if (stoppedRef.current) return;
    const token = isProductionBuild() ? null : getStoredAccessToken();
    if (!isProductionBuild() && !token) {
      setStatus('offline');
      scheduleReconnect();
      return;
    }

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    try {
      const url = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/admin/realtime/events`;
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // 401/403 → auth problem; still back off rather than hammering.
        throw new Error(`realtime connect failed: ${res.status}`);
      }

      attemptRef.current = 0;
      setStatus('connected');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (runId !== runIdRef.current) break; // superseded
        const chunk = decoder.decode(value, { stream: true });
        for (const frame of parser.push(chunk)) {
          const event = parseAdminEvent(frame);
          if (!event) continue;
          setLastEventAt(Date.now());
          setEvents((prev) => {
            const next = [event, ...prev];
            return next.length > bufferSize ? next.slice(0, bufferSize) : next;
          });
          onEventRef.current?.(event);
        }
      }
      // Stream ended by server — reconnect unless we were stopped.
      if (!stoppedRef.current && runId === runIdRef.current) {
        setStatus('reconnecting');
        scheduleReconnect();
      }
    } catch {
      if (controller.signal.aborted || stoppedRef.current) return;
      setStatus('reconnecting');
      scheduleReconnect();
    }
  }, [bufferSize]);

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current) return;
    clearTimer();
    const delay = nextBackoffMs(attemptRef.current);
    attemptRef.current += 1;
    reconnectTimer.current = setTimeout(() => {
      void connect();
    }, delay);
  }, [connect]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    abortRef.current?.abort();
    clearTimer();
    void connect();
  }, [connect]);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;
    void connect();

    // Reconnect immediately when the admin token changes (same-tab custom event
    // and cross-tab storage event) instead of waiting out the backoff.
    const onTokenChange = (): void => {
      attemptRef.current = 0;
      abortRef.current?.abort();
      clearTimer();
      void connect();
    };
    const onStorage = (e: StorageEvent): void => {
      if (e.key === null || e.key === 'auvora_access_token') onTokenChange();
    };
    window.addEventListener(ACCESS_TOKEN_CHANGED_EVENT, onTokenChange);
    window.addEventListener('storage', onStorage);

    return () => {
      stoppedRef.current = true;
      runIdRef.current += 1;
      clearTimer();
      abortRef.current?.abort();
      window.removeEventListener(ACCESS_TOKEN_CHANGED_EVENT, onTokenChange);
      window.removeEventListener('storage', onStorage);
      setStatus('offline');
    };
  }, [enabled, connect]);

  return { status, events, lastEventAt, reconnect };
}
