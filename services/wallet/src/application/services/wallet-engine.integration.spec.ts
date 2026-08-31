import { WalletStatus } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { WalletEngineService } from './wallet-engine.service';
import { PortfolioEngineService } from './portfolio-engine.service';
import { WalletSyncService } from './wallet-sync.service';
import { WalletRetryQueue } from './wallet-retry.queue';
import { ValidationError } from '../../domain';

const userId = 'user-1';
const walletId = 'wallet-1';

const baseWallet = {
  id: walletId,
  ownerUserId: userId,
  assetId: 'asset-eth',
  assetCode: 'ETH',
  assetSymbol: 'ETH',
  assetDecimals: 18,
  assetChain: 'ETHEREUM',
  assetStandard: 'NATIVE',
  alias: null,
  label: 'Primary',
  status: WalletStatus.ACTIVE,
  metadata: { chainSync: { address: '0x' + 'a'.repeat(40), importMode: 'generated' as const } },
  preferences: {
    activeNetwork: 'ETHEREUM',
    activeAccountIndex: 0,
    accounts: [{ index: 0, label: 'Primary', isDefault: true, derivationPath: "m/44'/60'/0'/0/0" }],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
};

function requester(): JwtAccessClaims {
  return {
    sub: userId,
    email: 'u@example.com',
    sessionId: 's1',
    roles: ['user'],
    permissions: [],
  };
}

describe('WalletEngineService', () => {
  it('creates a wallet with HD account metadata and optional address provision', async () => {
    const created = { ...baseWallet, metadata: { engine: 'phase18' }, preferences: {} };
    const walletService = {
      createWallet: jest.fn().mockResolvedValue(created),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn().mockResolvedValue({
        id: 'asset-eth',
        code: 'ETH',
        symbol: 'ETH',
        decimals: 18,
        chain: 'ETHEREUM',
        standard: 'NATIVE',
      }),
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...created,
        ...data,
        preferences: data.preferences ?? created.preferences,
        metadata: data.metadata ?? created.metadata,
        assetChain: 'ETHEREUM',
        assetStandard: 'NATIVE',
      })),
    };
    const blockchain = {
      createAddress: jest.fn().mockResolvedValue({
        id: 'addr-1',
        chain: 'ETHEREUM',
        address: '0x' + 'b'.repeat(40),
      }),
      validateAddress: jest.fn(),
      listChains: jest.fn().mockResolvedValue(['ETHEREUM']),
    };

    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      blockchain as never,
    );
    const result = await engine.createWallet({
      ownerUserId: userId,
      assetCode: 'ETH',
      provisionAddress: true,
    });

    expect(walletService.createWallet).toHaveBeenCalled();
    expect(blockchain.createAddress).toHaveBeenCalled();
    expect(result.metadata).toBeDefined();
    const meta = result.metadata as { chainSync?: { address?: string } };
    expect(meta.chainSync?.address).toMatch(/^0x/);
  });

  it('imports public addresses only after validation', async () => {
    const walletService = {
      createWallet: jest.fn(),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn().mockResolvedValue({
        id: 'a',
        code: 'ETH',
        symbol: 'ETH',
        decimals: 18,
        chain: 'ETHEREUM',
        standard: 'NATIVE',
      }),
      findByOwnerAssetAlias: jest.fn(),
      findByOwnerAsset: jest.fn(),
      update: jest.fn().mockResolvedValue(baseWallet),
    };
    const blockchain = {
      validateAddress: jest.fn().mockResolvedValue(false),
      createAddress: jest.fn(),
      listChains: jest.fn(),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      blockchain as never,
    );
    await expect(
      engine.importPublicAddress(
        { ownerUserId: userId, assetCode: 'ETH', address: 'bad' },
        requester(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(blockchain.validateAddress).not.toHaveBeenCalled();
  });

  it('imports public ETH metadata without calling blockchain when format is valid', async () => {
    const created = { ...baseWallet, metadata: {}, preferences: {} };
    const walletService = {
      createWallet: jest.fn().mockResolvedValue(created),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn().mockResolvedValue({
        id: 'asset-eth',
        code: 'ETH',
        symbol: 'ETH',
        decimals: 18,
        chain: 'ETHEREUM',
        standard: 'NATIVE',
      }),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      findByOwnerAsset: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...created,
        ...data,
        assetCode: 'ETH',
        assetChain: 'ETHEREUM',
      })),
    };
    const blockchain = {
      validateAddress: jest.fn().mockResolvedValue(false),
      createAddress: jest.fn(),
      listChains: jest.fn(),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      blockchain as never,
    );
    const addr = '0x' + 'c'.repeat(40);
    const saved = await engine.importPublicAddress(
      {
        ownerUserId: userId,
        assetCode: 'ETH',
        address: addr,
        networkEnv: 'testnet',
        selfCustody: true,
      },
      requester(),
    );
    expect(blockchain.validateAddress).not.toHaveBeenCalled();
    expect(walletService.createWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        assetCode: 'ETH',
        alias: 'auvora-public-testnet-eth',
        provisionAddress: false,
      }),
    );
    expect(JSON.stringify(saved)).not.toMatch(/mnemonic|privateKey|seed/i);
  });

  it('keeps ETH and BNB as separate rows for the same EVM address', async () => {
    const ethExisting = { ...baseWallet };
    const bnbCreated = {
      ...baseWallet,
      id: 'wallet-bnb',
      assetId: 'asset-bnb',
      assetCode: 'BNB',
      assetChain: 'BNB_SMART_CHAIN',
      metadata: {},
      preferences: {},
    };
    const walletService = {
      createWallet: jest.fn().mockResolvedValue(bnbCreated),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn(async (code: string) => {
        if (code === 'ETH') {
          return {
            id: 'asset-eth',
            code: 'ETH',
            symbol: 'ETH',
            decimals: 18,
            chain: 'ETHEREUM',
            standard: 'NATIVE',
          };
        }
        return {
          id: 'asset-bnb',
          code: 'BNB',
          symbol: 'BNB',
          decimals: 18,
          chain: 'BNB_SMART_CHAIN',
          standard: 'NATIVE',
        };
      }),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      findByOwnerAsset: jest.fn(async (_owner: string, assetId: string) =>
        assetId === 'asset-eth' ? ethExisting : null,
      ),
      update: jest.fn().mockImplementation(async (id, data) => ({
        ...(id === walletId ? ethExisting : bnbCreated),
        ...data,
      })),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      { validateAddress: jest.fn(), createAddress: jest.fn(), listChains: jest.fn() } as never,
    );
    const addr = '0x' + 'd'.repeat(40);
    const eth = await engine.importPublicAddress(
      { ownerUserId: userId, assetCode: 'ETH', address: addr, selfCustody: true },
      requester(),
    );
    await engine.importPublicAddress(
      { ownerUserId: userId, assetCode: 'BNB', address: addr, selfCustody: true },
      requester(),
    );
    expect(eth.id).toBe(walletId);
    expect(walletService.createWallet).toHaveBeenCalledTimes(1);
  });

  it('rejects a different user before looking up assets', async () => {
    const repo = {
      findAssetByCode: jest.fn(),
      findByOwnerAssetAlias: jest.fn(),
      findByOwnerAsset: jest.fn(),
    };
    const engine = new WalletEngineService(
      { createWallet: jest.fn(), getWallet: jest.fn(), restore: jest.fn() } as never,
      repo as never,
      { validateAddress: jest.fn(), listChains: jest.fn() } as never,
    );
    await expect(
      engine.importPublicAddress(
        { ownerUserId: userId, assetCode: 'ETH', address: '0x' + 'e'.repeat(40) },
        { ...requester(), sub: 'other-user' },
      ),
    ).rejects.toBeTruthy();
    expect(repo.findAssetByCode).not.toHaveBeenCalled();
  });

  it('rejects mnemonic-shaped payloads', async () => {
    const engine = new WalletEngineService(
      { createWallet: jest.fn(), getWallet: jest.fn(), restore: jest.fn() } as never,
      {
        findAssetByCode: jest.fn(),
        findByOwnerAssetAlias: jest.fn(),
        findByOwnerAsset: jest.fn(),
      } as never,
      { listChains: jest.fn() } as never,
    );
    await expect(
      engine.importPublicAddress(
        {
          ownerUserId: userId,
          assetCode: 'ETH',
          address:
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        },
        requester(),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('maps POL to MATIC and stores testnet environment on a Polygon row', async () => {
    const created = {
      ...baseWallet,
      id: 'wallet-matic',
      assetId: 'asset-matic',
      assetCode: 'MATIC',
      assetChain: 'POLYGON',
      metadata: {},
      preferences: {},
    };
    const walletService = {
      createWallet: jest.fn().mockResolvedValue(created),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn().mockResolvedValue({
        id: 'asset-matic',
        code: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
        chain: 'POLYGON',
        standard: 'NATIVE',
      }),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      findByOwnerAsset: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(async (_id, data) => ({ ...created, ...data })),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      { validateAddress: jest.fn(), createAddress: jest.fn(), listChains: jest.fn() } as never,
    );
    await engine.importPublicAddress(
      {
        ownerUserId: userId,
        assetCode: 'POL',
        address: '0x' + 'f'.repeat(40),
        networkEnv: 'testnet',
        selfCustody: true,
      },
      requester(),
    );
    expect(repo.findAssetByCode).toHaveBeenCalledWith('MATIC');
    expect(walletService.createWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        assetCode: 'MATIC',
        alias: 'auvora-public-testnet-matic',
      }),
    );
  });

  it('imports bitcoin testnet tb1, solana, and tron public metadata without secrets', async () => {
    const created = { ...baseWallet, metadata: {}, preferences: {} };
    const walletService = {
      createWallet: jest.fn().mockResolvedValue(created),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn(async (code: string) => ({
        id: `asset-${code.toLowerCase()}`,
        code,
        symbol: code,
        decimals: code === 'BTC' ? 8 : 18,
        chain: code === 'BTC' ? 'BITCOIN' : code === 'SOL' ? 'SOLANA' : 'TRON',
        standard: 'NATIVE',
      })),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      findByOwnerAsset: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockImplementation(async (_id, data) => ({ ...created, ...data })),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      { validateAddress: jest.fn(), createAddress: jest.fn(), listChains: jest.fn() } as never,
    );
    const payloads = [
      { assetCode: 'BTC', address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx' },
      { assetCode: 'SOL', address: '7EqQdEULxWcraVx1VfyQW9XbnAHKKfwdERJXNqTUHxN' },
      { assetCode: 'TRX', address: 'TXYZrestoredTronAddress11111111111' },
    ];
    for (const payload of payloads) {
      const saved = await engine.importPublicAddress(
        { ownerUserId: userId, ...payload, networkEnv: 'testnet', selfCustody: true },
        requester(),
      );
      expect(JSON.stringify(saved)).not.toMatch(/mnemonic|privateKey|seed/i);
    }
    expect(walletService.createWallet).toHaveBeenCalledTimes(3);
  });

  it('re-import of the same owner and asset updates metadata instead of creating a duplicate', async () => {
    const existing = { ...baseWallet, metadata: { imported: true }, preferences: { accounts: [] } };
    const walletService = {
      createWallet: jest.fn(),
      getWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      findAssetByCode: jest.fn().mockResolvedValue({
        id: 'asset-eth',
        code: 'ETH',
        symbol: 'ETH',
        decimals: 18,
        chain: 'ETHEREUM',
        standard: 'NATIVE',
      }),
      findByOwnerAssetAlias: jest.fn().mockResolvedValue(null),
      findByOwnerAsset: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(async (_id, data) => ({ ...existing, ...data })),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      { validateAddress: jest.fn(), createAddress: jest.fn(), listChains: jest.fn() } as never,
    );
    const addr = '0x' + 'c'.repeat(40);
    await engine.importPublicAddress(
      {
        ownerUserId: userId,
        assetCode: 'ETH',
        address: addr,
        networkEnv: 'testnet',
        selfCustody: true,
      },
      requester(),
    );
    expect(walletService.createWallet).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('exports public metadata without private keys', async () => {
    const walletService = {
      createWallet: jest.fn(),
      getWallet: jest.fn().mockResolvedValue(baseWallet),
      restore: jest.fn(),
    };
    const engine = new WalletEngineService(
      walletService as never,
      {} as never,
      { listChains: jest.fn().mockResolvedValue([]) } as never,
    );
    const exported = await engine.exportWallet(walletId, requester());
    expect(exported.containsPrivateKeys).toBe(false);
    expect(exported.chainSync.exportPolicy).toBe('public_metadata_only');
    expect(exported).not.toHaveProperty('privateKey');
    expect(exported).not.toHaveProperty('mnemonic');
  });

  it('switches network and account index in preferences', async () => {
    const walletService = {
      getWallet: jest.fn().mockResolvedValue(baseWallet),
      createWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      update: jest.fn().mockImplementation(async (_id, data) => ({
        ...baseWallet,
        preferences: data.preferences,
      })),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      {
        listChains: jest.fn(),
      } as never,
    );

    const switched = await engine.switchNetwork(walletId, 'BNB_SMART_CHAIN', requester());
    expect((switched.preferences as { activeNetwork?: string }).activeNetwork).toBe(
      'BNB_SMART_CHAIN',
    );

    const account = await engine.switchAccount(walletId, 1, requester());
    expect((account.preferences as { activeAccountIndex?: number }).activeAccountIndex).toBe(1);
  });

  it('discovers HD account indexes', async () => {
    const walletService = {
      getWallet: jest.fn().mockResolvedValue(baseWallet),
      createWallet: jest.fn(),
      restore: jest.fn(),
    };
    const repo = {
      update: jest.fn().mockResolvedValue(baseWallet),
    };
    const engine = new WalletEngineService(
      walletService as never,
      repo as never,
      {
        listChains: jest.fn(),
      } as never,
    );
    const accounts = await engine.discoverAccounts(walletId, requester(), 3);
    expect(accounts).toHaveLength(3);
    expect(accounts[0]?.derivationPath).toContain("44'");
  });
});

describe('PortfolioEngineService', () => {
  it('aggregates ledger and chain balances by network and token', async () => {
    const wallets = {
      listByOwner: jest.fn().mockResolvedValue({ items: [baseWallet], total: 1 }),
      findById: jest.fn().mockResolvedValue(baseWallet),
    };
    const ledger = {
      getBalance: jest.fn().mockResolvedValue({
        total: '1.5',
        available: '1.5',
        pending: '0',
        locked: '0',
        reserved: '0',
      }),
    };
    const portfolio = new PortfolioEngineService(wallets as never, ledger as never);
    const snap = await portfolio.getPortfolioForUser(userId, requester());
    expect(snap.walletCount).toBe(1);
    expect(snap.networkTotals[0]?.chain).toBe('ETHEREUM');
    expect(snap.tokenTotals[0]?.assetCode).toBe('ETH');
    expect(snap.wallets[0]?.chainBalance).toBeNull();
    expect(snap.portfolioLedgerTotal).toBe('1.50000000');
  });
});

describe('WalletSyncService + retry', () => {
  it('syncs balance and enqueues retries on failure', async () => {
    const queue = new WalletRetryQueue();
    const repo = {
      update: jest.fn().mockResolvedValue(baseWallet),
      listActiveForSync: jest.fn().mockResolvedValue([baseWallet]),
      findById: jest.fn().mockResolvedValue(baseWallet),
    };
    const ledger = { createSnapshot: jest.fn().mockResolvedValue({}) };
    const blockchain = {
      getBalance: jest.fn().mockResolvedValue({
        chain: 'ETHEREUM',
        address: '0x' + 'a'.repeat(40),
        balance: '2.0',
      }),
      getNetworkStatus: jest.fn().mockResolvedValue({
        chain: 'ETHEREUM',
        blockHeight: '100',
        healthy: true,
        latencyMs: 12,
      }),
      triggerSync: jest.fn().mockResolvedValue({ id: 'job-1', chain: 'ETHEREUM' }),
    };
    const sync = new WalletSyncService(repo as never, ledger as never, blockchain as never, queue);
    const ok = await sync.syncWallet(baseWallet as never);
    expect(ok.ok).toBe(true);
    expect(ok.balance).toBe('2.0');

    blockchain.getBalance.mockRejectedValueOnce(new Error('timeout'));
    const fail = await sync.syncWallet(baseWallet as never);
    expect(fail.ok).toBe(false);
    expect(queue.size()).toBe(1);

    const tx = await sync.syncTransactionsBatch(10);
    expect(tx.processed).toBeGreaterThanOrEqual(1);
  });

  it('detects balance conflicts', () => {
    const sync = new WalletSyncService(
      {} as never,
      {} as never,
      {} as never,
      new WalletRetryQueue(),
    );
    expect(sync.detectConflict('1', '100')).toBe(true);
    expect(sync.detectConflict('1', '1.1')).toBe(false);
  });
});
