import { SentryTelemetryEngine } from './sentry-telemetry';

describe('SentryTelemetryEngine — Production Monitoring Readiness', () => {
  let engine: SentryTelemetryEngine;

  beforeEach(() => {
    engine = new SentryTelemetryEngine();
  });

  describe('configuration & fail-safe unconfigured behavior', () => {
    it('defaults to unconfigured and safe no-op when DSN is empty or missing', () => {
      expect(engine.isReady()).toBe(false);

      const result = engine.captureException(new Error('Unexpected database failure'));
      expect(result.captured).toBe(false);
      expect(result.reason).toBe('SENTRY_NOT_CONFIGURED');
    });

    it('activates when valid DSN is provided', () => {
      engine.configure({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
        serviceName: 'gateway',
        release: 'auvora@1.0.0+abc1234',
      });

      expect(engine.isReady()).toBe(true);
      expect(engine.getConfig().serviceName).toBe('gateway');
      expect(engine.getConfig().environment).toBe('production');
    });
  });

  describe('error filtering — capture unexpected errors vs suppress expected client errors', () => {
    beforeEach(() => {
      engine.configure({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
      });
    });

    it('suppresses expected HTTP 4xx validation and auth errors', () => {
      const validationError = {
        name: 'ValidationError',
        message: 'Invalid email format',
        status: 400,
      };
      const notFoundError = {
        name: 'NotFoundError',
        message: 'Wallet not found',
        status: 404,
      };
      const unauthorizedError = {
        name: 'UnauthorizedError',
        message: 'Token expired',
        status: 401,
      };

      expect(engine.captureException(validationError).captured).toBe(false);
      expect(engine.captureException(notFoundError).captured).toBe(false);
      expect(engine.captureException(unauthorizedError).captured).toBe(false);
    });

    it('captures unexpected 5xx infrastructure and runtime exceptions', () => {
      const dbCrash = new Error('Database connection pool exhausted (ECONNREFUSED)');
      const nullRef = new TypeError('Cannot read property "balance" of undefined');

      const dbResult = engine.captureException(dbCrash);
      const nullResult = engine.captureException(nullRef);

      expect(dbResult.captured).toBe(true);
      expect(dbResult.eventId).toMatch(/^sentry_evt_/);
      expect(nullResult.captured).toBe(true);
    });

    it('captures critical external provider failures (Alchemy 500, Resend 500, Stripe 500)', () => {
      const rpcFailure = {
        name: 'RpcProviderError',
        message: 'Alchemy RPC returned HTTP 503 Service Unavailable',
        status: 503,
      };
      const emailFailure = {
        name: 'EmailTransportError',
        message: 'Resend SMTP connection timeout',
        status: 500,
      };
      const kycFailure = {
        name: 'KycProviderError',
        message: 'Stripe Identity verification session initiation failed with status 500',
        status: 500,
      };

      expect(engine.captureException(rpcFailure).captured).toBe(true);
      expect(engine.captureException(emailFailure).captured).toBe(true);
      expect(engine.captureException(kycFailure).captured).toBe(true);
    });
  });

  describe('telemetry redaction — strict PII & secret scrubbing', () => {
    beforeEach(() => {
      engine.configure({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
        environment: 'production',
      });
    });

    it('redacts email, phone, password, JWT, refresh token, mnemonic, private key, KYC ID, provider key, and RPC credential', () => {
      const fakePrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const fakeMnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fakeSig';
      const fakeApiKey = 'alch_demo_secret_key_123456';
      const fakeKycId = 'vs_1234567890abcdef';

      const errorPayload = new Error('Upstream provider request failed');
      const richContext = {
        email: 'customer@example.com',
        phone: '+1-555-867-5309',
        password: 'my-super-secret-password',
        jwt: fakeJwt,
        refreshToken: 'rt_sample_token_value',
        privateKey: fakePrivateKey,
        mnemonic: fakeMnemonic,
        seedPhrase: fakeMnemonic,
        apiKey: fakeApiKey,
        providerKey: fakeApiKey,
        passport: 'base64_passport_image_data',
        selfie: 'base64_selfie_data',
        idNumber: fakeKycId,
        rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${fakeApiKey}`,
        correlationId: 'corr-safe-uuid-1234',
        chain: 'ETHEREUM',
      };

      const result = engine.captureException(errorPayload, richContext);
      expect(result.captured).toBe(true);

      const sanitized = result.sanitizedContext as Record<string, unknown>;
      expect(sanitized).toBeDefined();

      // All sensitive keys must be redacted
      expect(sanitized.email).toBe('[REDACTED]');
      expect(sanitized.phone).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.jwt).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.privateKey).toBe('[REDACTED]');
      expect(sanitized.mnemonic).toBe('[REDACTED]');
      expect(sanitized.seedPhrase).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.providerKey).toBe('[REDACTED]');
      expect(sanitized.passport).toBe('[REDACTED]');
      expect(sanitized.selfie).toBe('[REDACTED]');
      expect(sanitized.idNumber).toBe('[REDACTED]');

      // Raw secrets must not appear in string values
      expect(JSON.stringify(sanitized)).not.toContain(fakePrivateKey);
      expect(JSON.stringify(sanitized)).not.toContain(fakeMnemonic);
      expect(JSON.stringify(sanitized)).not.toContain(fakeJwt);
      expect(JSON.stringify(sanitized)).not.toContain(fakeApiKey);

      // Safe non-sensitive operational metadata is preserved
      expect(sanitized.correlationId).toBe('corr-safe-uuid-1234');
      expect(sanitized.chain).toBe('ETHEREUM');
    });
  });

  describe('monitoring fail-safe guarantee', () => {
    it('never throws or blocks caller even when capture encounters unexpected runtime error', () => {
      engine.configure({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      });

      // Circular object that would throw if naively JSON stringified
      const circular: Record<string, unknown> = { key: 'val' };
      circular.self = circular;

      expect(() => {
        const result = engine.captureException(
          new Error('Test error with circular context'),
          circular,
        );
        expect(result).toBeDefined();
      }).not.toThrow();
    });
  });
});
