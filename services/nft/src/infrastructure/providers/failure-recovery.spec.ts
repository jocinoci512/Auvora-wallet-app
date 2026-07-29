import { ChainNetwork } from '@auvora/database';
import { SimulatorNftProvider } from './simulator-nft.provider';

describe('NFT failure recovery', () => {
  const provider = new SimulatorNftProvider();

  it('returns null for unknown assets without throwing', async () => {
    await expect(provider.getAsset(ChainNetwork.ETHEREUM, '0xdead', '999999')).resolves.toBeNull();
  });

  it('refreshMetadata recovers from known catalog items', async () => {
    const discovered = await provider.discoverByOwner({
      network: ChainNetwork.ETHEREUM,
      ownerAddress: '0x1111111111111111111111111111111111111111',
    });
    const first = discovered.items[0];
    expect(first).toBeDefined();
    const refreshed = await provider.refreshMetadata(
      first.network,
      first.contractAddress,
      first.tokenId,
    );
    expect(refreshed?.name).toBeTruthy();
  });
});
