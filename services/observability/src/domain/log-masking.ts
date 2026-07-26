const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const PASSWORD_RE = /("?(?:password|passwd|secret|api[_-]?key|token)"?\s*[:=]\s*")([^"]+)(")/gi;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;

export function maskSensitiveString(input: string): string {
  return input
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(BEARER_RE, 'Bearer [REDACTED_TOKEN]')
    .replace(PASSWORD_RE, '$1[REDACTED]$3')
    .replace(CARD_RE, '[REDACTED_CARD]');
}

export function maskSensitiveValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return maskSensitiveString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveValue(item));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/password|secret|token|authorization|api[_-]?key/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = maskSensitiveValue(nested);
      }
    }
    return out;
  }
  return value;
}
