const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const JWT_RE = /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\b/g;
const HEX_PRIVATE_KEY_RE = /\b(?:0x)?[a-fA-F0-9]{64}\b/g;
const PASSWORD_RE =
  /("?(?:password|passwd|secret|api[_-]?key|token|mnemonic|private[_-]?key|seed[_-]?phrase)"?\s*[:=]\s*")([^"]+)(")/gi;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const PHONE_RE = /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const RPC_SECRET_URL_RE = /(https?:\/\/[^\s/$.?#].[^\s]*\/(?:v2|v1)\/)[a-zA-Z0-9_-]{16,}/gi;
const ALCHEMY_KEY_RE = /\b(?:alch_|alcht_)[a-zA-Z0-9_-]{16,}\b/gi;

export function maskSensitiveString(input: string): string {
  return input
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(BEARER_RE, 'Bearer [REDACTED_TOKEN]')
    .replace(JWT_RE, '[REDACTED_JWT]')
    .replace(HEX_PRIVATE_KEY_RE, '[REDACTED_KEY]')
    .replace(PASSWORD_RE, '$1[REDACTED]$3')
    .replace(CARD_RE, '[REDACTED_CARD]')
    .replace(PHONE_RE, '[REDACTED_PHONE]')
    .replace(RPC_SECRET_URL_RE, '$1[REDACTED_RPC_KEY]')
    .replace(ALCHEMY_KEY_RE, '[REDACTED_API_KEY]');
}

const SENSITIVE_KEY_RE =
  /email|phone|mobile|password|passwd|secret|token|jwt|authorization|api[_-]?key|provider[_-]?key|private[_-]?key|\bkey\b|mnemonic|seed[_-]?phrase|recovery[_-]?phrase|credential|document|passport|selfie|biometric|national[_-]?id|id[_-]?number|legal[_-]?name|date[_-]?of[_-]?birth|ssn|tax[_-]?id/i;

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
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = maskSensitiveValue(nested);
      }
    }
    return out;
  }
  return value;
}
