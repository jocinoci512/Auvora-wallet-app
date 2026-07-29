import { ChainNetwork } from '@auvora/database';
import { LayerZeroStyleProvider } from './layerzero-style.provider';
import { SimulatorBridgeProvider } from './simulator-bridge.provider';

describe('bridge failure recovery', () => {
  const sim = new SimulatorBridgeProvider();
  const lz = new LayerZeroStyleProvider(sim);

  it('rejects tron on layerzero-style provider', async () => {
    await expect(
      lz.getQuote({
        sourceNetwork: ChainNetwork.ETHEREUM,
        destinationNetwork: ChainNetwork.TRON,
        assetSymbol: 'USDC',
        amount: '1',
      }),
    ).rejects.toMatchObject({ code: 'BRIDGE_UNSUPPORTED_ROUTE' });
  });

  it('rejects bitcoin quotes with architecture stub', async () => {
    await expect(
      sim.getQuote({
        sourceNetwork: ChainNetwork.BITCOIN,
        destinationNetwork: ChainNetwork.ETHEREUM,
        assetSymbol: 'BTC',
        amount: '0.1',
      }),
    ).rejects.toMatchObject({ code: 'BRIDGE_UNSUPPORTED_ROUTE' });
  });
});
