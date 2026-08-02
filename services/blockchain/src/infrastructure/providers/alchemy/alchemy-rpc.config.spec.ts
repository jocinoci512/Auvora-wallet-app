import { ChainNetwork } from '@auvora/database';
import { isAlchemyConfigured, redactRpcUrl, resolveAlchemyRpcUrls } from './alchemy-rpc.config';
import type { ServiceEnv } from '../../../config/env.schema';

function env(partial: Partial<ServiceEnv>): ServiceEnv {
  return partial as ServiceEnv;
}

describe('alchemy-rpc.config', () => {
  it('builds all chain URLs from ALCHEMY_API_KEY', () => {
    const urls = resolveAlchemyRpcUrls(env({ ALCHEMY_API_KEY: 'test-key-123' }));
    expect(urls.size).toBe(6);
    expect(urls.get(ChainNetwork.ETHEREUM)).toBe(
      'https://eth-mainnet.g.alchemy.com/v2/test-key-123',
    );
    expect(urls.get(ChainNetwork.POLYGON)).toContain('polygon-mainnet');
    expect(urls.get(ChainNetwork.BNB_SMART_CHAIN)).toContain('bnb-mainnet');
    expect(urls.get(ChainNetwork.SOLANA)).toContain('solana-mainnet');
    expect(urls.get(ChainNetwork.TRON)).toContain('tron-mainnet');
    expect(urls.get(ChainNetwork.BITCOIN)).toContain('bitcoin-mainnet');
  });

  it('prefers explicit RPC URLs over API key defaults', () => {
    const urls = resolveAlchemyRpcUrls(
      env({
        ALCHEMY_API_KEY: 'test-key-123',
        ALCHEMY_ETHEREUM_RPC_URL: 'https://custom.example/eth',
        ALCHEMY_BSC_RPC_URL: 'https://custom.example/bsc',
      }),
    );
    expect(urls.get(ChainNetwork.ETHEREUM)).toBe('https://custom.example/eth');
    expect(urls.get(ChainNetwork.BNB_SMART_CHAIN)).toBe('https://custom.example/bsc');
    expect(urls.get(ChainNetwork.SOLANA)).toContain('test-key-123');
  });

  it('reports not configured when no key or URLs', () => {
    expect(isAlchemyConfigured(env({}))).toBe(false);
  });

  it('redacts API key path segments', () => {
    expect(redactRpcUrl('https://eth-mainnet.g.alchemy.com/v2/super-secret')).toBe(
      'https://eth-mainnet.g.alchemy.com/v2/[REDACTED]',
    );
  });
});
