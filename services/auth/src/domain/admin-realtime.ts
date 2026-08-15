/**
 * Admin realtime event contract (Phase 2).
 *
 * This is the single, strongly-typed, secret-free envelope that is published to
 * Redis pub/sub by domain services and streamed to authenticated admin browsers
 * over SSE. The browser NEVER connects to Redis; the Gateway remains the only
 * public edge. Everything here is defensively sanitised so that no secret-bearing
 * field can ever reach an admin client, even if a publisher misbehaves.
 */

/** Canonical Redis pub/sub channel for admin realtime events. Bounded, non-wildcard. */
export const ADMIN_EVENTS_CHANNEL = 'auvora:admin:events';

/** Known, safe admin event types. Unknown types are rejected by the sanitiser. */
export const ADMIN_EVENT_TYPES = [
  'USER_CREATED',
  'USER_UPDATED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'ACCOUNT_STATUS_CHANGED',
  'DEVICE_REGISTERED',
  'DEVICE_REVOKED',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'WALLET_ADDED',
  'WALLET_REMOVED',
  'CONNECTION_CREATED',
  'CONNECTION_DISCONNECTED',
  'SIGN_REQUEST_CREATED',
  'SIGN_REQUEST_COMPLETED',
  'SIGN_REQUEST_FAILED',
  'SECURITY_EVENT',
  'SERVICE_HEALTH_CHANGED',
] as const;

export type AdminEventType = (typeof ADMIN_EVENT_TYPES)[number];

export type AdminEventSeverity = 'info' | 'warning' | 'critical';

/** Primitive-only, secret-free metadata values allowed on the wire. */
export type SafeMetadataValue = string | number | boolean | null;
export type SafeMetadata = Record<string, SafeMetadataValue>;

/** The fully-formed envelope that reaches the admin browser. */
export interface AdminEvent {
  id: string;
  type: AdminEventType;
  timestamp: string;
  service: string;
  severity: AdminEventSeverity;
  userId?: string;
  targetId?: string;
  platform?: string;
  metadata?: SafeMetadata;
}

/** What callers/publishers pass in. `id`/`timestamp`/`severity` are optional. */
export interface AdminEventInput {
  id?: string;
  type: AdminEventType;
  service?: string;
  severity?: AdminEventSeverity;
  userId?: string;
  targetId?: string;
  platform?: string;
  timestamp?: string | Date;
  metadata?: Record<string, unknown>;
}

const ADMIN_EVENT_TYPE_SET: ReadonlySet<string> = new Set(ADMIN_EVENT_TYPES);

/**
 * Any metadata key matching one of these fragments is dropped, at any nesting
 * depth. This is the deny-list backstop behind the primitive-only allow-list.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'passwordhash',
  'pwd',
  'secret',
  'token', // accesstoken, refreshtoken, csrftoken, jwt, bearer...
  'jwt',
  'bearer',
  'authorization',
  'cookie',
  'session', // sessionsecret / raw session material — we expose sessionId explicitly only
  'privatekey',
  'private_key',
  'mnemonic',
  'seed',
  'symkey',
  'sym_key',
  'apikey',
  'api_key',
  'x-internal-api-key',
  'internalapikey',
  'encryptionkey',
  'encryption_key',
  'fieldencryption',
  'ciphertext',
  'databaseurl',
  'database_url',
  'redisurl',
  'redis_url',
  'connectionstring',
  'connection_string',
  'signature', // raw signatures are user cryptographic material
  'csrf',
] as const;

/** Explicit non-secret keys that would otherwise trip a fragment above. */
const SENSITIVE_KEY_ALLOWLIST: ReadonlySet<string> = new Set([
  'sessionid', // an opaque identifier, not the session secret
  'tokentype', // e.g. "Bearer" label only — but we still block by default; kept for clarity
]);

const MAX_METADATA_KEYS = 24;
const MAX_STRING_LENGTH = 512;
const MAX_METADATA_DEPTH = 3;

export function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[\s_-]/g, '');
  if (SENSITIVE_KEY_ALLOWLIST.has(normalised)) {
    // Explicitly permitted identifiers. `tokentype` is a label; still handled below.
    if (normalised === 'sessionid') return false;
  }
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalised.includes(fragment.replace(/[\s_-]/g, '')),
  );
}

function coerceSafeValue(value: unknown): SafeMetadataValue | undefined {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string') {
    return (value as string).slice(0, MAX_STRING_LENGTH);
  }
  if (t === 'number') {
    return Number.isFinite(value as number) ? (value as number) : undefined;
  }
  if (t === 'boolean') {
    return value as boolean;
  }
  return undefined;
}

/**
 * Recursively scrub arbitrary metadata into a flat, secret-free, primitive-only
 * map. Nested objects are flattened with dotted keys so nested secrets are still
 * evaluated by {@link isSensitiveKey}. Functions, symbols, and non-finite numbers
 * are dropped. Depth and size are bounded to prevent abuse/backpressure.
 */
function scrubMetadata(
  input: Record<string, unknown>,
  out: SafeMetadata,
  prefix: string,
  depth: number,
): void {
  if (depth > MAX_METADATA_DEPTH) return;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_METADATA_KEYS) break;
    if (typeof rawKey !== 'string') continue;
    if (isSensitiveKey(rawKey)) continue;
    const key = prefix ? `${prefix}.${rawKey}` : rawKey;
    if (isSensitiveKey(key)) continue;

    if (rawValue !== null && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      scrubMetadata(rawValue as Record<string, unknown>, out, key, depth + 1);
      continue;
    }
    if (Array.isArray(rawValue)) {
      const safeItems = rawValue
        .map((item) => coerceSafeValue(item))
        .filter((item): item is SafeMetadataValue => item !== undefined);
      // Represent arrays as a compact, bounded string to keep the wire flat.
      out[key] = JSON.stringify(safeItems).slice(0, MAX_STRING_LENGTH);
      continue;
    }
    const safe = coerceSafeValue(rawValue);
    if (safe !== undefined) {
      out[key] = safe;
    }
  }
}

function normaliseTimestamp(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

let counter = 0;
function generateEventId(): string {
  counter = (counter + 1) % 1_000_000;
  const rand = Math.random().toString(36).slice(2, 10);
  return `evt_${Date.now().toString(36)}_${counter.toString(36)}_${rand}`;
}

/**
 * Validate + sanitise a raw event into a safe {@link AdminEvent}. Returns `null`
 * when the event type is unknown so callers can drop it silently. This is the
 * security filter that runs both at publish time and again before any event is
 * delivered to a browser.
 */
export function sanitizeAdminEvent(input: unknown): AdminEvent | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as AdminEventInput;
  if (typeof raw.type !== 'string' || !ADMIN_EVENT_TYPE_SET.has(raw.type)) {
    return null;
  }

  const event: AdminEvent = {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 128) : generateEventId(),
    type: raw.type as AdminEventType,
    timestamp: normaliseTimestamp(raw.timestamp),
    service: typeof raw.service === 'string' && raw.service ? raw.service.slice(0, 64) : 'auth',
    severity: raw.severity === 'warning' || raw.severity === 'critical' ? raw.severity : 'info',
  };

  if (typeof raw.userId === 'string' && raw.userId) event.userId = raw.userId.slice(0, 128);
  if (typeof raw.targetId === 'string' && raw.targetId) event.targetId = raw.targetId.slice(0, 128);
  if (typeof raw.platform === 'string' && raw.platform) {
    event.platform = raw.platform.slice(0, 32).toLowerCase();
  }

  if (raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)) {
    const safe: SafeMetadata = {};
    scrubMetadata(raw.metadata as Record<string, unknown>, safe, '', 0);
    if (Object.keys(safe).length > 0) event.metadata = safe;
  }

  return event;
}

/** Serialise a sanitised event to a JSON string for the SSE `data:` field. */
export function serializeAdminEvent(event: AdminEvent): string {
  return JSON.stringify(event);
}
