export function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function shortId(value: string | null | undefined, size = 8): string {
  if (!value) return '—';
  return value.length <= size ? value : `${value.slice(0, size)}…`;
}

/** Formats integer USD cents without binary floating point. */
export function formatUsdCents(cents: string | number | bigint | null | undefined): string {
  try {
    const n = BigInt(cents ?? 0);
    const sign = n < 0n ? '-' : '';
    const abs = n < 0n ? -n : n;
    const whole = abs / 100n;
    const frac = (abs % 100n).toString().padStart(2, '0');
    const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}$${grouped}.${frac}`;
  } catch {
    return '—';
  }
}

export function reviewOrigin(
  sourceType: string,
  metadata?: Record<string, unknown> | null,
): { label: string; simulated: boolean } {
  const simulated =
    sourceType === 'SIMULATION_TRANSACTION' ||
    metadata?.simulated === true ||
    metadata?.label === 'SIMULATED';
  return {
    simulated,
    label: simulated ? 'SIMULATED' : 'Auvora transfer',
  };
}

export function displayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  username?: string;
}): string {
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  return name || input.username || input.email || 'Unknown';
}

export function safeEnvLabel(): string {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production' ? 'Production' : 'Local';
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return 'Local';
  }
  return 'Production';
}

export function healthTone(status: string): 'healthy' | 'degraded' | 'unavailable' {
  const normalized = status.toUpperCase();
  if (normalized === 'OK' || normalized === 'HEALTHY' || normalized === 'UP') return 'healthy';
  if (normalized === 'DEGRADED' || normalized === 'WARN' || normalized === 'WARNING') {
    return 'degraded';
  }
  return 'unavailable';
}

export function healthLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'OK' || normalized === 'HEALTHY' || normalized === 'UP') return 'Healthy';
  if (normalized === 'DEGRADED' || normalized === 'WARN' || normalized === 'WARNING') {
    return 'Degraded';
  }
  if (normalized === 'OFFLINE' || normalized === 'UNHEALTHY' || normalized === 'DOWN') {
    return 'Offline';
  }
  return 'Unknown';
}

export function safeServiceName(name: string): string {
  if (
    /https?:\/\/|:\d{2,5}|localhost|127\.0\.0\.1|\.internal|\.railway|\.local|@[a-z0-9.-]+/i.test(
      name,
    )
  ) {
    return 'Internal service';
  }
  return name;
}
