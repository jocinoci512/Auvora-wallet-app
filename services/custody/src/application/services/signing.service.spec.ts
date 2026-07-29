import type { JwtAccessClaims } from '@auvora/types';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain';
import { SigningService } from './signing.service';

function buildKeyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'key-1',
    ownerUserId: 'user-1',
    algorithm: 'SECP256K1',
    custodyModel: 'SELF',
    status: 'ACTIVE',
    publicKey: 'pub-key',
    materialEncrypted: 'v1:iv:tag:data',
    providerRef: 'sim-ref',
    ...overrides,
  };
}

function buildSigningRequestRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sr-1',
    keyId: 'key-1',
    ownerUserId: 'user-1',
    status: 'QUEUED',
    payloadHash: 'abc123',
    requiredApprovals: 0,
    receivedApprovals: 0,
    scheduledAt: null,
    delayUntil: null,
    signature: null,
    key: buildKeyRow(),
    ...overrides,
  };
}

function buildPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    cryptographicKey: { findUnique: jest.fn().mockResolvedValue(buildKeyRow()) },
    signingRequest: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'sr-1', receivedApprovals: 0, ...data }),
        ),
      findUnique: jest.fn().mockResolvedValue(buildSigningRequestRow()),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...buildSigningRequestRow(), ...data }),
        ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    signingSession: {
      create: jest.fn().mockResolvedValue({ id: 'session-1', startedAt: new Date() }),
      update: jest.fn().mockResolvedValue({}),
    },
    transactionPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
    custodyPolicyViolation: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

function buildRegistry(
  signResult: { signature: string; signatureAlg: string; providerCode: string } | Error,
) {
  const provider = {
    sign: jest.fn().mockImplementation(() => {
      if (signResult instanceof Error) return Promise.reject(signResult);
      return Promise.resolve(signResult);
    }),
    verify: jest.fn().mockResolvedValue({ valid: true }),
  };
  return { resolve: jest.fn().mockReturnValue(provider) };
}

const ownerUser: JwtAccessClaims = {
  sub: 'user-1',
  email: 'user@auvora.io',
  sessionId: 's1',
  roles: ['user'],
  permissions: ['custody:write'] as never,
};

const strangerUser: JwtAccessClaims = {
  sub: 'stranger',
  email: 'stranger@auvora.io',
  sessionId: 's2',
  roles: ['user'],
  permissions: ['custody:write'] as never,
};

const crypto = {
  encrypt: (v: string) => `enc:${v}`,
  decrypt: (v: string) => v.replace('enc:', ''),
  hash: (v: string) => `hash:${v}`,
};

const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const ai = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const analytics = { publishEvent: jest.fn().mockResolvedValue(undefined) };

describe('SigningService', () => {
  it('denies a signing request when the policy engine returns DENY', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const policies = {
      evaluateTransactionContext: jest
        .fn()
        .mockResolvedValue({ action: 'DENY', matched: [{ code: 'deny-rule', action: 'DENY' }] }),
    };
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      events as never,
      policies as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(
      service.createRequest(ownerUser, { keyId: 'key-1', payload: 'tx-data' }),
    ).rejects.toThrow(ForbiddenError);
    expect(prisma.custodyPolicyViolation.create).toHaveBeenCalled();
  });

  it('rejects signing requests from non-owners without admin permission', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const events = { publish: jest.fn() };
    const policies = {
      evaluateTransactionContext: jest.fn().mockResolvedValue({ action: 'ALLOW', matched: [] }),
    };
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      events as never,
      policies as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(
      service.createRequest(strangerUser, { keyId: 'key-1', payload: 'tx-data' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('queues an allowed signing request immediately', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const policies = {
      evaluateTransactionContext: jest.fn().mockResolvedValue({ action: 'ALLOW', matched: [] }),
    };
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      events as never,
      policies as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    const created = await service.createRequest(ownerUser, { keyId: 'key-1', payload: 'tx-data' });
    expect((created as { status: string }).status).toBe('QUEUED');
    expect(events.publish).toHaveBeenCalled();
  });

  it('marks a signing request as awaiting approval and sets requiredApprovals from policy', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const policies = {
      evaluateTransactionContext: jest.fn().mockResolvedValue({
        action: 'REQUIRE_APPROVAL',
        matched: [{ code: 'high-value', action: 'REQUIRE_APPROVAL' }],
      }),
      findApplicableApprovalPolicy: jest
        .fn()
        .mockResolvedValue({ id: 'policy-1', kind: 'DUAL', threshold: 2 }),
    };
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      events as never,
      policies as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    const created = await service.createRequest(ownerUser, { keyId: 'key-1', payload: 'tx-data' });
    expect((created as { status: string }).status).toBe('AWAITING_APPROVAL');
    expect((created as { requiredApprovals: number }).requiredApprovals).toBe(2);
  });

  it('refuses to execute a signing request awaiting approval', async () => {
    const prisma = buildPrisma({
      signingRequest: {
        findUnique: jest
          .fn()
          .mockResolvedValue(buildSigningRequestRow({ status: 'AWAITING_APPROVAL' })),
        update: jest.fn(),
      },
    });
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      { publish: jest.fn() } as never,
      {} as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(service.execute('sr-1')).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when executing a missing signing request', async () => {
    const prisma = buildPrisma({
      signingRequest: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      { publish: jest.fn() } as never,
      {} as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(service.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('executes signing successfully and records the signature', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry({
      signature: 'sig-value',
      signatureAlg: 'SECP256K1-SHA256',
      providerCode: 'sim',
    });
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      events as never,
      {} as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    const result = await service.execute('sr-1');
    expect((result as { status: string }).status).toBe('SIGNED');
    expect((result as { signature: string }).signature).toBe('sig-value');
    expect(events.publish).toHaveBeenCalled();
    expect(notifications.publishEvent).toHaveBeenCalled();
    expect(analytics.publishEvent).toHaveBeenCalled();
  });

  it('marks the signing request as FAILED when the provider throws', async () => {
    const prisma = buildPrisma();
    const registry = buildRegistry(new Error('provider exploded'));
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      { publish: jest.fn() } as never,
      {} as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(service.execute('sr-1')).rejects.toThrow('provider exploded');
    expect(prisma.signingRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('refuses to verify a request with no signature yet', async () => {
    const prisma = buildPrisma({
      signingRequest: {
        findUnique: jest.fn().mockResolvedValue(buildSigningRequestRow({ signature: null })),
      },
    });
    const registry = buildRegistry({ signature: 'sig', signatureAlg: 'alg', providerCode: 'sim' });
    const service = new SigningService(
      prisma as never,
      registry as never,
      crypto as never,
      { publish: jest.fn() } as never,
      {} as never,
      notifications as never,
      ai as never,
      analytics as never,
    );

    await expect(service.verifySignature('sr-1')).rejects.toThrow(ConflictError);
  });
});
