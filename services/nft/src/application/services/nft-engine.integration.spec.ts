import { ChainNetwork } from '@auvora/database';
import { SimulatorNftProvider } from '../../infrastructure/providers/simulator-nft.provider';
import { AlchemyNftStyleProvider } from '../../infrastructure/providers/alchemy-nft-style.provider';
import { HeliusStyleProvider } from '../../infrastructure/providers/helius-style.provider';
import { NftProviderRegistry } from '../../infrastructure/providers/provider-registry';

describe('nft provider integration', () => {
  const env = {
    NFT_SIMULATOR_ENABLED: true,
    NFT_PROVIDER_TIMEOUT_MS: 5000,
    NFT_PROVIDER_MAX_RETRIES: 1,
  } as never;
  const simulator = new SimulatorNftProvider();
  const registry = new NftProviderRegistry(
    env,
    simulator,
    new AlchemyNftStyleProvider(simulator),
    new HeliusStyleProvider(simulator),
  );

  it('discovers across providers for ethereum', async () => {
    const result = await registry.discoverByOwner({
      network: ChainNetwork.ETHEREUM,
      ownerAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('lists networks including bitcoin stub', () => {
    const nets = registry.getSupportedNetworks();
    expect(nets.some((n) => n.network === ChainNetwork.BITCOIN && !n.nftSupported)).toBe(true);
    expect(nets.some((n) => n.network === ChainNetwork.ETHEREUM && n.nftSupported)).toBe(true);
  });

  it('lists solana collections via helius path', async () => {
    const collections = await registry.listCollections(ChainNetwork.SOLANA);
    expect(collections.length).toBeGreaterThan(0);
  });

  it('health checks registry', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
