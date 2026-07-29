import { ChainNetwork } from '@auvora/database';
import {
  assertSupportedNetworks,
  assertValidPermissions,
  isReadOnlyNetwork,
  normalizeOrigin,
  WEB3_SUPPORTED_NETWORKS,
} from '../../domain/dapp-permissions';
import {
  ConnectionsPermissionDeniedError,
  ConnectionsReplayError,
  ConnectionsUnsupportedError,
  ConnectionsValidationError,
} from '../../domain/errors';
import { DappPlatformService } from './dapp-platform.service';

describe('dapp-permissions domain', () => {
  it('normalizes origins and validates networks/permissions', () => {
    expect(normalizeOrigin('https://App.Example.com/path')).toBe('https://app.example.com');
    expect(WEB3_SUPPORTED_NETWORKS).toEqual(
      expect.arrayContaining(['ETHEREUM', 'BNB_SMART_CHAIN', 'SOLANA', 'TRON', 'BITCOIN']),
    );
    expect(isReadOnlyNetwork(ChainNetwork.BITCOIN)).toBe(true);
    expect(assertValidPermissions(['VIEW_ADDRESSES', 'VIEW_ADDRESSES'])).toEqual([
      'VIEW_ADDRESSES',
    ]);
    expect(() => assertSupportedNetworks(['FANTOM' as ChainNetwork])).toThrow(
      ConnectionsValidationError,
    );
    expect(() => assertValidPermissions(['FLY'])).toThrow(ConnectionsValidationError);
  });
});

describe('DappPlatformService', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const now = new Date('2026-07-27T12:00:00.000Z');

  function createService(
    overrides: {
      prisma?: Record<string, unknown>;
      connections?: Record<string, unknown>;
    } = {},
  ) {
    const prisma = {
      dappConnectionRequest: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      trustedDapp: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      dappPermissionGrant: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      dappBrowserBookmark: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      dappActivityEvent: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      walletConnectSession: {
        count: jest.fn().mockResolvedValue(0),
      },
      ...overrides.prisma,
    };

    const connections = {
      createWalletConnectSession: jest.fn().mockResolvedValue({
        session: { id: 'session-1' },
      }),
      approveSession: jest.fn().mockResolvedValue({ id: 'session-1', status: 'ACTIVE' }),
      prepareSign: jest.fn().mockResolvedValue({
        requestId: 'sign-1',
        prepared: { preview: 'safe preview', feeEstimate: '0.001' },
      }),
      ...overrides.connections,
    };

    const service = new DappPlatformService(
      { CONNECTIONS_SESSION_TTL_SECONDS: 3600 } as never,
      prisma as never,
      { now: () => now } as never,
      { uuid: () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' } as never,
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as never,
      { publishEvent: jest.fn().mockResolvedValue(undefined) } as never,
      connections as never,
    );

    return { service, prisma, connections };
  }

  it('returns platform status with supported networks', () => {
    const { service } = createService();
    const status = service.getPlatformStatus();
    expect(status.phase).toBe(26);
    expect(status.supportedNetworks).toContain('ETHEREUM');
    expect(status.features.bitcoinReadOnly).toBe(true);
  });

  it('creates connection requests with replay protection', async () => {
    const { service, prisma } = createService();
    prisma.dappConnectionRequest.create.mockResolvedValue({
      id: 'req-1',
      origin: 'https://app.uniswap.org',
      name: 'Uniswap',
    });

    const created = await service.createConnectionRequest(userId, {
      origin: 'https://app.uniswap.org/swap',
      name: 'Uniswap',
      networks: [ChainNetwork.ETHEREUM],
      permissions: ['VIEW_ADDRESSES', 'REQUEST_SIGNATURES'],
      proposalNonce: 'nonce-1',
    });

    expect(created.id).toBe('req-1');
    expect(prisma.dappConnectionRequest.create).toHaveBeenCalled();

    prisma.dappConnectionRequest.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.createConnectionRequest(userId, {
        origin: 'https://app.uniswap.org',
        name: 'Uniswap',
        networks: [ChainNetwork.ETHEREUM],
        permissions: ['VIEW_ADDRESSES'],
        proposalNonce: 'nonce-1',
      }),
    ).rejects.toBeInstanceOf(ConnectionsReplayError);
  });

  it('approves requests, grants permissions, and rejects bitcoin tx permissions', async () => {
    const { service, prisma, connections } = createService();
    prisma.dappConnectionRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      userId,
      origin: 'https://app.example.com',
      name: 'Example',
      status: 'PENDING',
      expiresAt: new Date(now.getTime() + 60_000),
      requestedNetworks: [ChainNetwork.ETHEREUM],
      requestedPermissions: ['VIEW_ADDRESSES', 'REQUEST_TRANSACTIONS'],
    });
    prisma.trustedDapp.upsert.mockResolvedValue({ id: 'trusted-1' });
    prisma.dappPermissionGrant.upsert.mockResolvedValue({});
    prisma.dappConnectionRequest.update.mockResolvedValue({ id: 'req-1', status: 'APPROVED' });

    const approved = await service.approveConnectionRequest(userId, 'req-1', {
      accounts: ['0x1111111111111111111111111111111111111111'],
      trustDapp: true,
    });
    expect(approved.session.id).toBe('session-1');
    expect(connections.createWalletConnectSession).toHaveBeenCalled();
    expect(prisma.dappPermissionGrant.upsert).toHaveBeenCalled();

    prisma.dappConnectionRequest.findFirst.mockResolvedValue({
      id: 'req-btc',
      userId,
      origin: 'https://btc.example.com',
      name: 'BTC dApp',
      status: 'PENDING',
      expiresAt: new Date(now.getTime() + 60_000),
      requestedNetworks: [ChainNetwork.BITCOIN],
      requestedPermissions: ['REQUEST_TRANSACTIONS'],
    });
    await expect(
      service.approveConnectionRequest(userId, 'req-btc', {
        accounts: ['bc1qexample'],
      }),
    ).rejects.toBeInstanceOf(ConnectionsUnsupportedError);
  });

  it('rejects connection requests and enforces permission checks for signing', async () => {
    const { service, prisma } = createService();
    prisma.dappConnectionRequest.findFirst.mockResolvedValue({
      id: 'req-2',
      userId,
      origin: 'https://app.example.com',
      name: 'Example',
      status: 'PENDING',
    });
    prisma.dappConnectionRequest.update.mockResolvedValue({ id: 'req-2', status: 'REJECTED' });
    await expect(service.rejectConnectionRequest(userId, 'req-2')).resolves.toMatchObject({
      status: 'REJECTED',
    });

    prisma.dappPermissionGrant.findUnique.mockResolvedValue(null);
    await expect(
      service.prepareDappSign(userId, {
        origin: 'https://app.example.com',
        kind: 'HARDWARE',
        connectionRef: 'ledger-nano-x-sim-1',
        network: ChainNetwork.ETHEREUM,
        payloadType: 'MESSAGE',
        payload: 'hello',
      }),
    ).rejects.toBeInstanceOf(ConnectionsPermissionDeniedError);
  });

  it('prepares typed-data signing when permission is granted', async () => {
    const { service, prisma, connections } = createService();
    prisma.dappPermissionGrant.findUnique.mockResolvedValue({
      allowed: true,
      revokedAt: null,
      expiresAt: null,
    });

    const prepared = await service.prepareDappSign(userId, {
      origin: 'https://app.example.com',
      kind: 'HARDWARE',
      connectionRef: 'ledger-nano-x-sim-1',
      network: ChainNetwork.ETHEREUM,
      payloadType: 'TYPED_DATA',
      payload: '{"domain":{"name":"Auvora"}}',
    });

    expect(prepared.payloadType).toBe('TYPED_DATA');
    expect(prepared.preview.safe).toBe(true);
    expect(connections.prepareSign).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ payloadType: 'TYPED_DATA' }),
    );
  });

  it('visits dApps with origin validation and expires stale grants', async () => {
    const { service, prisma } = createService();
    prisma.dappBrowserBookmark.upsert.mockResolvedValue({
      id: 'bm-1',
      title: 'Example',
      url: 'https://app.example.com/swap',
      isTrusted: false,
    });

    const visit = await service.visitDapp(userId, { url: 'https://app.example.com/swap' });
    expect(visit.security.warning).toContain('trusted');

    await expect(service.visitDapp(userId, { url: 'ftp://bad' })).rejects.toBeInstanceOf(
      ConnectionsValidationError,
    );

    prisma.dappConnectionRequest.updateMany.mockResolvedValue({ count: 2 });
    prisma.dappPermissionGrant.updateMany.mockResolvedValue({ count: 3 });
    await expect(service.expireStaleRequests()).resolves.toBe(2);
    await expect(service.expireStalePermissions()).resolves.toBe(3);
  });

  it('revokes trusted dApps and updates individual permissions', async () => {
    const { service, prisma } = createService();
    prisma.trustedDapp.findFirst.mockResolvedValue({
      id: 'trusted-1',
      origin: 'https://app.example.com',
      name: 'Example',
    });
    prisma.trustedDapp.update.mockResolvedValue({ id: 'trusted-1', status: 'REVOKED' });
    await expect(service.revokeTrustedDapp(userId, 'trusted-1')).resolves.toMatchObject({
      status: 'REVOKED',
    });
    expect(prisma.dappPermissionGrant.updateMany).toHaveBeenCalled();

    prisma.dappPermissionGrant.upsert.mockResolvedValue({
      id: 'grant-1',
      permission: 'NETWORK_SWITCH',
      allowed: false,
    });
    await expect(
      service.updatePermission(userId, {
        origin: 'https://app.example.com',
        permission: 'NETWORK_SWITCH',
        allowed: false,
      }),
    ).resolves.toMatchObject({ allowed: false });
  });
});
