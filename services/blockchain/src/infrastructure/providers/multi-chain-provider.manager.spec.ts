import { MultiChainProviderManager } from './multi-chain-provider.manager';
import { ChainNetwork } from '@auvora/database';

describe('MultiChainProviderManager', () => {
  it('selects providers by chain alias and lists backends', () => {
    const eth = {
      getChain: () => ChainNetwork.ETHEREUM,
      getRpcMetrics: () => ({}),
      getSafeEndpoint: () => 'https://eth-mainnet.g.alchemy.com/v2/[REDACTED]',
    };
    const sol = {
      getChain: () => ChainNetwork.SOLANA,
    };
    const registry = new Map([
      [ChainNetwork.ETHEREUM, eth],
      [ChainNetwork.SOLANA, sol],
    ]);
    const factory = {
      getProvider: (chain: ChainNetwork) => {
        const p = registry.get(chain);
        if (!p) throw new Error('missing');
        return p;
      },
      getSupportedChains: () => [...registry.keys()],
      hasProvider: (chain: ChainNetwork) => registry.has(chain),
    };
    const manager = new MultiChainProviderManager(
      {
        BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
        BLOCKCHAIN_SIMULATOR_ENABLED: false,
        ALCHEMY_API_KEY: 'test',
      } as never,
      factory as never,
      registry as never,
    );

    expect(manager.getProvider('ETH').getChain()).toBe(ChainNetwork.ETHEREUM);
    expect(manager.switchNetwork('solana').getChain()).toBe(ChainNetwork.SOLANA);
    expect(manager.isAlchemyActiveFor(ChainNetwork.ETHEREUM)).toBe(true);
    expect(manager.isAlchemyActiveFor(ChainNetwork.SOLANA)).toBe(false);
    const listed = manager.listProviders();
    expect(listed.find((x) => x.chain === ChainNetwork.ETHEREUM)?.backend).toBe('alchemy');
  });
});
