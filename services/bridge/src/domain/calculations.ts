import type { BridgeProviderQuote, BridgeRoute } from './bridge-provider.port';

export function compareQuotesByOutput(a: BridgeProviderQuote, b: BridgeProviderQuote): number {
  const ao = Number(a.amountOut);
  const bo = Number(b.amountOut);
  if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return bo - ao;
  return a.estimatedCompletionSeconds - b.estimatedCompletionSeconds;
}

export function compareRoutesByFee(a: BridgeRoute, b: BridgeRoute): number {
  if (a.supported !== b.supported) return a.supported ? -1 : 1;
  const af = Number(a.estimatedFeeNative);
  const bf = Number(b.estimatedFeeNative);
  if (Number.isFinite(af) && Number.isFinite(bf) && af !== bf) return af - bf;
  return a.estimatedCompletionSeconds - b.estimatedCompletionSeconds;
}

export function isSameNetworkRoute(source: string, destination: string): boolean {
  return source === destination;
}
