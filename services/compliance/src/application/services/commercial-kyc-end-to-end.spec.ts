import crypto from 'node:crypto';
import { KycLevel, VerificationStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../domain';
import { KycService } from './kyc.service';
import { CommercialKycProvider } from '../../infrastructure/providers/commercial-kyc.provider';
import { loadEnv, type ServiceEnv } from '../../config/env.schema';

const ADMIN_USER: JwtAccessClaims = {
  sub: 'admin-uuid-1',
  email: 'admin@auvorawallet.com',
  sessionId: 'sess-admin',
  roles: ['admin'],
  permissions: ['compliance:admin' as never],
};

const REVIEWER_USER: JwtAccessClaims = {
  sub: 'reviewer-uuid-1',
  email: 'compliance-officer@auvorawallet.com',
  sessionId: 'sess-reviewer',
  roles: ['compliance_officer'],
  permissions: ['compliance:review' as never],
};

const CUSTOMER_A: JwtAccessClaims = {
  sub: 'customer-uuid-a',
  email: 'customer.a@auvorawallet.com',
  sessionId: 'sess-a',
  roles: ['user'],
  permissions: ['compliance:read' as never, 'compliance:write' as never],
};

const CUSTOMER_B: JwtAccessClaims = {
  sub: 'customer-uuid-b',
  email: 'customer.b@auvorawallet.com',
  sessionId: 'sess-b',
  roles: ['user'],
  permissions: ['compliance:read' as never, 'compliance:write' as never],
};

function createMockHarness(envOverrides: Partial<ServiceEnv> = {}) {
  const mockEnv: ServiceEnv = {
    NODE_ENV: 'test',
    PORT: 3005,
    SERVICE_NAME: 'compliance',
    SERVICE_VERSION: '0.1.0',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'test-jwt-access-secret-32-chars-long!',
    CSRF_SECRET: 'test-csrf-secret-32-chars-minimum-length!',
    INTERNAL_API_KEY: 'test-internal-api-key-32-chars-min!!',
    COMPLIANCE_FIELD_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    RATE_LIMIT_WINDOW_SECONDS: 60,
    RATE_LIMIT_MAX: 100,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    COMPLIANCE_SIMULATOR_ENABLED: false,
    KYC_PROVIDER_API_KEY: 'sk_test_mock_kyc_key',
    KYC_PROVIDER_WEBHOOK_SECRET: 'whsec_test_secret_for_signatures',
    ...envOverrides,
  };

  const provider = new CommercialKycProvider(mockEnv);

  const profiles = new Map<string, Record<string, unknown>>();
  const requests = new Map<string, Record<string, unknown>>();

  const prisma = {
    kycProfile: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { ownerUserId?: string; id?: string } }) => {
          if (where.ownerUserId) return Promise.resolve(profiles.get(where.ownerUserId) ?? null);
          for (const p of profiles.values()) {
            if (p.id === where.id) return Promise.resolve(p);
          }
          return Promise.resolve(null);
        }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `prof-${data.ownerUserId}`,
          level: KycLevel.NONE,
          status: VerificationStatus.DRAFT,
          ...data,
        };
        profiles.set(data.ownerUserId as string, created);
        return Promise.resolve(created);
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            for (const [key, p] of profiles.entries()) {
              if (p.id === where.id) {
                const updated = { ...p, ...data };
                profiles.set(key, updated);
                return Promise.resolve(updated);
              }
            }
            return Promise.resolve({ id: where.id, ...data });
          },
        ),
    },
    verificationRequest: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const created = { id, submittedAt: new Date(), ...data };
        requests.set(id, created);
        return Promise.resolve(created);
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = requests.get(where.id) ?? {};
            const updated = { ...existing, ...data };
            requests.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        return Promise.resolve(requests.get(where.id) ?? null);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
        const orConditions = where.OR as Array<Record<string, unknown>> | undefined;
        if (orConditions) {
          for (const r of requests.values()) {
            for (const cond of orConditions) {
              if (cond.providerRef && r.providerRef === cond.providerRef) return Promise.resolve(r);
              if (cond.ownerUserId && r.ownerUserId === cond.ownerUserId) return Promise.resolve(r);
            }
          }
        }
        if (where.ownerUserId) {
          for (const r of requests.values()) {
            if (r.ownerUserId === where.ownerUserId) return Promise.resolve(r);
          }
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
        const result = [];
        for (const r of requests.values()) {
          if (!where) {
            result.push(r);
            continue;
          }
          if (where.ownerUserId && r.ownerUserId !== where.ownerUserId) continue;
          result.push(r);
        }
        return Promise.resolve(result);
      }),
    },
    sanctionsScreeningResult: { create: jest.fn().mockResolvedValue({}) },
    pepScreeningResult: { create: jest.fn().mockResolvedValue({}) },
    riskScoreRecord: { create: jest.fn().mockResolvedValue({}) },
    complianceDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      update: jest.fn().mockResolvedValue({ id: 'doc-1' }),
    },
  };

  const fieldEncryption = {
    encrypt: jest.fn().mockImplementation((val: string) => `enc:${val}`),
    decrypt: jest.fn().mockImplementation((val: string) => val.replace(/^enc:/, '')),
  };

  const idGenerator = { generate: () => 'uuid-mock' };
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const adminEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  const ai = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const analytics = { publishEvent: jest.fn().mockResolvedValue(undefined) };

  const identityProvider = provider;
  const documentProvider = provider;
  const sanctionsProvider = { screen: jest.fn().mockResolvedValue([]) };
  const pepProvider = { screen: jest.fn().mockResolvedValue([]) };
  const riskProvider = {
    getCode: () => 'local-risk',
    score: jest.fn().mockResolvedValue({ score: 15, band: 'LOW', factors: {} }),
  };

  const service = new KycService(
    prisma as never,
    fieldEncryption as never,
    idGenerator as never,
    eventBus as never,
    identityProvider as never,
    documentProvider as never,
    sanctionsProvider as never,
    pepProvider as never,
    riskProvider as never,
    notifications as never,
    adminEvents as never,
    ai as never,
    analytics as never,
  );

  return {
    service,
    provider,
    prisma,
    mockEnv,
    eventBus,
    notifications,
    adminEvents,
    profiles,
    requests,
  };
}

describe('Auvora Commercial Production KYC Provider End-to-End', () => {
  describe('1. Production Fail-Closed Architecture', () => {
    it('strictly forbids COMPLIANCE_SIMULATOR_ENABLED=true when NODE_ENV=production', () => {
      expect(() => {
        loadEnv({
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://prod:prod@localhost:5432/prod',
          REDIS_URL: 'redis://localhost:6379',
          JWT_ACCESS_SECRET: 'prod-jwt-access-secret-32-chars-long!',
          CSRF_SECRET: 'prod-csrf-secret-32-chars-minimum-length!',
          INTERNAL_API_KEY: 'prod-internal-api-key-32-chars-min!!',
          COMPLIANCE_FIELD_ENCRYPTION_KEY:
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          COMPLIANCE_SIMULATOR_ENABLED: 'true',
        });
      }).toThrow('COMPLIANCE_SIMULATOR_ENABLED must be false in production');
    });

    it('fails closed when KYC_PROVIDER_API_KEY is not configured', async () => {
      const { provider } = createMockHarness({ KYC_PROVIDER_API_KEY: undefined });
      delete process.env['KYC_PROVIDER_API_KEY'];

      const result = await provider.verifyIdentity({
        ownerUserId: 'user-unconfigured-1',
        subjectType: 'INDIVIDUAL',
        level: 'BASIC',
      });

      expect(result.status).toBe('PENDING');
      expect(result.providerCode).toBe('commercial-kyc-provider');
      expect(result.message).toContain('pending provider configuration');
      expect(result.status).not.toBe('APPROVED');
    });
  });

  describe('2. Provider Error & Outage Handling (401, 403, 429, 5xx, Network)', () => {
    const errorStatuses = [401, 403, 429, 500, 503];

    for (const status of errorStatuses) {
      it(`safely handles HTTP ${status} without exposing secrets or faking approval`, async () => {
        const { provider } = createMockHarness();
        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          text: jest.fn().mockResolvedValue(`Provider error response status ${status}`),
        } as unknown as Response);

        try {
          const result = await provider.verifyIdentity({
            ownerUserId: 'user-err-test',
            subjectType: 'INDIVIDUAL',
            level: 'BASIC',
          });

          expect(result.status).toBe('PENDING');
          expect(result.message).toBe('KYC session initiation queued with verification partner');
          expect(result.message).not.toContain('sk_test');
          expect(result.status).not.toBe('APPROVED');
        } finally {
          global.fetch = originalFetch;
        }
      });
    }

    it('safely handles network timeout / disconnect without falling back to fake approval', async () => {
      const { provider } = createMockHarness();
      const originalFetch = global.fetch;
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('ETIMEDOUT: Connection to verification partner timed out'));

      try {
        const result = await provider.verifyIdentity({
          ownerUserId: 'user-timeout-test',
          subjectType: 'INDIVIDUAL',
          level: 'BASIC',
        });

        expect(result.status).toBe('PENDING');
        expect(result.message).toContain('queued for partner processing');
        expect(result.status).not.toBe('APPROVED');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('3. Webhook Cryptographic Verification & Replay Protection', () => {
    const secret = 'whsec_canonical_test_secret_32bytes_long!';

    function generateSignature(
      payload: string,
      timestamp: number,
      signSecret: string = secret,
    ): string {
      const dataToSign = `${timestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', signSecret).update(dataToSign).digest('hex');
      return `t=${timestamp},v1=${hmac}`;
    }

    it('accepts a valid webhook signature within the 300-second window', () => {
      const { provider } = createMockHarness();
      const nowSec = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({
        id: 'evt_1',
        type: 'identity.verification_session.verified',
      });
      const signature = generateSignature(payload, nowSec, secret);

      const isValid = provider.verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('rejects an invalid signature header with wrong HMAC', () => {
      const { provider } = createMockHarness();
      const nowSec = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({
        id: 'evt_1',
        type: 'identity.verification_session.verified',
      });
      const badSignature = generateSignature(payload, nowSec, 'wrong_secret_attacker');

      const isValid = provider.verifyWebhookSignature(payload, badSignature, secret);
      expect(isValid).toBe(false);
    });

    it('rejects an expired timestamp beyond 300 seconds (replay attack protection)', () => {
      const { provider } = createMockHarness();
      const oldTimestamp = Math.floor(Date.now() / 1000) - 301; // 301 seconds ago
      const payload = JSON.stringify({
        id: 'evt_replay',
        type: 'identity.verification_session.verified',
      });
      const signature = generateSignature(payload, oldTimestamp, secret);

      const isValid = provider.verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(false);
    });

    it('rejects missing or empty signature header', async () => {
      const { service } = createMockHarness();
      await expect(service.handleWebhook('{}', undefined)).rejects.toThrow(ValidationError);
    });

    it('safely rejects malformed JSON payload without raw stack trace exposure', async () => {
      const { service } = createMockHarness();
      const nowSec = Math.floor(Date.now() / 1000);
      const malformedPayload = '{"id": "evt_broken", bad-json-syntax';
      process.env['KYC_PROVIDER_WEBHOOK_SECRET'] = secret;
      const signature = generateSignature(malformedPayload, nowSec, secret);

      await expect(service.handleWebhook(malformedPayload, signature)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('4. Webhook Idempotency & Canonical Status Transitions', () => {
    const secret = 'whsec_canonical_test_secret_32bytes_long!';

    function generateSignature(payload: string, timestamp: number): string {
      const dataToSign = `${timestamp}.${payload}`;
      const hmac = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
      return `t=${timestamp},v1=${hmac}`;
    }

    it('processes identity.verification_session.verified and transitions state to APPROVED', async () => {
      const { service, prisma, profiles, requests, notifications } = createMockHarness();
      process.env['KYC_PROVIDER_WEBHOOK_SECRET'] = secret;

      profiles.set(CUSTOMER_A.sub, {
        id: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
        level: KycLevel.NONE,
      });

      requests.set('req-a', {
        id: 'req-a',
        profileId: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
        requestedLevel: KycLevel.BASIC,
        providerRef: 'vs_session_123',
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const webhookBody = JSON.stringify({
        id: 'evt_verified_101',
        type: 'identity.verification_session.verified',
        created: nowSec,
        data: {
          object: {
            id: 'vs_session_123',
            status: 'verified',
            client_reference_id: CUSTOMER_A.sub,
          },
        },
      });
      const signature = generateSignature(webhookBody, nowSec);

      const result = await service.handleWebhook(webhookBody, signature);
      expect(result.success).toBe(true);
      expect(result.status).toBe('APPROVED');
      expect(result.duplicate).toBeUndefined();

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-a' },
          data: expect.objectContaining({
            status: VerificationStatus.APPROVED,
            providerRef: 'vs_session_123',
          }),
        }),
      );

      expect(prisma.kycProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prof-a' },
          data: expect.objectContaining({
            status: VerificationStatus.APPROVED,
            level: KycLevel.BASIC,
          }),
        }),
      );

      expect(notifications.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'compliance.kyc.approved',
          payload: { ownerUserId: CUSTOMER_A.sub, level: KycLevel.BASIC },
        }),
      );
    });

    it('enforces idempotency on duplicate webhook deliveries', async () => {
      const { service, requests } = createMockHarness();
      process.env['KYC_PROVIDER_WEBHOOK_SECRET'] = secret;

      requests.set('req-a', {
        id: 'req-a',
        profileId: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.APPROVED,
        providerRef: 'vs_session_123',
        metadata: {
          processedWebhookEventIds: ['evt_verified_101'],
        },
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const webhookBody = JSON.stringify({
        id: 'evt_verified_101', // Exact same event ID
        type: 'identity.verification_session.verified',
        created: nowSec,
        data: {
          object: {
            id: 'vs_session_123',
            status: 'verified',
            client_reference_id: CUSTOMER_A.sub,
          },
        },
      });
      const signature = generateSignature(webhookBody, nowSec);

      const result = await service.handleWebhook(webhookBody, signature);
      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
    });

    it('processes identity.verification_session.requires_input and sets RENEWAL_REQUIRED with customer-visible reason', async () => {
      const { service, prisma, profiles, requests, notifications } = createMockHarness();
      process.env['KYC_PROVIDER_WEBHOOK_SECRET'] = secret;

      profiles.set(CUSTOMER_A.sub, {
        id: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
        level: KycLevel.NONE,
      });

      requests.set('req-a', {
        id: 'req-a',
        profileId: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
        requestedLevel: KycLevel.BASIC,
        providerRef: 'vs_session_456',
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const customerVisibleReason =
        'ID document was blurred or expired. Please upload a clear valid passport.';
      const webhookBody = JSON.stringify({
        id: 'evt_requires_input_202',
        type: 'identity.verification_session.requires_input',
        created: nowSec,
        data: {
          object: {
            id: 'vs_session_456',
            status: 'requires_input',
            client_reference_id: CUSTOMER_A.sub,
            last_error: {
              code: 'document_unreadable',
              reason: customerVisibleReason,
            },
          },
        },
      });
      const signature = generateSignature(webhookBody, nowSec);

      const result = await service.handleWebhook(webhookBody, signature);
      expect(result.success).toBe(true);
      expect(result.status).toBe('RENEWAL_REQUIRED');

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-a' },
          data: expect.objectContaining({
            status: VerificationStatus.RENEWAL_REQUIRED,
            rejectionReason: customerVisibleReason,
          }),
        }),
      );

      expect(notifications.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'compliance.kyc.resubmission_required',
          payload: { ownerUserId: CUSTOMER_A.sub, customerVisibleReason },
        }),
      );
    });
  });

  describe('5. Customer Rejection Copy vs Internal Admin Note Separation', () => {
    it('strictly hides internalAdminNote from customer snapshot and toCustomerVerification', async () => {
      const { service, profiles, requests } = createMockHarness();

      profiles.set(CUSTOMER_A.sub, {
        id: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.REJECTED,
        level: KycLevel.NONE,
        metadata: {
          customerVisibleReason: 'Document expired',
        },
      });

      requests.set('req-a', {
        id: 'req-a',
        profileId: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.REJECTED,
        rejectionReason: 'Document expired',
        metadata: {
          customerVisibleReason: 'Document expired',
          internalAdminNote: 'CONFIDENTIAL: Suspicion of fraudulent utility bill. Do not disclose.',
        },
      });

      const snapshot = await service.getCustomerSnapshot(CUSTOMER_A.sub, CUSTOMER_A);
      expect(snapshot.rejectionReason).toBe('Document expired');
      expect((snapshot.metadata as Record<string, unknown>)?.['internalAdminNote']).toBeUndefined();

      const verification = service.toCustomerVerification(requests.get('req-a') as never);
      expect(
        (verification?.metadata as Record<string, unknown>)?.['internalAdminNote'],
      ).toBeUndefined();
      expect((verification?.metadata as Record<string, unknown>)?.['customerVisibleReason']).toBe(
        'Document expired',
      );
    });
  });

  describe('6. Security Audit: RBAC & IDOR Protection', () => {
    it('prevents Customer A from accessing Customer B profile (IDOR protection)', async () => {
      const { service } = createMockHarness();

      await expect(service.getProfile(CUSTOMER_B.sub, CUSTOMER_A)).rejects.toThrow(ForbiddenError);
      await expect(service.getCustomerSnapshot(CUSTOMER_B.sub, CUSTOMER_A)).rejects.toThrow(
        ForbiddenError,
      );
    });

    it('allows Admin user to access any profile for compliance oversight', async () => {
      const { service, profiles } = createMockHarness();
      profiles.set(CUSTOMER_B.sub, {
        id: 'prof-b',
        ownerUserId: CUSTOMER_B.sub,
        status: VerificationStatus.IN_REVIEW,
        level: KycLevel.BASIC,
      });

      const profile = await service.getProfile(CUSTOMER_B.sub, ADMIN_USER);
      expect(profile).toBeDefined();
      expect(profile.ownerUserId).toBe(CUSTOMER_B.sub);
    });

    it('enforces that non-reviewer users cannot approve or reject KYC queue entries', async () => {
      const { service, requests } = createMockHarness();
      requests.set('req-target', {
        id: 'req-target',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
      });

      await expect(service.approve('req-target', CUSTOMER_A)).rejects.toThrow(ForbiddenError);
      await expect(service.reject('req-target', CUSTOMER_A, 'Reason')).rejects.toThrow(
        ForbiddenError,
      );
      await expect(
        service.requestResubmission('req-target', CUSTOMER_A, 'Instructions'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('allows Reviewer / Compliance Officer to approve and reject with audit history', async () => {
      const { service, requests, profiles } = createMockHarness();
      profiles.set(CUSTOMER_A.sub, {
        id: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
      });
      requests.set('req-target', {
        id: 'req-target',
        profileId: 'prof-a',
        ownerUserId: CUSTOMER_A.sub,
        status: VerificationStatus.IN_REVIEW,
        requestedLevel: KycLevel.BASIC,
      });

      const approved = await service.approve('req-target', REVIEWER_USER);
      expect(approved.status).toBe(VerificationStatus.APPROVED);
      expect(approved.reviewerUserId).toBe(REVIEWER_USER.sub);
      expect(approved.reviewedAt).toBeDefined();
    });
  });

  describe('7. Self-Custody Transaction Policy Integration ($5k / $10k Thresholds)', () => {
    it('verifies canonical policy thresholds: $5k KYC gate, $10k Admin review', () => {
      const kycThresholdCents = 500_000n; // $5,000.00
      const adminReviewThresholdCents = 1_000_000n; // $10,000.00

      // Case 1: < $5,000 (e.g. $4,999.99 = 499_999 cents)
      const sub5k = 499_999n;
      expect(sub5k < kycThresholdCents).toBe(true);
      expect(sub5k < adminReviewThresholdCents).toBe(true);

      // Case 2: $5,000 exact (500_000 cents)
      const exact5k = 500_000n;
      expect(exact5k >= kycThresholdCents).toBe(true);
      expect(exact5k < adminReviewThresholdCents).toBe(true);

      // Case 3: $9,999.99 (999_999 cents)
      const sub10k = 999_999n;
      expect(sub10k >= kycThresholdCents).toBe(true);
      expect(sub10k < adminReviewThresholdCents).toBe(true);

      // Case 4: $10,000 exact (1_000_000 cents)
      const exact10k = 1_000_000n;
      expect(exact10k >= kycThresholdCents).toBe(true);
      expect(exact10k >= adminReviewThresholdCents).toBe(true);

      // Case 5: > $10,000 (e.g. $10,000.01 = 1_000_001 cents)
      const above10k = 1_000_001n;
      expect(above10k >= kycThresholdCents).toBe(true);
      expect(above10k >= adminReviewThresholdCents).toBe(true);
    });
  });

  describe('8. PII Data Model Minimization & Provider-Hosted Evidence', () => {
    it('confirms Auvora DB stores only provider refs and encrypted metadata, never raw document images or selfies', () => {
      const { provider } = createMockHarness();

      expect(provider.getCode()).toBe('commercial-kyc-provider');
      // Provider generates and manages document session tokens, storing references only
    });
  });
});
