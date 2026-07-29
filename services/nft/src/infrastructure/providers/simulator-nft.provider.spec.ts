import { ChainNetwork } from '@auvora/database';
import { SimulatorNftProvider } from './simulator-nft.provider';

describe('SimulatorNftProvider', () => {
  const provider = new SimulatorNftProvider();

  it('discovers ethereum owner assets', async () => {
    const result = await provider.discoverByOwner({
      network: ChainNetwork.ETHEREUM,
      ownerAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.network === ChainNetwork.ETHEREUM)).toBe(true);
  });

  it('verifies ownership', async () => {
    await expect(
      provider.verifyOwnership(
        ChainNetwork.ETHEREUM,
        '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
        '1',
        '0x1111111111111111111111111111111111111111',
      ),
    ).resolves.toBe(true);
  });

  it('rejects bitcoin discovery', async () => {
    await expect(
      provider.discoverByOwner({
        network: ChainNetwork.BITCOIN,
        ownerAddress: 'bc1qexample',
      }),
    ).rejects.toThrow(/Bitcoin|Ordinals/i);
  });
});
