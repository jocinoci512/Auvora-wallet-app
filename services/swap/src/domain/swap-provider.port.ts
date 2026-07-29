import type { ChainNetwork } from '@auvora/database';

export type SwapNetworkCapability = {
  network: ChainNetwork;
  swapSupported: boolean;
  reason?: string;
};

export type SwapAssetRef = {
  symbol: string;
  network: ChainNetwork;
  contractAddress: string;
  decimals: number;
  standard: 'NATIVE' | 'ERC20' | 'BEP20' | 'SPL' | 'TRC20' | 'OTHER';
  verified: boolean;
  name: string;
};

export type SwapQuoteRequest = {
  network: ChainNetwork;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  slippageBps?: number;
  userAddress?: string;
  sellContractAddress?: string;
  buyContractAddress?: string;
};

export type SwapProviderRoute = {
  providerCode: string;
  routeId: string;
  hops: Array<{ venue: string; from: string; to: string; portionBps: number }>;
  amountOut: string;
  priceImpactBps: number;
  estimatedGas: string;
  estimatedFeeNative: string;
  estimatedCompletionSeconds: number;
};

export type SwapProviderQuote = {
  providerCode: string;
  providerQuoteId: string;
  network: ChainNetwork;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  amountOut: string;
  minAmountOut: string;
  priceImpactBps: number;
  estimatedGas: string;
  estimatedFeeNative: string;
  feeAmount: string;
  feeAsset: string;
  routeSummary: string;
  route: SwapProviderRoute;
  expiresAt: string;
  supportsSimulation: boolean;
  raw?: Record<string, unknown>;
};

export type PreparedSwapTx = {
  providerCode: string;
  providerQuoteId: string;
  network: ChainNetwork;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  simulationOk: boolean;
  simulationDetail?: string;
  nonceHint?: string;
};

export type SwapExecutionStatus = {
  providerRef: string;
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMING' | 'COMPLETED' | 'FAILED';
  txHash?: string;
  confirmations?: number;
  errorMessage?: string;
  amountOutActual?: string;
};

export const SWAP_PROVIDER = Symbol('SWAP_PROVIDER');

export interface SwapProviderPort {
  readonly code: string;
  readonly name: string;
  getSupportedNetworks(): SwapNetworkCapability[];
  getSupportedAssets(network: ChainNetwork): Promise<SwapAssetRef[]>;
  getQuote(request: SwapQuoteRequest): Promise<SwapProviderQuote>;
  getRoutes(request: SwapQuoteRequest): Promise<SwapProviderRoute[]>;
  buildTransaction(
    request: SwapQuoteRequest & { providerQuoteId: string },
  ): Promise<PreparedSwapTx>;
  getExecutionStatus(providerRef: string): Promise<SwapExecutionStatus>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; detail?: string }>;
}
