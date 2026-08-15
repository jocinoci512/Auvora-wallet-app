'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';
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
 * Auth-aware admin realtime client (SSE over fetch so we can send the admin
 * Bearer token — `EventSource` cannot set headers). Reconnects with bounded
 * backoff, exposes a visible connection status, and cleans up fully on unmount /
 * token loss. The browser only ever talks to the Gateway; never to Redis.
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
    const token = getStoredAccessToken();
    if (!token) {
      setStatus('offline');
      // Retry later in case the operator pastes a token.
      scheduleReconnect();
      return;
    }

    const runId = ++runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    try {
      const url = `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/v1/admin/realtime/events`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
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
    return () => {
      stoppedRef.current = true;
      runIdRef.current += 1;
      clearTimer();
      abortRef.current?.abort();
      setStatus('offline');
    };
  }, [enabled, connect]);

  return { status, events, lastEventAt, reconnect };
}
