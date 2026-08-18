import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
/** Bounded clock skew: previous, current, and next 30s window. */
export const TOTP_SKEW_WINDOWS = 1;
/** Authenticator account issuer. Display-only; TOTP is derived from the secret. */
export const TOTP_ISSUER = 'Auvora Wallet';
/** Authenticator account label. Avoids putting the operator email in the otpauth URI. */
export const TOTP_ACCOUNT_LABEL = 'Admin';

export function generateTotpSecret(bytes = 20): string {
  return encodeBase32(randomBytes(bytes));
}

export function buildOtpauthUrl(input: {
  secret: string;
  accountName: string;
  issuer?: string;
}): string {
  const issuer = encodeURIComponent(input.issuer ?? TOTP_ISSUER);
  const account = encodeURIComponent(input.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

export function generateTotpCode(secret: string, step: number): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(0, 0);
  buffer.writeUInt32BE(step, 4);
  const hmac = createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const otp = binary % 10 ** TOTP_DIGITS;
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

export function currentTotpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);
}

/**
 * Verify a TOTP code with ±1 window skew and reject reused steps (replay).
 * `lastUsedStep` is the highest step already accepted for this factor.
 */
export function verifyTotpCode(input: {
  secret: string;
  code: string;
  nowMs: number;
  lastUsedStep?: number | bigint | null;
}): { ok: true; step: number } | { ok: false } {
  const normalized = input.code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false };
  }
  const current = currentTotpStep(input.nowMs);
  const lastUsed =
    input.lastUsedStep === null || input.lastUsedStep === undefined
      ? null
      : Number(input.lastUsedStep);

  for (let delta = -TOTP_SKEW_WINDOWS; delta <= TOTP_SKEW_WINDOWS; delta += 1) {
    const step = current + delta;
    if (lastUsed !== null && step <= lastUsed) {
      continue;
    }
    const expected = generateTotpCode(input.secret, step);
    if (timingSafeEqualString(normalized, expected)) {
      return { ok: true, step };
    }
  }
  return { ok: false };
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid TOTP secret');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
