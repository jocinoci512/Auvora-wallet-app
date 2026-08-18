/**
 * Admin realtime event contract + pure SSE parsing/backoff helpers.
 *
 * These mirror the backend `auvora:admin:events` envelope. Everything here is
 * framework-free and pure so it can be unit-tested in a node environment without
 * a DOM, `EventSource`, or a live server.
 */

export type AdminEventType =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'ACCOUNT_STATUS_CHANGED'
  | 'DEVICE_REGISTERED'
  | 'DEVICE_REVOKED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'WALLET_ADDED'
  | 'WALLET_REMOVED'
  | 'CONNECTION_CREATED'
  | 'CONNECTION_DISCONNECTED'
  | 'SIGN_REQUEST_CREATED'
  | 'SIGN_REQUEST_COMPLETED'
  | 'SIGN_REQUEST_FAILED'
  | 'SECURITY_EVENT'
  | 'SERVICE_HEALTH_CHANGED'
  | 'FEATURE_FLAG_CHANGED'
  | 'ANNOUNCEMENT'
  | 'MAINTENANCE_CHANGED'
  | 'TRANSACTION_REVIEW_REQUESTED'
  | 'TRANSACTION_REVIEW_DECIDED'
  | 'COMPLIANCE_STATUS_CHANGED';

export type AdminEventSeverity = 'info' | 'warning' | 'critical';

export interface AdminEvent {
  id: string;
  type: AdminEventType;
  timestamp: string;
  service: string;
  severity: AdminEventSeverity;
  userId?: string;
  targetId?: string;
  platform?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

/** Event types that should trigger a targeted refresh of the user directory. */
export const USER_DIRECTORY_EVENT_TYPES: ReadonlySet<AdminEventType> = new Set<AdminEventType>([
  'USER_CREATED',
  'USER_UPDATED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'ACCOUNT_STATUS_CHANGED',
  'DEVICE_REGISTERED',
  'DEVICE_REVOKED',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'SECURITY_EVENT',
]);

export function affectsUserDirectory(type: AdminEventType): boolean {
  return USER_DIRECTORY_EVENT_TYPES.has(type);
}

interface ParsedFrame {
  id?: string;
  event?: string;
  data?: string;
}

/**
 * Incremental Server-Sent Events parser. Feed it decoded text chunks; it returns
 * any complete frames and buffers partial ones. Comment lines (starting with
 * `:`, e.g. heartbeats) are ignored.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): ParsedFrame[] {
    this.buffer += chunk;
    const frames: ParsedFrame[] = [];
    let sep = this.findSeparator();
    while (sep.index !== -1) {
      const rawFrame = this.buffer.slice(0, sep.index);
      this.buffer = this.buffer.slice(sep.index + sep.length);
      const frame = SseParser.parseFrame(rawFrame);
      if (frame) frames.push(frame);
      sep = this.findSeparator();
    }
    return frames;
  }

  private findSeparator(): { index: number; length: number } {
    const lf = this.buffer.indexOf('\n\n');
    const crlf = this.buffer.indexOf('\r\n\r\n');
    if (lf === -1 && crlf === -1) return { index: -1, length: 0 };
    if (crlf === -1) return { index: lf, length: 2 };
    if (lf === -1) return { index: crlf, length: 4 };
    return lf < crlf ? { index: lf, length: 2 } : { index: crlf, length: 4 };
  }

  private static parseFrame(raw: string): ParsedFrame | null {
    const frame: ParsedFrame = {};
    let hasField = false;
    for (const line of raw.split(/\r?\n/)) {
      if (line === '' || line.startsWith(':')) continue; // comment / heartbeat
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'id') {
        frame.id = value;
        hasField = true;
      } else if (field === 'event') {
        frame.event = value;
        hasField = true;
      } else if (field === 'data') {
        frame.data = frame.data === undefined ? value : `${frame.data}\n${value}`;
        hasField = true;
      }
    }
    return hasField ? frame : null;
  }
}

const KNOWN_TYPES = new Set<AdminEventType>(USER_DIRECTORY_EVENT_TYPES);
for (const t of [
  'WALLET_ADDED',
  'WALLET_REMOVED',
  'CONNECTION_CREATED',
  'CONNECTION_DISCONNECTED',
  'SIGN_REQUEST_CREATED',
  'SIGN_REQUEST_COMPLETED',
  'SIGN_REQUEST_FAILED',
  'SERVICE_HEALTH_CHANGED',
  'FEATURE_FLAG_CHANGED',
  'ANNOUNCEMENT',
  'MAINTENANCE_CHANGED',
  'TRANSACTION_REVIEW_REQUESTED',
  'TRANSACTION_REVIEW_DECIDED',
  'COMPLIANCE_STATUS_CHANGED',
] as AdminEventType[]) {
  KNOWN_TYPES.add(t);
}

/** Parse and validate a frame's `data` JSON into a typed AdminEvent (or null). */
export function parseAdminEvent(frame: ParsedFrame): AdminEvent | null {
  if (!frame.data) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(frame.data);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const e = obj as Partial<AdminEvent>;
  if (typeof e.type !== 'string' || !KNOWN_TYPES.has(e.type as AdminEventType)) return null;
  if (typeof e.id !== 'string' || typeof e.timestamp !== 'string') return null;
  return e as AdminEvent;
}

/**
 * Bounded exponential backoff with full jitter. `attempt` is 0-based. The result
 * is clamped to [base, max]. Deterministic when `rng` is provided (for tests).
 */
export function nextBackoffMs(
  attempt: number,
  base = 1000,
  max = 30_000,
  rng: () => number = Math.random,
): number {
  const exp = Math.min(max, base * 2 ** Math.max(0, attempt));
  const jittered = base + rng() * (exp - base);
  return Math.min(max, Math.round(jittered));
}
