import { KycLevel, VerificationStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { ForbiddenError, ValidationError } from '../../domain';
import { KycService } from './kyc.service';

const ADMIN_USER: JwtAccessClaims = {
  sub: 'admin-1',
  email: 'admin@auvora.local',
  sessionId: 's1',
  roles: ['admin'],
  permissions: ['compliance:admin' as never],
};

const REVIEWER_USER: JwtAccessClaims = {
  sub: 'reviewer-1',
  email: 'reviewer@auvora.local',
  sessionId: 's2',
  roles: ['admin'],
  permissions: ['compliance:review' as never],
};

const PLAIN_USER: JwtAccessClaims = {
  sub: 'user-1',
  email: 'user@auvora.local',
  sessionId: 's3',
  roles: [],
  permissions: ['compliance:read' as never],
};

interface MockOptions {
  identityStatus?: 'APPROVED' | 'REJECTED';
  sanctionsHit?: boolean;
  pepHit?: boolean;
  riskBand?: string;
}

function makeService(options: MockOptions = {}) {
  const profile = {
    id: 'profile-1',
    ownerUserId: 'user-1',
    level: KycLevel.NONE,
    status: VerificationStatus.DRAFT,
  };

  const verificationRequests = new Map<string, Record<string, unknown>>();

  const prisma = {
    kycProfile: {
      findUnique: jest.fn().mockResolvedValue(profile),
      create: jest.fn().mockResolvedValue(profile),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...profile, ...data }),
        ),
    },
    verificationRequest: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: 'req-1', ...data };
        verificationRequests.set('req-1', created);
        return Promise.resolve(created);
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = verificationRequests.get(where.id) ?? {};
            const updated = { ...existing, ...data };
            verificationRequests.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(verificationRequests.get(where.id) ?? null),
        ),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    sanctionsScreeningResult: { create: jest.fn().mockResolvedValue({}) },
    pepScreeningResult: { create: jest.fn().mockResolvedValue({}) },
    riskScoreRecord: { create: jest.fn().mockResolvedValue({}) },
    complianceDocument: {
      create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'doc-1', ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const crypto = {
    encrypt: jest.fn((v: string) => `enc:${v}`),
    decrypt: jest.fn((v: string) => v.replace('enc:', '')),
    hash: jest.fn((v: string) => `hash:${v}`),
  };
  const ids = { uuid: () => 'generated-id' };
  const events = { publish: jest.fn() };

  const identity = {
    getCode: () => 'local-identity-simulator',
    verifyIdentity: jest.fn().mockResolvedValue(
      options.identityStatus === 'REJECTED'
        ? {
            providerCode: 'local-identity-simulator',
            providerRef: 'ref',
            status: 'REJECTED',
            message: 'rejected',
          }
        : { providerCode: 'local-identity-simulator', providerRef: 'ref', status: 'APPROVED' },
    ),
  };
  const documents = {
    getCode: () => 'local-document-simulator',
    verifyDocument: jest.fn().mockResolvedValue({
      providerCode: 'local-document-simulator',
      providerRef: 'doc-ref',
      status: 'VERIFIED',
    }),
  };
  const sanctions = {
    getCode: () => 'local-sanctions-simulator',
    screen: jest
      .fn()
      .mockResolvedValue(
        options.sanctionsHit
          ? [{ providerCode: 'p', providerRef: 'r', matchStatus: 'POTENTIAL', listSource: 'OFAC' }]
          : [{ providerCode: 'p', providerRef: 'r', matchStatus: 'CLEAR', listSource: 'OFAC' }],
      ),
  };
  const pep = {
    getCode: () => 'local-pep-simulator',
    screen: jest
      .fn()
      .mockResolvedValue(
        options.pepHit
          ? { providerCode: 'p', providerRef: 'r', matchStatus: 'POTENTIAL' }
          : { providerCode: 'p', providerRef: 'r', matchStatus: 'CLEAR' },
      ),
  };
  const riskProvider = {
    getCode: () => 'local-risk-simulator',
    score: jest.fn().mockResolvedValue({ score: 30, band: options.riskBand ?? 'LOW', factors: {} }),
  };
  const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const ai = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const analytics = { publishEvent: jest.fn().mockResolvedValue(undefined) };

  const service = new KycService(
    prisma as never,
    crypto as never,
    ids as never,
    events as never,
    identity as never,
    documents as never,
    sanctions as never,
    pep as never,
    riskProvider as never,
    notifications as never,
    ai as never,
    analytics as never,
  );

  return { service, prisma, events, identity, sanctions, pep, notifications };
}

describe('KycService', () => {
  it('rejects submission when requestedLevel is NONE', async () => {
    const { service } = makeService();
    await expect(service.submitKyc('user-1', { requestedLevel: KycLevel.NONE })).rejects.toThrow(
      ValidationError,
    );
  });

  it('auto-approves when identity, sanctions, and PEP are clear with low risk', async () => {
    const { service, events } = makeService();
    const result = await service.submitKyc('user-1', {
      requestedLevel: KycLevel.BASIC,
      legalName: 'Jane Doe',
    });
    expect(result.status).toBe(VerificationStatus.APPROVED);
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'KYCCompleted' }));
  });

  it('sends the request to review when a sanctions hit occurs', async () => {
    const { service } = makeService({ sanctionsHit: true });
    const result = await service.submitKyc('user-1', {
      requestedLevel: KycLevel.BASIC,
      legalName: 'Sanction Case',
    });
    expect(result.status).toBe(VerificationStatus.IN_REVIEW);
  });

  it('sends the request to review when a PEP hit occurs', async () => {
    const { service } = makeService({ pepHit: true });
    const result = await service.submitKyc('user-1', {
      requestedLevel: KycLevel.BASIC,
      legalName: 'Pep Case',
    });
    expect(result.status).toBe(VerificationStatus.IN_REVIEW);
  });

  it('rejects the request immediately when identity verification fails', async () => {
    const { service, events } = makeService({ identityStatus: 'REJECTED' });
    const result = await service.submitKyc('user-1', {
      requestedLevel: KycLevel.BASIC,
      legalName: 'Reject Me',
    });
    expect(result.status).toBe(VerificationStatus.REJECTED);
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'KYCRejected' }));
  });

  it('approves an in-review request when the reviewer has permission', async () => {
    const { service, prisma } = makeService({ sanctionsHit: true });
    const submitted = await service.submitKyc('user-1', {
      requestedLevel: KycLevel.BASIC,
      legalName: 'Needs Review',
    });
    prisma.verificationRequest.findUnique = jest.fn().mockResolvedValue({
      ...submitted,
      status: VerificationStatus.IN_REVIEW,
      profileId: 'profile-1',
      ownerUserId: 'user-1',
      requestedLevel: KycLevel.BASIC,
    });
    const approved = await service.approve(submitted.id as string, REVIEWER_USER);
    expect(approved.status).toBe(VerificationStatus.APPROVED);
  });

  it('rejects approval attempts without review or admin permission', async () => {
    const { service } = makeService();
    await expect(service.approve('req-1', PLAIN_USER)).rejects.toThrow(ForbiddenError);
  });

  it('rejects a verification request with a reason', async () => {
    const { service, prisma, events } = makeService();
    prisma.verificationRequest.findUnique = jest
      .fn()
      .mockResolvedValue({ id: 'req-1', profileId: 'profile-1', ownerUserId: 'user-1' });
    const rejected = await service.reject('req-1', REVIEWER_USER, 'Suspicious activity');
    expect(rejected.status).toBe(VerificationStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('Suspicious activity');
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'KYCRejected' }));
  });

  it('uploads and verifies a document', async () => {
    const { service, prisma } = makeService();
    const result = await service.uploadDocument('user-1', {
      documentType: 'PASSPORT',
      storageKey: 's3://bucket/key',
    });
    expect(prisma.complianceDocument.create).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'doc-1', status: 'VERIFIED' });
  });

  it('allows a user to read their own profile but not another user profile', async () => {
    const { service } = makeService();
    await expect(service.getProfile('user-1', PLAIN_USER)).resolves.toBeDefined();
    await expect(service.getProfile('someone-else', PLAIN_USER)).rejects.toThrow(ForbiddenError);
    await expect(service.getProfile('someone-else', ADMIN_USER)).resolves.toBeDefined();
  });
});
