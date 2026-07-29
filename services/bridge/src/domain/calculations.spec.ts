import { ChainNetwork } from '@auvora/database';
import { compareQuotesByOutput, compareRoutesByFee, isSameNetworkRoute } from './calculations';
import type { BridgeProviderQuote, BridgeRoute } from './bridge-provider.port';

describe('bridge calculations', () => {
  it('prefers higher amountOut', () => {
    const a = { amountOut: '9', estimatedCompletionSeconds: 100 } as BridgeProviderQuote;
    const b = { amountOut: '10', estimatedCompletionSeconds: 200 } as BridgeProviderQuote;
    expect(compareQuotesByOutput(a, b)).toBeGreaterThan(0);
  });

  it('prefers supported cheaper routes', () => {
    const a = {
      supported: true,
      estimatedFeeNative: '0.002',
      estimatedCompletionSeconds: 120,
    } as BridgeRoute;
    const b = {
      supported: true,
      estimatedFeeNative: '0.001',
      estimatedCompletionSeconds: 120,
    } as BridgeRoute;
    expect(compareRoutesByFee(a, b)).toBeGreaterThan(0);
  });

  it('detects same network', () => {
    expect(isSameNetworkRoute(ChainNetwork.ETHEREUM, ChainNetwork.ETHEREUM)).toBe(true);
    expect(isSameNetworkRoute(ChainNetwork.ETHEREUM, ChainNetwork.SOLANA)).toBe(false);
  });
});
