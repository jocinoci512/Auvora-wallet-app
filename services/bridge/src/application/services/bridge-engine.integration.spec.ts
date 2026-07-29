import { ChainNetwork } from '@auvora/database';
import { BridgeProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { LayerZeroStyleProvider } from '../../infrastructure/providers/layerzero-style.provider';
import { SimulatorBridgeProvider } from '../../infrastructure/providers/simulator-bridge.provider';
import { WormholeStyleProvider } from '../../infrastructure/providers/wormhole-style.provider';

describe('bridge provider integration', () => {
  const env = { BRIDGE_SIMULATOR_ENABLED: true, BRIDGE_PROVIDER_TIMEOUT_MS: 5000 } as never;
  const simulator = new SimulatorBridgeProvider();
  const registry = new BridgeProviderRegistry(
    env,
    simulator,
    new LayerZeroStyleProvider(simulator),
    new WormholeStyleProvider(simulator),
  );

  it('lists routes including bitcoin unsupported stub', async () => {
    const routes = await registry.listRoutes();
    expect(routes.some((r) => r.sourceNetwork === ChainNetwork.BITCOIN && !r.supported)).toBe(true);
    expect(routes.some((r) => r.supported)).toBe(true);
  });

  it('quotes ethereum to bsc via best provider', async () => {
    const quote = await registry.getQuote({
      sourceNetwork: ChainNetwork.ETHEREUM,
      destinationNetwork: ChainNetwork.BNB_SMART_CHAIN,
      assetSymbol: 'USDC',
      amount: '10',
    });
    expect(Number(quote.amountOut)).toBeGreaterThan(0);
    expect(quote.simulationOk).toBe(true);
  });

  it('prepares and executes a bridge transfer', async () => {
    const quote = await registry.getQuote({
      sourceNetwork: ChainNetwork.ETHEREUM,
      destinationNetwork: ChainNetwork.SOLANA,
      assetSymbol: 'USDC',
      amount: '5',
    });
    const prepared = await registry.prepareTransfer({
      sourceNetwork: ChainNetwork.ETHEREUM,
      destinationNetwork: ChainNetwork.SOLANA,
      assetSymbol: 'USDC',
      amount: '5',
      providerQuoteId: quote.providerQuoteId,
    });
    expect(prepared.simulationOk).toBe(true);
    const executed = await registry.executeTransfer(quote.providerQuoteId);
    expect(['BRIDGING', 'COMPLETED', 'SUBMITTED']).toContain(executed.status);
  });

  it('health checks registry with graceful degradation', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
