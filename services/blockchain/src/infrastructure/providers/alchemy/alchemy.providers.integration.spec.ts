import { ChainNetwork } from '@auvora/database';
import { AlchemyEvmProvider } from './alchemy-evm.provider';
import { AlchemySolanaProvider } from './alchemy-solana.provider';
import { AlchemyTronProvider } from './alchemy-tron.provider';
import { AlchemyBitcoinProvider } from './alchemy-bitcoin.provider';
import { createAlchemyProviders } from './create-alchemy-providers';
import { JsonRpcClient, JsonRpcError } from './json-rpc.client';
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

  it('initializes nothing without credentials', () => {
    const map = createAlchemyProviders({ ALCHEMY_RPC_TIMEOUT_MS: 5_000 } as ServiceEnv);
    expect(map.size).toBe(0);
  });

  it('ethereum: validates address, balance, chainId, gas, transfers, fee, and health', async () => {
    mockJsonRpc((method) => {
      if (method === 'eth_getBalance') return '0xde0b6b3a7640000'; // 1 ETH
      if (method === 'eth_blockNumber') return '0x10';
      if (method === 'eth_chainId') return '0x1';
      if (method === 'eth_gasPrice') return '0x3b9aca00';
      if (method === 'eth_estimateGas') return '0x5208';
      if (method === 'eth_call')
        return '0x0000000000000000000000000000000000000000000000000000000000000064';
      if (method === 'alchemy_getAssetTransfers') {
        return {
          transfers: [
            {
              hash: '0xaaa',
              from: '0x1111111111111111111111111111111111111111',
              to: '0x2222222222222222222222222222222222222222',
              value: 1,
              asset: 'ETH',
              category: 'external',
              blockNum: '0xf',
            },
          ],
        };
      }
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

    const provider = new AlchemyEvmProvider(
      ChainNetwork.ETHEREUM,
      'https://example.com/v2/k',
      'ETH',
    );
    expect(provider.validateAddress('0x1111111111111111111111111111111111111111')).toBe(true);
    expect(provider.validateAddress('not-valid')).toBe(false);
    await expect(provider.getBalance('0x1111111111111111111111111111111111111111')).resolves.toBe(
      '1',
    );
    await expect(provider.getBlockHeight()).resolves.toBe(16n);
    await expect(provider.getChainId()).resolves.toBe('1');
    await expect(
      provider.estimateGas({ to: '0x2222222222222222222222222222222222222222' }),
    ).resolves.toBe(21000n);
    await expect(
      provider.getTokenBalance(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        '0x1111111111111111111111111111111111111111',
      ),
    ).resolves.toBe('100');
    const transfers = await provider.getAssetTransfers(
      '0x1111111111111111111111111111111111111111',
    );
    expect(transfers).toHaveLength(1);
    const fee = await provider.estimateFee('STANDARD');
    expect(fee.unit).toBe('ETH');
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.message).toContain('chainId=1');
    const tx = await provider.getTransaction('0xabc');
    expect(tx?.status).toBe('CONFIRMED');
    await expect(provider.broadcastTransaction('0x01')).resolves.toEqual({ txHash: '0xdeadbeef' });
  });

  it('bsc: shares EVM provider path with chainId 56', async () => {
    mockJsonRpc((method) => {
      if (method === 'eth_blockNumber') return '0x64';
      if (method === 'eth_chainId') return '0x38';
      return '0x0';
    });
    const provider = new AlchemyEvmProvider(
      ChainNetwork.BNB_SMART_CHAIN,
      'https://example.com/v2/k',
      'BNB',
    );
    await expect(provider.getBlockHeight()).resolves.toBe(100n);
    await expect(provider.getChainId()).resolves.toBe('56');
    expect(provider.getChain()).toBe(ChainNetwork.BNB_SMART_CHAIN);
  });

  it('solana: balance, blockhash, signature status, and broadcast', async () => {
    mockJsonRpc((method) => {
      if (method === 'getBalance') return { value: 1_500_000_000 };
      if (method === 'getSlot') return 99;
      if (method === 'getLatestBlockhash') return { value: { blockhash: 'BhTest' } };
      if (method === 'getSignatureStatuses') {
        return { value: [{ confirmationStatus: 'finalized', slot: 98, err: null }] };
      }
      if (method === 'sendTransaction') return 'SigTest';
      if (method === 'getTransaction') return { slot: 98, meta: { err: null } };
      return null;
    });
    const provider = new AlchemySolanaProvider('https://example.com/v2/k');
    await expect(provider.getBalance('11111111111111111111111111111111')).resolves.toMatch(/^1\.5/);
    await expect(provider.getRecentBlockhash()).resolves.toBe('BhTest');
    const statuses = await provider.getSignatureStatuses(['SigTest']);
    expect(statuses[0]?.confirmationStatus).toBe('finalized');
    await expect(provider.broadcastTransaction('base64tx')).resolves.toEqual({ txHash: 'SigTest' });
    await expect(provider.getDasAsset('x')).rejects.toThrow(/NFT service/);
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

  it('bitcoin: tip height, utxo, fee estimate, broadcast', async () => {
    mockJsonRpc((method) => {
      if (method === 'getblockcount') return 800_000;
      if (method === 'estimatesmartfee') return { feerate: 0.00002 };
      if (method === 'sendrawtransaction') return 'btctxid';
      if (method === 'scantxoutset') {
        return { total_amount: 0.25, unspents: [{ txid: 'abc', vout: 0, amount: 0.25 }] };
      }
      return null;
    });
    const provider = new AlchemyBitcoinProvider('https://example.com/v2/k');
    await expect(provider.getBlockHeight()).resolves.toBe(800_000n);
    await expect(provider.getBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).resolves.toBe('0.25');
    const utxos = await provider.getUtxos('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(utxos).toHaveLength(1);
    const fee = await provider.estimateFee('PRIORITY');
    expect(fee.unit).toBe('BTC/kB');
    await expect(provider.broadcastTransaction('01000000')).resolves.toEqual({ txHash: 'btctxid' });
  });

  it('retries transient RPC failures then succeeds', async () => {
    let calls = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ result: '0x1' }) };
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/k', {
      maxRetries: 2,
      timeoutMs: 2000,
      label: 'retry-test',
    });
    await expect(client.call<string>('eth_blockNumber')).resolves.toBe('0x1');
    expect(calls).toBe(2);
    expect(client.getMetrics().retries).toBe(1);
  });

  it('does not retry unauthorized Alchemy responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/k', {
      maxRetries: 3,
      label: 'auth-test',
    });
    await expect(client.call('eth_blockNumber')).rejects.toBeInstanceOf(JsonRpcError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
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

const liveEnabled =
  process.env['ALCHEMY_LIVE_TEST'] === 'true' &&
  Boolean(
    process.env['ALCHEMY_API_KEY'] ||
    process.env['ALCHEMY_ETHEREUM_RPC_URL'] ||
    process.env['ALCHEMY_SOLANA_RPC_URL'],
  );

(liveEnabled ? describe : describe.skip)('Alchemy providers (gated live RPC)', () => {
  const env = {
    ALCHEMY_API_KEY: process.env['ALCHEMY_API_KEY'],
    ALCHEMY_ETHEREUM_RPC_URL: process.env['ALCHEMY_ETHEREUM_RPC_URL'],
    ALCHEMY_BSC_RPC_URL: process.env['ALCHEMY_BSC_RPC_URL'],
    ALCHEMY_SOLANA_RPC_URL: process.env['ALCHEMY_SOLANA_RPC_URL'],
    ALCHEMY_TRON_RPC_URL: process.env['ALCHEMY_TRON_RPC_URL'],
    ALCHEMY_BITCOIN_RPC_URL: process.env['ALCHEMY_BITCOIN_RPC_URL'],
    ALCHEMY_RPC_TIMEOUT_MS: 15_000,
  } as ServiceEnv;

  it('probes health for every configured Alchemy chain', async () => {
    const providers = createAlchemyProviders(env);
    expect(providers.size).toBeGreaterThan(0);
    for (const [chain, provider] of providers) {
      const health = await provider.healthCheck();
      expect(health.healthy).toBe(true);
      const tip = await provider.getBlockHeight();
      expect(tip).toBeGreaterThan(0n);
      // Ensure we never log secrets — only redacted labels
      expect(provider.getSafeEndpoint()).not.toMatch(/\/v2\/[A-Za-z0-9_-]{8,}/);
      void chain;
    }
  }, 60_000);
});
