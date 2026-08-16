import { ChainNetwork } from '@auvora/database';
import { ConnectionsEngineService } from './connections-engine.service';
import { ConnectionsNotFoundError, ConnectionsValidationError } from '../../domain/errors';

/**
 * Sign-request security: connectionRef ownership (IDOR) on prepareSign, and
 * CONNECTIONS_SIGN_TIMEOUT_SECONDS expiry + replay protection on confirmSign.
 */
const T0 = new Date('2026-08-14T12:00:00.000Z');

type BuildOpts = {
  connection?: { id: string; canSign: boolean } | null;
  signRequest?: Record<string, unknown> | null;
  timeoutSeconds?: number;
  now?: Date;
  completeResult?: Record<string, unknown>;
};

function build(opts: BuildOpts = {}) {
  const externalWalletConnection = {
    findFirst: jest.fn().mockResolvedValue(opts.connection ?? null),
    create: jest.fn().mockResolvedValue({ id: 'conn-created' }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const externalSigningRequest = {
    create: jest.fn().mockResolvedValue({ id: 'req-1' }),
    findFirst: jest.fn().mockResolvedValue(opts.signRequest ?? null),
    update: jest.fn().mockResolvedValue({}),
  };
  const connectionRetryJob = { create: jest.fn().mockResolvedValue({}) };
  const prisma = {
    externalWalletConnection,
    externalSigningRequest,
    connectionRetryJob,
  };
  const providers = {
    prepareSign: jest.fn().mockResolvedValue({
      simulationOk: true,
      dataHash: 'hash-1',
      preview: 'preview-1',
      feeEstimate: '0.001',
      requestId: 'provider-req-1',
    }),
    completeSign: jest.fn().mockResolvedValue(
      opts.completeResult ?? {
        status: 'COMPLETED',
        verified: true,
        signature: 'raw-signature',
        txHash: '0xabc',
      },
    ),
  };
  const clock = { now: () => opts.now ?? T0 };
  const ids = { uuid: () => 'uuid-1' };
  const crypto = { encrypt: (s: string) => `enc:${s}`, decrypt: (s: string) => s };
  const analytics = { publishEvent: jest.fn() };
  const notifications = { publishEvent: jest.fn() };
  const ai = { publish: jest.fn(), publishEvent: jest.fn() };
  const env = {
    CONNECTIONS_SIGN_TIMEOUT_SECONDS: opts.timeoutSeconds ?? 120,
  } as never;
  const engine = new ConnectionsEngineService(
    env,
    prisma as never,
    providers as never,
    clock as never,
    ids as never,
    crypto as never,
    analytics as never,
    notifications as never,
    ai as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { engine, prisma, providers, externalWalletConnection, externalSigningRequest };
}

const validPrepareInput = {
  kind: 'HARDWARE' as const,
  connectionRef: 'ledger-1',
  network: ChainNetwork.ETHEREUM,
  payloadType: 'MESSAGE' as const,
  payload: 'hello auvora',
};

describe('ConnectionsEngineService.prepareSign connectionRef ownership (IDOR)', () => {
  it('User A can prepare a sign against their own active signable connection', async () => {
    const { engine, externalWalletConnection, providers } = build({
      connection: { id: 'conn-A', canSign: true },
    });
    await expect(engine.prepareSign('user-A', validPrepareInput)).resolves.toMatchObject({
      requiresConfirmation: true,
    });
    // Ownership is enforced by a DB query scoped by BOTH userId and externalRef.
    expect(externalWalletConnection.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-A',
        externalRef: 'ledger-1',
        kind: 'HARDWARE',
        status: 'CONNECTED',
      },
      select: { id: true, canSign: true },
    });
    expect(providers.prepareSign).toHaveBeenCalledTimes(1);
  });

  it("User B cannot prepare a sign against User A's connectionRef (scoped query returns null)", async () => {
    const { engine, providers, externalSigningRequest } = build({ connection: null });
    await expect(engine.prepareSign('user-B', validPrepareInput)).rejects.toBeInstanceOf(
      ConnectionsNotFoundError,
    );
    // Never reaches the provider or creates a request.
    expect(providers.prepareSign).not.toHaveBeenCalled();
    expect(externalSigningRequest.create).not.toHaveBeenCalled();
  });

  it('nonexistent connectionRef fails safely with a generic not-found (no existence leak)', async () => {
    const { engine } = build({ connection: null });
    await expect(
      engine.prepareSign('user-A', { ...validPrepareInput, connectionRef: 'does-not-exist' }),
    ).rejects.toThrow(/not found/i);
  });

  it('revoked/disconnected connection is rejected (only CONNECTED is signable)', async () => {
    // findFirst is filtered by status: CONNECTED, so a disconnected row resolves to null.
    const { engine, externalWalletConnection } = build({ connection: null });
    await expect(engine.prepareSign('user-A', validPrepareInput)).rejects.toBeInstanceOf(
      ConnectionsNotFoundError,
    );
    expect(externalWalletConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'CONNECTED' }) }),
    );
  });

  it('a connection that cannot sign is rejected', async () => {
    const { engine, providers } = build({ connection: { id: 'conn-A', canSign: false } });
    await expect(engine.prepareSign('user-A', validPrepareInput)).rejects.toBeInstanceOf(
      ConnectionsNotFoundError,
    );
    expect(providers.prepareSign).not.toHaveBeenCalled();
  });

  it('READONLY connections can never sign', async () => {
    const { engine, externalWalletConnection } = build({
      connection: { id: 'conn-A', canSign: true },
    });
    await expect(
      engine.prepareSign('user-A', { ...validPrepareInput, kind: 'READONLY' }),
    ).rejects.toThrow(/not allowed/i);
    // Rejected before any DB lookup.
    expect(externalWalletConnection.findFirst).not.toHaveBeenCalled();
  });
});

describe('ConnectionsEngineService.confirmSign timeout + replay protection', () => {
  const pending = (createdAt: Date) => ({
    id: 'req-1',
    userId: 'user-A',
    status: 'PENDING_CONFIRMATION',
    providerRequestId: 'provider-req-1',
    payloadType: 'MESSAGE',
    createdAt,
  });

  it('confirm before expiry succeeds when otherwise valid', async () => {
    const now = new Date(T0.getTime() + 10_000); // 10s after creation, timeout 120s
    const { engine, providers, externalSigningRequest } = build({
      signRequest: pending(T0),
      timeoutSeconds: 120,
      now,
    });
    await expect(engine.confirmSign('user-A', 'req-1', true)).resolves.toMatchObject({
      status: 'COMPLETED',
      signaturePresent: true,
    });
    expect(providers.completeSign).toHaveBeenCalledWith('provider-req-1', true);
    // Signature is stored encrypted, never in plaintext.
    const updateData = externalSigningRequest.update.mock.calls.at(-1)?.[0]?.data;
    expect(updateData.status).toBe('COMPLETED');
    expect(updateData.signature).toBe('enc:raw-signature');
  });

  it('confirm exactly at expiry fails and marks the request EXPIRED (never completed)', async () => {
    const now = new Date(T0.getTime() + 120_000); // exactly at expiry
    const { engine, providers, externalSigningRequest } = build({
      signRequest: pending(T0),
      timeoutSeconds: 120,
      now,
    });
    await expect(engine.confirmSign('user-A', 'req-1', true)).rejects.toThrow(/expired/i);
    // The provider is never asked to sign an expired request.
    expect(providers.completeSign).not.toHaveBeenCalled();
    const updateData = externalSigningRequest.update.mock.calls.at(-1)?.[0]?.data;
    expect(updateData.status).toBe('EXPIRED');
  });

  it('confirm after expiry fails', async () => {
    const now = new Date(T0.getTime() + 121_000);
    const { engine, providers } = build({ signRequest: pending(T0), timeoutSeconds: 120, now });
    await expect(engine.confirmSign('user-A', 'req-1', true)).rejects.toThrow(/expired/i);
    expect(providers.completeSign).not.toHaveBeenCalled();
  });

  it('the configured timeout value is actually used', async () => {
    // With a 10s timeout, a confirmation at +11s is expired...
    const expired = build({
      signRequest: pending(T0),
      timeoutSeconds: 10,
      now: new Date(T0.getTime() + 11_000),
    });
    await expect(expired.engine.confirmSign('user-A', 'req-1', true)).rejects.toThrow(/expired/i);
    expect(expired.providers.completeSign).not.toHaveBeenCalled();

    // ...but a confirmation at +9s still succeeds.
    const ok = build({
      signRequest: pending(T0),
      timeoutSeconds: 10,
      now: new Date(T0.getTime() + 9_000),
    });
    await expect(ok.engine.confirmSign('user-A', 'req-1', true)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    expect(ok.providers.completeSign).toHaveBeenCalledTimes(1);
  });

  it('another user cannot confirm the request (scoped by userId)', async () => {
    // findFirst is scoped by { id, userId }, so User B never loads User A's request.
    const { engine, providers, externalSigningRequest } = build({ signRequest: null });
    await expect(engine.confirmSign('user-B', 'req-1', true)).rejects.toBeInstanceOf(
      ConnectionsNotFoundError,
    );
    expect(externalSigningRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'req-1', userId: 'user-B' },
    });
    expect(providers.completeSign).not.toHaveBeenCalled();
  });

  it.each(['COMPLETED', 'REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED'])(
    'a %s request cannot be replayed to completion',
    async (status) => {
      const { engine, providers } = build({
        signRequest: { ...pending(T0), status },
        now: new Date(T0.getTime() + 1_000),
      });
      await expect(engine.confirmSign('user-A', 'req-1', true)).rejects.toBeInstanceOf(
        ConnectionsValidationError,
      );
      expect(providers.completeSign).not.toHaveBeenCalled();
    },
  );

  it('preserves user rejection path (confirmed=false) within the timeout window', async () => {
    const { engine, providers } = build({
      signRequest: pending(T0),
      now: new Date(T0.getTime() + 5_000),
      completeResult: { status: 'REJECTED', errorMessage: 'User rejected' },
    });
    await expect(engine.confirmSign('user-A', 'req-1', false)).resolves.toMatchObject({
      status: 'REJECTED',
    });
    expect(providers.completeSign).toHaveBeenCalledWith('provider-req-1', false);
  });
});
