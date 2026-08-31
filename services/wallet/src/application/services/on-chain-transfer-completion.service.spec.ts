import { OnChainTransferCompletionService } from './on-chain-transfer-completion.service';

const ownerUserId = 'df1db712-5e50-42c1-92fc-2c7236244cf8';
const txHash = '0xb76fd4160505fa5a9f298bc312073a1278fad6d495b98b1a0fa15c381687f35f';
const fromAddress = '0x1d549b12f406ec094cdc4e796cf64394e06a32b5';

function buildService(
  overrides: {
    redisGet?: string | null;
    watchAddress?: { id: string } | null;
    notifications?: { publishEvent: jest.Mock };
  } = {},
) {
  const redis = {
    getClient: () => ({
      get: jest.fn().mockResolvedValue(overrides.redisGet ?? null),
      set: jest.fn().mockResolvedValue('OK'),
    }),
  };
  const prisma = {
    watchAddress: {
      findFirst: jest.fn().mockResolvedValue(overrides.watchAddress ?? { id: 'w1' }),
    },
    chainAddress: { findFirst: jest.fn().mockResolvedValue(null) },
    wallet: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const notifications = overrides.notifications ?? {
    publishEvent: jest.fn().mockResolvedValue(undefined),
  };
  const env = { NODE_ENV: 'development' as const };
  const service = new OnChainTransferCompletionService(
    prisma as never,
    env as never,
    redis as never,
    notifications as never,
  );
  return { service, notifications, redis };
}

describe('OnChainTransferCompletionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('rejects invalid hash format', async () => {
    const { service } = buildService();
    await expect(
      service.report({
        ownerUserId,
        txHash: '0xabc',
        chainId: 31337,
        networkLabel: 'Auvora Local EVM QA',
        assetCode: 'ETH',
        amount: '0.0001',
        fromAddress,
        toAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      }),
    ).rejects.toThrow('Invalid transaction hash');
  });

  it('is idempotent when redis key exists', async () => {
    const { service, notifications } = buildService({ redisGet: '2026-08-31T00:00:00.000Z' });
    const result = await service.report({
      ownerUserId,
      txHash,
      chainId: 31337,
      networkLabel: 'Auvora Local EVM QA',
      assetCode: 'ETH',
      amount: '0.0001',
      fromAddress,
      toAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });
    expect(result.alreadyReported).toBe(true);
    expect(notifications.publishEvent).not.toHaveBeenCalled();
  });

  it('publishes wallet.transfer.completed after receipt verification', async () => {
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit).body));
      if (body.method === 'eth_getTransactionReceipt') {
        return {
          ok: true,
          json: async () => ({ result: { status: '0x1', blockNumber: '0x4d2' } }),
        };
      }
      if (body.method === 'eth_getTransactionByHash') {
        return {
          ok: true,
          json: async () => ({ result: { from: fromAddress } }),
        };
      }
      return { ok: false, status: 500, json: async () => ({}) };
    }) as typeof fetch;

    const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
    const { service } = buildService({ notifications });
    const result = await service.report({
      ownerUserId,
      txHash,
      chainId: 31337,
      networkLabel: 'Auvora Local EVM QA',
      assetCode: 'ETH',
      amount: '0.0001',
      fromAddress,
      toAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      blockNumber: 1234,
    });
    expect(result.alreadyReported).toBe(false);
    expect(notifications.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'wallet.transfer.completed',
        aggregateId: txHash,
        payload: expect.objectContaining({
          ownerUserId,
          txHash,
          networkLabel: 'Auvora Local EVM QA',
        }),
      }),
    );
  });
});
