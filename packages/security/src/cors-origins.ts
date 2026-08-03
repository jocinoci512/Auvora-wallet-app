/**
 * Credentialed CORS helpers — explicit allowlists only.
 * Never use `*` or reflect arbitrary Origin headers for cookie/session APIs.
 */

export type CorsOriginDelegate = (
  requestOrigin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void;

/** Parse a comma-separated CORS_ORIGINS value into absolute origin strings. */
export function parseCorsOrigins(value: string | undefined | null): string[] {
  if (value == null || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(normalizeCorsOriginEntry);
}

/** Normalize an allowlist entry to `scheme://host[:port]` (no path/query). */
export function normalizeCorsOriginEntry(entry: string): string {
  const trimmed = entry.trim();
  if (trimmed === '*') {
    return '*';
  }
  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error(`Invalid CORS origin entry: ${entry}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`CORS origin must be http(s): ${entry}`);
  }
  if (url.username || url.password) {
    throw new Error(`CORS origin must not include credentials: ${entry}`);
  }
  return url.origin;
}

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]' ||
      url.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
}

export type AssertCorsAllowlistOptions = {
  nodeEnv?: string;
  /** When true (default in production), reject localhost / loopback origins. */
  rejectLocalhostInProduction?: boolean;
};

/**
 * Validate a credentialed CORS allowlist.
 * Rejects wildcards, empty production lists, and localhost in production.
 */
export function assertCredentialedCorsAllowlist(
  origins: readonly string[],
  options: AssertCorsAllowlistOptions = {},
): string[] {
  const nodeEnv = options.nodeEnv ?? 'development';
  const rejectLocal = options.rejectLocalhostInProduction ?? nodeEnv === 'production';

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must list at least one explicit origin for credentialed APIs');
  }

  const normalized = origins.map((o) => normalizeCorsOriginEntry(o));
  const unique = [...new Set(normalized)];

  for (const origin of unique) {
    if (origin === '*' || origin.includes('*')) {
      throw new Error('Credentialed CORS must not use wildcard origins (*)');
    }
    if (rejectLocal && isLocalDevOrigin(origin)) {
      throw new Error(`CORS origin not allowed in production: ${origin}`);
    }
  }

  return unique;
}

/**
 * Merge APP_PUBLIC_URL (canonical web) with optional CORS_ORIGINS CSV.
 * APP_PUBLIC_URL is always included so auth redirect origin stays aligned.
 */
export function resolveCredentialedCorsOrigins(input: {
  appPublicUrl: string;
  corsOriginsCsv?: string | undefined | null;
  nodeEnv?: string;
}): string[] {
  const fromApp = normalizeCorsOriginEntry(input.appPublicUrl);
  const fromCsv = parseCorsOrigins(input.corsOriginsCsv);
  return assertCredentialedCorsAllowlist([fromApp, ...fromCsv], {
    nodeEnv: input.nodeEnv,
  });
}

export function isAllowedCorsOrigin(
  requestOrigin: string | undefined,
  allowlist: readonly string[],
): boolean {
  if (!requestOrigin) {
    // Non-browser clients (curl, server-to-server) — no CORS header needed.
    return true;
  }
  let normalized: string;
  try {
    normalized = normalizeCorsOriginEntry(requestOrigin);
  } catch {
    return false;
  }
  return allowlist.includes(normalized);
}

/** Nest/Express `enableCors({ origin })` callback — allowlist only, never reflects unknown origins. */
export function createCredentialedCorsOriginDelegate(
  allowlist: readonly string[],
): CorsOriginDelegate {
  const allowed = assertCredentialedCorsAllowlist([...allowlist], {
    // Caller already validated for env; skip production localhost reject here.
    rejectLocalhostInProduction: false,
  });

  return (requestOrigin, callback) => {
    if (isAllowedCorsOrigin(requestOrigin, allowed)) {
      callback(null, true);
      return;
    }
    // Deny without throwing — avoids 500 noise while still omitting ACAO for unknown origins.
    callback(null, false);
  };
}
