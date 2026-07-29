import type { ChainNetwork } from '@auvora/database';

export type BridgeNetworkCapability = {
  network: ChainNetwork;
  bridgeSupported: boolean;
  reason?: string;
};

export type BridgeAssetRef = {
  symbol: string;
  network: ChainNetwork;
  contractAddress: string;
  decimals: number;
  standard: 'NATIVE' | 'ERC20' | 'BEP20' | 'SPL' | 'TRC20' | 'OTHER';
  name: string;
};

export type BridgeQuoteRequest = {
  sourceNetwork: ChainNetwork;
  destinationNetwork: ChainNetwork;
  assetSymbol: string;
  amount: string;
  sourceAddress?: string;
  destinationAddress?: string;
  contractAddress?: string;
};

export type BridgeRoute = {
  providerCode: string;
  routeId: string;
  sourceNetwork: ChainNetwork;
  destinationNetwork: ChainNetwork;
  assetSymbol: string;
  supported: boolean;
  reason?: string;
  estimatedFeeNative: string;
  estimatedFeeUsd?: string;
  estimatedCompletionSeconds: number;
  hops: Array<{ chain: ChainNetwork; protocol: string }>;
};

export type BridgeProviderQuote = {
  providerCode: string;
  providerQuoteId: string;
  sourceNetwork: ChainNetwork;
  destinationNetwork: ChainNetwork;
  assetSymbol: string;
  amountIn: string;
  amountOut: string;
  minAmountOut: string;
  feeAmount: string;
  feeAsset: string;
  estimatedFeeNative: string;
  estimatedCompletionSeconds: number;
  routeSummary: string;
  route: BridgeRoute;
  expiresAt: string;
  simulationOk: boolean;
  replayNonce: string;
};

export type PreparedBridgeTx = {
  providerCode: string;
  providerQuoteId: string;
  sourceNetwork: ChainNetwork;
  to: string;
  data: string;
  value: string;
  simulationOk: boolean;
  simulationDetail?: string;
};

export type BridgeExecutionStatus = {
  providerRef: string;
  status: 'PENDING' | 'SUBMITTED' | 'BRIDGING' | 'COMPLETED' | 'FAILED';
  sourceTxHash?: string;
  destinationTxHash?: string;
  confirmations?: number;
  errorMessage?: string;
  amountOutActual?: string;
  completedAt?: string;
};

export const BRIDGE_PROVIDER = Symbol('BRIDGE_PROVIDER');

export interface BridgeProviderPort {
  readonly code: string;
  readonly name: string;
  readonly priority: number;
  getSupportedNetworks(): BridgeNetworkCapability[];
  listRoutes(): Promise<BridgeRoute[]>;
  getSupportedAssets(network: ChainNetwork): Promise<BridgeAssetRef[]>;
  getQuote(request: BridgeQuoteRequest): Promise<BridgeProviderQuote>;
  prepareTransfer(
    request: BridgeQuoteRequest & { providerQuoteId: string },
  ): Promise<PreparedBridgeTx>;
  executeTransfer(providerQuoteId: string): Promise<BridgeExecutionStatus>;
  getExecutionStatus(providerRef: string): Promise<BridgeExecutionStatus>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; detail?: string }>;
}
