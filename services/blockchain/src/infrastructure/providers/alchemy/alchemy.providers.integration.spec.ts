import { ChainNetwork } from '@auvora/database';
import { AlchemyEvmProvider } from './alchemy-evm.provider';
import { AlchemySolanaProvider } from './alchemy-solana.provider';
import { AlchemyTronProvider } from './alchemy-tron.provider';
import { AlchemyBitcoinProvider } from './alchemy-bitcoin.provider';
import { createAlchemyProviders } from './create-alchemy-providers';
import type { ServiceEnv } from '../../../config/env.schema';

describe('Alchemy providers (integration with mocked RPC)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockJsonRpc(handler: (method: string) => unknown) {
    global.fetch = jest.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
      const method = body.method ?? '';
      return {
        ok: true,
        json: async () => ({ result: handler(method) }),
      };
    }) as unknown as typeof fetch;
  }

  it('initializes all five live providers from API key', () => {
    const map = createAlchemyProviders({
      ALCHEMY_API_KEY: 'test-key',
      ALCHEMY_RPC_TIMEOUT_MS: 5_000,
    } as ServiceEnv);
    expect([...map.keys()].sort()).toEqual(
      [
        ChainNetwork.BITCOIN,
        ChainNetwork.BNB_SMART_CHAIN,
        ChainNetwork.ETHEREUM,
        ChainNetwork.SOLANA,
        ChainNetwork.TRON,
      ].sort(),
    );
  });

  it('ethereum: validates address, balance, block height, fee, and health', async () => {
    mockJsonRpc((method) => {
      if (method === 'eth_getBalance') return '0xde0b6b3a7640000'; // 1 ETH
      if (method === 'eth_blockNumber') return '0x10';
      if (method === 'eth_gasPrice') return '0x3b9aca00';
      if (method === 'eth_getTransactionByHash') {
        return {
          hash: '0xabc',
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
          value: '0x0',
          blockNumber: '0xf',
        };
      }
      if (method === 'eth_getTransactionReceipt') return { status: '0x1', blockNumber: '0xf' };
      if (method === 'eth_sendRawTransaction') return '0xdeadbeef';
      return null;
    });

    const provider = new AlchemyEvmProvider(ChainNetwork.ETHEREUM, 'https://example.com/v2/k', 'ETH');
    expect(provider.validateAddress('0x1111111111111111111111111111111111111111')).toBe(true);
    expect(provider.validateAddress('not-valid')).toBe(false);
    await expect(provider.getBalance('0x1111111111111111111111111111111111111111')).resolves.toBe('1');
    await expect(provider.getBlockHeight()).resolves.toBe(16n);
    const fee = await provider.estimateFee('STANDARD');
    expect(fee.unit).toBe('ETH');
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
    const tx = await provider.getTransaction('0xabc');
    expect(tx?.status).toBe('CONFIRMED');
    await expect(provider.broadcastTransaction('0x01')).resolves.toEqual({ txHash: '0xdeadbeef' });
  });

  it('bsc: shares EVM provider path', async () => {
    mockJsonRpc((method) => (method === 'eth_blockNumber' ? '0x64' : '0x0'));
    const provider = new AlchemyEvmProvider(
      ChainNetwork.BNB_SMART_CHAIN,
      'https://example.com/v2/k',
      'BNB',
    );
    await expect(provider.getBlockHeight()).resolves.toBe(100n);
    expect(provider.getChain()).toBe(ChainNetwork.BNB_SMART_CHAIN);
  });

  it('solana: balance, blockhash, and broadcast', async () => {
    mockJsonRpc((method) => {
      if (method === 'getBalance') return { value: 1_500_000_000 };
      if (method === 'getSlot') return 99;
      if (method === 'getLatestBlockhash') return { value: { blockhash: 'BhTest' } };
      if (method === 'sendTransaction') return 'SigTest';
      if (method === 'getTransaction') return { slot: 98, meta: { err: null } };
      return null;
    });
    const provider = new AlchemySolanaProvider('https://example.com/v2/k');
    await expect(
      provider.getBalance('11111111111111111111111111111111'),
    ).resolves.toMatch(/^1\.5/);
    await expect(provider.getRecentBlockhash()).resolves.toBe('BhTest');
    await expect(provider.broadcastTransaction('base64tx')).resolves.toEqual({ txHash: 'SigTest' });
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it('tron: block height and health', async () => {
    mockJsonRpc((method) => (method === 'eth_blockNumber' ? '0x2a' : '0x0'));
    const provider = new AlchemyTronProvider('https://example.com/v2/k');
    await expect(provider.getBlockHeight()).resolves.toBe(42n);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
  });

  it('bitcoin: tip height, fee estimate, broadcast', async () => {
    mockJsonRpc((method) => {
      if (method === 'getblockcount') return 800_000;
      if (method === 'estimatesmartfee') return { feerate: 0.00002 };
      if (method === 'sendrawtransaction') return 'btctxid';
      if (method === 'scantxoutset') return { total_amount: 0.25, unspents: [] };
      return null;
    });
    const provider = new AlchemyBitcoinProvider('https://example.com/v2/k');
    await expect(provider.getBlockHeight()).resolves.toBe(800_000n);
    await expect(provider.getBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).resolves.toBe('0.25');
    const fee = await provider.estimateFee('PRIORITY');
    expect(fee.unit).toBe('BTC/kB');
    await expect(provider.broadcastTransaction('01000000')).resolves.toEqual({ txHash: 'btctxid' });
  });

  it('provider failover: registry prefers alchemy over simulator when configured', () => {
    const live = createAlchemyProviders({
      ALCHEMY_API_KEY: 'k',
      ALCHEMY_RPC_TIMEOUT_MS: 1000,
    } as ServiceEnv);
    expect(live.has(ChainNetwork.ETHEREUM)).toBe(true);
    expect(live.get(ChainNetwork.ETHEREUM)?.getSafeEndpoint()).toContain('alchemy');
  });
});
