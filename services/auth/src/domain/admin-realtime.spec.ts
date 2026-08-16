import {
  ADMIN_EVENTS_CHANNEL,
  ADMIN_EVENT_TYPES,
  isSensitiveKey,
  sanitizeAdminEvent,
  serializeAdminEvent,
} from './admin-realtime';

describe('admin-realtime contract', () => {
  it('exposes the canonical bounded channel name', () => {
    expect(ADMIN_EVENTS_CHANNEL).toBe('auvora:admin:events');
  });

  it('rejects unknown event types (returns null)', () => {
    expect(sanitizeAdminEvent({ type: 'NOT_A_REAL_EVENT' })).toBeNull();
    expect(sanitizeAdminEvent({ type: 'DROP TABLE users' })).toBeNull();
    expect(sanitizeAdminEvent(null)).toBeNull();
    expect(sanitizeAdminEvent('nope')).toBeNull();
    expect(sanitizeAdminEvent(42)).toBeNull();
  });

  it('accepts every declared event type', () => {
    for (const type of ADMIN_EVENT_TYPES) {
      const event = sanitizeAdminEvent({ type });
      expect(event).not.toBeNull();
      expect(event?.type).toBe(type);
    }
  });

  it('fills id/timestamp/service/severity defaults', () => {
    const event = sanitizeAdminEvent({ type: 'USER_CREATED' });
    expect(event?.id).toMatch(/^evt_/);
    expect(event?.service).toBe('auth');
    expect(event?.severity).toBe('info');
    expect(() => new Date(event!.timestamp).toISOString()).not.toThrow();
  });

  it('preserves safe top-level fields and lowercases platform', () => {
    const event = sanitizeAdminEvent({
      type: 'USER_LOGIN',
      userId: 'user-1',
      targetId: 'session-1',
      platform: 'ANDROID',
      severity: 'warning',
      service: 'auth',
    });
    expect(event).toMatchObject({
      type: 'USER_LOGIN',
      userId: 'user-1',
      targetId: 'session-1',
      platform: 'android',
      severity: 'warning',
    });
  });

  describe('secret filter', () => {
    const SECRET_KEYS = [
      'passwordHash',
      'password',
      'refreshToken',
      'accessToken',
      'jwt',
      'bearerToken',
      'authorization',
      'cookie',
      'privateKey',
      'private_key',
      'mnemonic',
      'seedPhrase',
      'seed',
      'symKey',
      'sym_key',
      'apiKey',
      'x-internal-api-key',
      'internalApiKey',
      'fieldEncryptionKey',
      'encryptionKey',
      'ciphertext',
      'DATABASE_URL',
      'REDIS_URL',
      'connectionString',
      'signature',
      'csrfSecret',
    ];

    it.each(SECRET_KEYS)('strips top-level secret key %s', (key) => {
      const event = sanitizeAdminEvent({
        type: 'SECURITY_EVENT',
        metadata: { [key]: 'super-secret-value', safe: 'ok' },
      });
      const serialized = serializeAdminEvent(event!);
      expect(serialized).not.toContain('super-secret-value');
      expect(event?.metadata?.safe).toBe('ok');
      expect(event?.metadata?.[key]).toBeUndefined();
    });

    it('strips nested secrets at depth', () => {
      const event = sanitizeAdminEvent({
        type: 'USER_LOGIN',
        metadata: {
          session: { accessToken: 'AAA', refreshToken: 'BBB' },
          device: { info: { privateKey: 'CCC', mnemonic: 'DDD', name: 'Pixel' } },
          ok: 'visible',
        },
      });
      const serialized = serializeAdminEvent(event!);
      for (const secret of ['AAA', 'BBB', 'CCC', 'DDD']) {
        expect(serialized).not.toContain(secret);
      }
      // `session` fragment is itself blocked, so nested "device.info.name" survives.
      expect(serialized).toContain('Pixel');
      expect(event?.metadata?.ok).toBe('visible');
    });

    it('drops secrets hidden inside arrays', () => {
      const event = sanitizeAdminEvent({
        type: 'SECURITY_EVENT',
        metadata: { tokens: ['refresh-abc', 'refresh-def'], roles: ['admin', 'user'] },
      });
      const serialized = serializeAdminEvent(event!);
      expect(serialized).not.toContain('refresh-abc');
      // `roles` is safe and rendered as a compact bounded string.
      expect(serialized).toContain('admin');
    });

    it('blocks ambiguous short keys exactly but keeps safe longer keys', () => {
      // Exact-blocked (WC pairing/raw material)
      expect(isSensitiveKey('uri')).toBe(true);
      expect(isSensitiveKey('payload')).toBe(true);
      expect(isSensitiveKey('preview')).toBe(true);
      expect(isSensitiveKey('vault')).toBe(true);
      expect(isSensitiveKey('qrPayload')).toBe(true);
      expect(isSensitiveKey('deepLink')).toBe(true);
      // Safe longer keys must NOT be dropped by substring false-positives
      expect(isSensitiveKey('payloadType')).toBe(false);
      expect(isSensitiveKey('securityState')).toBe(false);
      expect(isSensitiveKey('peerUrl')).toBe(false);
    });

    it('strips WC uri and raw payload from delivered metadata (defence in depth)', () => {
      const event = sanitizeAdminEvent({
        type: 'SIGN_REQUEST_CREATED',
        metadata: {
          uri: 'wc:LEAKURI@2?symKey=xyz',
          payload: 'RAW_SIGN_BYTES',
          payloadType: 'MESSAGE',
          network: 'ETHEREUM',
        },
      });
      const serialized = serializeAdminEvent(event!);
      expect(serialized).not.toContain('LEAKURI');
      expect(serialized).not.toContain('RAW_SIGN_BYTES');
      expect(event?.metadata?.payloadType).toBe('MESSAGE');
      expect(event?.metadata?.network).toBe('ETHEREUM');
    });

    it('recognises secret keys case- and separator-insensitively', () => {
      expect(isSensitiveKey('Refresh_Token')).toBe(true);
      expect(isSensitiveKey('ACCESS-TOKEN')).toBe(true);
      expect(isSensitiveKey('privateKey')).toBe(true);
      expect(isSensitiveKey('sessionId')).toBe(false);
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('status')).toBe(false);
    });

    it('bounds metadata key count and string length', () => {
      const metadata: Record<string, unknown> = {};
      for (let i = 0; i < 100; i += 1) metadata[`k${i}`] = 'v';
      metadata.big = 'x'.repeat(5000);
      const event = sanitizeAdminEvent({ type: 'USER_UPDATED', metadata });
      const keys = Object.keys(event?.metadata ?? {});
      expect(keys.length).toBeLessThanOrEqual(24);
      const bigVal = event?.metadata?.big;
      if (typeof bigVal === 'string') {
        expect(bigVal.length).toBeLessThanOrEqual(512);
      }
    });

    it('drops functions and non-finite numbers', () => {
      const event = sanitizeAdminEvent({
        type: 'USER_UPDATED',
        metadata: { fn: () => 1, inf: Number.POSITIVE_INFINITY, good: 5 },
      });
      expect(event?.metadata?.fn).toBeUndefined();
      expect(event?.metadata?.inf).toBeUndefined();
      expect(event?.metadata?.good).toBe(5);
    });
  });
});
