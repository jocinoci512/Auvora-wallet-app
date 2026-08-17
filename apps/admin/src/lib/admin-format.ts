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
  return healthTone(status);
}
