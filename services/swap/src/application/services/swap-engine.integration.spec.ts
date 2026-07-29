import { ChainNetwork } from '@auvora/database';
import { applySlippage } from '../../domain/calculations';
import { SimulatorSwapProvider } from '../../infrastructure/providers/simulator-swap.provider';
import { ZeroExStyleProvider } from '../../infrastructure/providers/zeroex-style.provider';
import { JupiterStyleProvider } from '../../infrastructure/providers/jupiter-style.provider';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';

describe('swap provider integration', () => {
  const env = {
    SWAP_SIMULATOR_ENABLED: true,
    SWAP_PROVIDER_TIMEOUT_MS: 5000,
    SWAP_PROVIDER_MAX_RETRIES: 1,
  } as never;
  const simulator = new SimulatorSwapProvider();
  const registry = new SwapProviderRegistry(
    env,
    simulator,
    new ZeroExStyleProvider(simulator),
    new JupiterStyleProvider(simulator),
  );

  it('selects a best quote across providers for ethereum', async () => {
    const quote = await registry.getQuote({
      network: ChainNetwork.ETHEREUM,
      sellToken: 'ETH',
      buyToken: 'USDC',
      sellAmount: '0.5',
      slippageBps: 50,
    });
    expect(quote.providerCode).toBeTruthy();
    expect(Number(quote.amountOut)).toBeGreaterThan(0);
    expect(applySlippage(quote.amountOut, 50)).toBe(quote.minAmountOut);
  });

  it('lists networks including bitcoin stub', () => {
    const nets = registry.getSupportedNetworks();
    expect(nets.some((n) => n.network === ChainNetwork.BITCOIN && !n.swapSupported)).toBe(true);
    expect(nets.some((n) => n.network === ChainNetwork.ETHEREUM && n.swapSupported)).toBe(true);
  });

  it('health checks registry', async () => {
    await expect(registry.healthCheck()).resolves.toMatchObject({ healthy: true });
  });
});
