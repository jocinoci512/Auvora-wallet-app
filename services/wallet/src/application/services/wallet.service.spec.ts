import { WalletStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { WalletService } from './wallet.service';
import { ForbiddenError, NotFoundError } from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';

const userId = 'user-1';
const otherUserId = 'user-2';
const walletId = 'wallet-1';
const assetId = 'asset-1';

const baseWallet = {
  id: walletId,
  ownerUserId: userId,
  assetId,
  assetCode: 'BTC',
  assetSymbol: 'BTC',
  assetDecimals: 8,
  assetChain: 'BITCOIN',
  assetStandard: 'NATIVE',
  alias: null,
  label: null,
  status: WalletStatus.ACTIVE,
  metadata: null,
  preferences: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
};

function createRequester(overrides: Partial<JwtAccessClaims> = {}): JwtAccessClaims {
  return {
    sub: userId,
    email: 'user@example.com',
    sessionId: 'session-1',
    roles: ['user'],
    permissions: [],
    ...overrides,
  };
}

function createWalletService(deps: {
  wallets?: Record<string, jest.Mock>;
  ledger?: Record<string, jest.Mock>;
  transactions?: Record<string, jest.Mock>;
  ids?: Record<string, jest.Mock>;
  notifications?: Record<string, jest.Mock>;
  ai?: Record<string, jest.Mock>;
  analytics?: Record<string, jest.Mock>;
}): WalletService {
  return new WalletService(
    (deps.wallets ?? {
      findAssetByCode: jest.fn(),
      findById: jest.fn(),
      findByOwnerAssetAlias: jest.fn(),
      createWithZeroBalance: jest.fn(),
      update: jest.fn(),
      transitionStatus: jest.fn(),
      listByOwner: jest.fn(),
      search: jest.fn(),
      getStatusHistory: jest.fn(),
    }) as never,
    (deps.ledger ?? {
      getBalance: jest.fn(),
      applyEntry: jest.fn(),
      getEntries: jest.fn(),
      createSnapshot: jest.fn(),
      getSnapshots: jest.fn(),
      getAudits: jest.fn(),
    }) as never,
    (deps.transactions ?? {
      create: jest.fn(),
      complete: jest.fn(),
      findByWallet: jest.fn(),
      findById: jest.fn(),
    }) as never,
    (deps.ids ?? { uuid: jest.fn().mockReturnValue('uuid-1') }) as never,
    (deps.notifications ?? { publishEvent: jest.fn().mockResolvedValue(undefined) }) as never,
    (deps.ai ?? { publishEvent: jest.fn().mockResolvedValue(undefined) }) as never,
    (deps.analytics ?? { publishEvent: jest.fn().mockResolvedValue(undefined) }) as never,
  );
}

describe('WalletService', () => {
  it('creates a wallet and auto-activates it', async () => {
    const wallets = {
      findAssetByCode: jest
        .fn()
        .mockResolvedValue({ id: assetId, code: 'BTC', symbol: 'BTC', decimals: 8 }),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      createWithZeroBalance: jest
        .fn()
        .mockResolvedValue({ ...baseWallet, status: WalletStatus.PENDING }),
      transitionStatus: jest.fn().mockResolvedValue(baseWallet),
    };
    const service = createWalletService({ wallets });

    const result = await service.createWallet({
      ownerUserId: userId,
      assetCode: 'BTC',
    });

    expect(result.status).toBe(WalletStatus.ACTIVE);
    expect(wallets.createWithZeroBalance).toHaveBeenCalled();
    expect(wallets.transitionStatus).toHaveBeenCalledWith(
      walletId,
      WalletStatus.ACTIVE,
      userId,
      'Auto-activated on creation',
    );
  });

  it('forbids access when requester is not owner and lacks admin permission', async () => {
    const wallets = {
      findById: jest.fn().mockResolvedValue(baseWallet),
    };
    const service = createWalletService({ wallets });

    await expect(
      service.getWallet(walletId, createRequester({ sub: otherUserId })),
    ).rejects.toThrow(ForbiddenError);
  });

  it('allows admin to access any wallet', async () => {
    const wallets = {
      findById: jest.fn().mockResolvedValue(baseWallet),
    };
    const service = createWalletService({ wallets });

    const result = await service.getWallet(
      walletId,
      createRequester({ sub: otherUserId, permissions: [PERMISSION_WALLETS_ADMIN] }),
    );

    expect(result.id).toBe(walletId);
  });

  it('throws NotFound when wallet does not exist', async () => {
    const wallets = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const service = createWalletService({ wallets });

    await expect(service.getWallet(walletId, createRequester())).rejects.toThrow(NotFoundError);
  });

  describe('ledger credit/debit math', () => {
    it('credits wallet via ledger repository', async () => {
      const wallets = {
        findById: jest.fn().mockResolvedValue(baseWallet),
      };
      const transactions = {
        create: jest.fn().mockResolvedValue({
          id: 'tx-1',
          reference: 'WTX-uuid-1',
          type: 'ADJUSTMENT',
          status: 'PENDING',
          amount: '100',
        }),
        complete: jest.fn().mockResolvedValue({ id: 'tx-1', status: 'COMPLETED' }),
      };
      const ledger = {
        applyEntry: jest.fn().mockResolvedValue({
          entry: { id: 'entry-1', amount: '100', entryType: 'CREDIT' },
          balance: { available: '100', total: '100' },
        }),
      };
      const service = createWalletService({ wallets, ledger, transactions });

      const result = await service.creditWallet(
        { walletId, amount: '100' },
        createRequester({ permissions: [PERMISSION_WALLETS_ADMIN] }),
      );

      expect(ledger.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          walletId,
          assetId,
          entryType: 'CREDIT',
          amount: '100',
        }),
      );
      expect(result.balance.available).toBe('100');
      expect(transactions.complete).toHaveBeenCalledWith('tx-1');
    });

    it('debits wallet via ledger repository', async () => {
      const wallets = {
        findById: jest.fn().mockResolvedValue(baseWallet),
      };
      const transactions = {
        create: jest.fn().mockResolvedValue({
          id: 'tx-2',
          reference: 'WTX-uuid-1',
        }),
        complete: jest.fn().mockResolvedValue({ id: 'tx-2', status: 'COMPLETED' }),
      };
      const ledger = {
        applyEntry: jest.fn().mockResolvedValue({
          entry: { id: 'entry-2', amount: '50', entryType: 'DEBIT' },
          balance: { available: '50', total: '50' },
        }),
      };
      const service = createWalletService({ wallets, ledger, transactions });

      const result = await service.debitWallet(
        { walletId, amount: '50' },
        createRequester({ permissions: [PERMISSION_WALLETS_ADMIN] }),
      );

      expect(ledger.applyEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: 'DEBIT',
          amount: '50',
        }),
      );
      expect(result.balance.available).toBe('50');
    });
  });
});
