import { ChainNetwork } from '@auvora/database';
import { SimulatorBridgeProvider } from './simulator-bridge.provider';

describe('SimulatorBridgeProvider', () => {
  const provider = new SimulatorBridgeProvider();

  it('exposes bitcoin as unsupported', () => {
    const networks = provider.getSupportedNetworks();
    expect(networks.find((n) => n.network === ChainNetwork.BITCOIN)?.bridgeSupported).toBe(false);
  });

  it('rejects same-network quotes', async () => {
    await expect(
      provider.getQuote({
        sourceNetwork: ChainNetwork.ETHEREUM,
        destinationNetwork: ChainNetwork.ETHEREUM,
        assetSymbol: 'USDC',
        amount: '1',
      }),
    ).rejects.toMatchObject({ code: 'BRIDGE_VALIDATION' });
  });

  it('quotes a supported route', async () => {
    const quote = await provider.getQuote({
      sourceNetwork: ChainNetwork.ETHEREUM,
      destinationNetwork: ChainNetwork.BNB_SMART_CHAIN,
      assetSymbol: 'USDC',
      amount: '2',
    });
    expect(quote.amountOut).toBeTruthy();
    expect(quote.replayNonce).toHaveLength(32);
  });
});
