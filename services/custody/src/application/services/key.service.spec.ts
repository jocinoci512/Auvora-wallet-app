import type { JwtAccessClaims } from '@auvora/types';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain';
import { KeyService } from './key.service';

function buildKeyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'key-1',
    ownerUserId: 'user-1',
    walletId: null,
    providerId: null,
    label: null,
    algorithm: 'SECP256K1',
    custodyModel: 'SELF',
    status: 'ACTIVE',
    publicKey: 'pub-key',
    materialEncrypted: 'v1:iv:tag:data',
    providerRef: 'sim-ref',
    currentVersion: 1,
    exportAllowed: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    revokedAt: null,
    destroyedAt: null,
    ...overrides,
  };
}

function buildPrismaMock(keyRow: ReturnType<typeof buildKeyRow>) {
  return {
    custodyProviderRecord: { findFirst: jest.fn().mockResolvedValue(null) },
    cryptographicKey: {
      create: jest.fn().mockResolvedValue(keyRow),
      findMany: jest.fn().mockResolvedValue([keyRow]),
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockResolvedValue(keyRow),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...keyRow, ...data }),
      ),
    },
    keyVersion: { create: jest.fn().mockResolvedValue({}) },
    keyAuditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
  };
}

function buildProviderRegistryMock() {
  const provider = {
    getCode: () => 'local-custody-simulator',
    getModel: () => 'SELF',
    generateKey: jest.fn().mockResolvedValue({
      providerCode: 'local-custody-simulator',
      publicKey: 'new-pub',
      materialEncrypted: 'v1:new',
      providerRef: 'sim-new',
    }),
    sign: jest.fn(),
    verify: jest.fn(),
    rotate: jest.fn().mockResolvedValue({
      providerCode: 'local-custody-simulator',
      publicKey: 'rotated-pub',
      materialEncrypted: 'v1:rotated',
      providerRef: 'sim-rotated',
    }),
    destroy: jest.fn().mockResolvedValue({ destroyed: true }),
  };
  return { resolve: jest.fn().mockReturnValue(provider) };
}

const adminUser: JwtAccessClaims = {
  sub: 'admin-1',
  email: 'admin@auvora.io',
  sessionId: 's1',
  roles: ['admin'],
  permissions: ['custody:admin', 'custody:read', 'custody:write'] as never,
};

const ownerUser: JwtAccessClaims = {
  sub: 'user-1',
  email: 'user@auvora.io',
  sessionId: 's2',
  roles: ['user'],
  permissions: ['custody:read', 'custody:write'] as never,
};

const strangerUser: JwtAccessClaims = {
  sub: 'stranger-1',
  email: 'stranger@auvora.io',
  sessionId: 's3',
  roles: ['user'],
  permissions: ['custody:read', 'custody:write'] as never,
};

describe('KeyService', () => {
  it('generates a key and strips materialEncrypted from the response', async () => {
    const keyRow = buildKeyRow();
    const prisma = buildPrismaMock(keyRow);
    const registry = buildProviderRegistryMock();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new KeyService(prisma as never, registry as never, events as never);

    const result = await service.generate('user-1', { algorithm: 'SECP256K1' as never, custodyModel: 'SELF' as never });

    expect(result).not.toHaveProperty('materialEncrypted');
    expect(registry.resolve).toHaveBeenCalledWith('SELF');
    expect(events.publish).toHaveBeenCalled();
  });

  it('lists keys for an owner without leaking material', async () => {
    const keyRow = buildKeyRow();
    const prisma = buildPrismaMock(keyRow);
    const registry = buildProviderRegistryMock();
    const events = { publish: jest.fn() };
    const service = new KeyService(prisma as never, registry as never, events as never);

    const result = await service.list({ ownerUserId: 'user-1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('materialEncrypted');
  });

  it('throws NotFoundError when getting a missing key', async () => {
    const prisma = buildPrismaMock(buildKeyRow());
    prisma.cryptographicKey.findUnique.mockResolvedValueOnce(null);
    const registry = buildProviderRegistryMock();
    const service = new KeyService(prisma as never, registry as never, { publish: jest.fn() } as never);

    await expect(service.get('missing')).rejects.toThrow(NotFoundError);
  });

  it('forbids access to another user key without admin permission', async () => {
    const prisma = buildPrismaMock(buildKeyRow());
    const registry = buildProviderRegistryMock();
    const service = new KeyService(prisma as never, registry as never, { publish: jest.fn() } as never);

    await expect(service.get('key-1', strangerUser)).rejects.toThrow(ForbiddenError);
    await expect(service.get('key-1', ownerUser)).resolves.toBeDefined();
  });

  it('rotates an active key and increments the version', async () => {
    const prisma = buildPrismaMock(buildKeyRow());
    const registry = buildProviderRegistryMock();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new KeyService(prisma as never, registry as never, events as never);

    const result = await service.rotate('key-1', ownerUser);
    expect(prisma.keyVersion.create).toHaveBeenCalled();
    expect((result as { currentVersion: number }).currentVersion).toBe(2);
    expect(events.publish).toHaveBeenCalled();
  });

  it('refuses to rotate a revoked key', async () => {
    const prisma = buildPrismaMock(buildKeyRow({ status: 'REVOKED' }));
    const registry = buildProviderRegistryMock();
    const service = new KeyService(prisma as never, registry as never, { publish: jest.fn() } as never);

    await expect(service.rotate('key-1', ownerUser)).rejects.toThrow(ConflictError);
  });

  it('requires admin permission to revoke a key', async () => {
    const prisma = buildPrismaMock(buildKeyRow());
    const registry = buildProviderRegistryMock();
    const service = new KeyService(prisma as never, registry as never, { publish: jest.fn() } as never);

    await expect(service.revoke('key-1', ownerUser)).rejects.toThrow(ForbiddenError);
    await expect(service.revoke('key-1', adminUser)).resolves.toBeDefined();
  });

  it('destroys a key via the provider and clears material', async () => {
    const prisma = buildPrismaMock(buildKeyRow());
    const registry = buildProviderRegistryMock();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new KeyService(prisma as never, registry as never, events as never);

    const result = await service.destroy('key-1', adminUser);
    expect(prisma.cryptographicKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DESTROYED', materialEncrypted: null }) }),
    );
    expect(result).not.toHaveProperty('materialEncrypted');
  });
});
