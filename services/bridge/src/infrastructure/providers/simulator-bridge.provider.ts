import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { createHash, randomBytes } from 'node:crypto';
import {
  BridgeProviderError,
  BridgeUnsupportedRouteError,
  BridgeValidationError,
  type BridgeAssetRef,
  type BridgeExecutionStatus,
  type BridgeNetworkCapability,
  type BridgeProviderPort,
  type BridgeProviderQuote,
  type BridgeQuoteRequest,
  type BridgeRoute,
  type PreparedBridgeTx,
} from '../../domain';

const SUPPORTED_PAIRS: Array<[ChainNetwork, ChainNetwork]> = [
  [ChainNetwork.ETHEREUM, ChainNetwork.BNB_SMART_CHAIN],
  [ChainNetwork.BNB_SMART_CHAIN, ChainNetwork.ETHEREUM],
  [ChainNetwork.ETHEREUM, ChainNetwork.SOLANA],
  [ChainNetwork.SOLANA, ChainNetwork.ETHEREUM],
  [ChainNetwork.BNB_SMART_CHAIN, ChainNetwork.SOLANA],
  [ChainNetwork.SOLANA, ChainNetwork.BNB_SMART_CHAIN],
  [ChainNetwork.ETHEREUM, ChainNetwork.TRON],
  [ChainNetwork.TRON, ChainNetwork.ETHEREUM],
];

@Injectable()
export class SimulatorBridgeProvider implements BridgeProviderPort {
  readonly code = 'simulator';
  readonly name = 'Bridge Simulator';
  readonly priority = 100;

  private readonly quotes = new Map<string, BridgeProviderQuote>();
  private readonly executions = new Map<string, BridgeExecutionStatus>();

  getSupportedNetworks(): BridgeNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, bridgeSupported: true },
      { network: ChainNetwork.BNB_SMART_CHAIN, bridgeSupported: true },
      { network: ChainNetwork.SOLANA, bridgeSupported: true },
      { network: ChainNetwork.TRON, bridgeSupported: true },
      {
        network: ChainNetwork.BITCOIN,
        bridgeSupported: false,
        reason: 'Direct bridging not available; architecture reserved for future OTC/wrapped rails',
      },
    ];
  }

  async listRoutes(): Promise<BridgeRoute[]> {
    const routes: BridgeRoute[] = [];
    for (const [source, destination] of SUPPORTED_PAIRS) {
      routes.push(this.buildRoute(source, destination, 'USDC', true));
      routes.push(
        this.buildRoute(
          source,
          destination,
          'ETH',
          source === ChainNetwork.ETHEREUM || destination === ChainNetwork.ETHEREUM,
        ),
      );
    }
    routes.push({
      providerCode: this.code,
      routeId: 'btc-future',
      sourceNetwork: ChainNetwork.BITCOIN,
      destinationNetwork: ChainNetwork.ETHEREUM,
      assetSymbol: 'BTC',
      supported: false,
      reason: 'Bitcoin direct bridging not available yet',
      estimatedFeeNative: '0',
      estimatedCompletionSeconds: 0,
      hops: [],
    });
    return routes;
  }

  async getSupportedAssets(network: ChainNetwork): Promise<BridgeAssetRef[]> {
    if (network === ChainNetwork.BITCOIN) {
      return [
        {
          symbol: 'BTC',
          network,
          contractAddress: 'native',
          decimals: 8,
          standard: 'NATIVE',
          name: 'Bitcoin',
        },
      ];
    }
    const native =
      network === ChainNetwork.SOLANA
        ? 'SOL'
        : network === ChainNetwork.TRON
          ? 'TRX'
          : network === ChainNetwork.BNB_SMART_CHAIN
            ? 'BNB'
            : 'ETH';
    return [
      {
        symbol: native,
        network,
        contractAddress: 'native',
        decimals: 18,
        standard: 'NATIVE',
        name: native,
      },
      {
        symbol: 'USDC',
        network,
        contractAddress: '0xusdc',
        decimals: 6,
        standard:
          network === ChainNetwork.SOLANA
            ? 'SPL'
            : network === ChainNetwork.TRON
              ? 'TRC20'
              : 'ERC20',
        name: 'USD Coin',
      },
    ];
  }

  async getQuote(request: BridgeQuoteRequest): Promise<BridgeProviderQuote> {
    this.assertRequest(request);
    if (
      request.sourceNetwork === ChainNetwork.BITCOIN ||
      request.destinationNetwork === ChainNetwork.BITCOIN
    ) {
      throw new BridgeUnsupportedRouteError('Bitcoin bridging is not available yet', {
        architecture: 'future_otc_or_wrapped',
      });
    }
    if (!this.isSupportedPair(request.sourceNetwork, request.destinationNetwork)) {
      throw new BridgeUnsupportedRouteError('Route not supported by simulator', {
        sourceNetwork: request.sourceNetwork,
        destinationNetwork: request.destinationNetwork,
      });
    }
    const amountIn = Number(request.amount);
    if (!Number.isFinite(amountIn) || amountIn <= 0) {
      throw new BridgeValidationError('amount must be a positive number');
    }
    const fee = Math.max(amountIn * 0.0015, 0.0001);
    const amountOut = Math.max(amountIn - fee, 0);
    const providerQuoteId = `sim-q-${randomBytes(8).toString('hex')}`;
    const quote: BridgeProviderQuote = {
      providerCode: this.code,
      providerQuoteId,
      sourceNetwork: request.sourceNetwork,
      destinationNetwork: request.destinationNetwork,
      assetSymbol: request.assetSymbol,
      amountIn: request.amount,
      amountOut: amountOut.toFixed(6),
      minAmountOut: (amountOut * 0.995).toFixed(6),
      feeAmount: fee.toFixed(6),
      feeAsset: request.assetSymbol,
      estimatedFeeNative: (fee * 0.4).toFixed(6),
      estimatedCompletionSeconds: this.estimateSeconds(
        request.sourceNetwork,
        request.destinationNetwork,
      ),
      routeSummary: `${request.sourceNetwork} → ${request.destinationNetwork} via simulator`,
      route: this.buildRoute(
        request.sourceNetwork,
        request.destinationNetwork,
        request.assetSymbol,
        true,
      ),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      simulationOk: true,
      replayNonce: createHash('sha256').update(providerQuoteId).digest('hex').slice(0, 32),
    };
    this.quotes.set(providerQuoteId, quote);
    return quote;
  }

  async prepareTransfer(
    request: BridgeQuoteRequest & { providerQuoteId: string },
  ): Promise<PreparedBridgeTx> {
    const quote = this.quotes.get(request.providerQuoteId);
    if (!quote) throw new BridgeProviderError('Unknown quote');
    return {
      providerCode: this.code,
      providerQuoteId: request.providerQuoteId,
      sourceNetwork: request.sourceNetwork,
      to: '0xBridgeVaultSimulator',
      data: `0x${createHash('sha256').update(request.providerQuoteId).digest('hex').slice(0, 16)}`,
      value: request.amount,
      simulationOk: true,
      simulationDetail: 'simulator ok',
    };
  }

  async executeTransfer(providerQuoteId: string): Promise<BridgeExecutionStatus> {
    const quote = this.quotes.get(providerQuoteId);
    if (!quote) throw new BridgeProviderError('Unknown quote');
    const providerRef = `sim-x-${randomBytes(6).toString('hex')}`;
    const status: BridgeExecutionStatus = {
      providerRef,
      status: 'BRIDGING',
      sourceTxHash: `0x${randomBytes(16).toString('hex')}`,
      confirmations: 1,
    };
    this.executions.set(providerRef, status);
    // Advance toward completion on status poll
    setTimeout(() => {
      const current = this.executions.get(providerRef);
      if (!current) return;
      this.executions.set(providerRef, {
        ...current,
        status: 'COMPLETED',
        destinationTxHash: `0x${randomBytes(16).toString('hex')}`,
        confirmations: 12,
        amountOutActual: quote.amountOut,
        completedAt: new Date().toISOString(),
      });
    }, 25);
    return status;
  }

  async getExecutionStatus(providerRef: string): Promise<BridgeExecutionStatus> {
    const status = this.executions.get(providerRef);
    if (!status) throw new BridgeProviderError('Unknown execution');
    return status;
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 3, detail: 'simulator' };
  }

  private assertRequest(request: BridgeQuoteRequest) {
    if (request.sourceNetwork === request.destinationNetwork) {
      throw new BridgeValidationError('source and destination networks must differ');
    }
    if (!request.assetSymbol?.trim()) {
      throw new BridgeValidationError('assetSymbol required');
    }
  }

  private isSupportedPair(source: ChainNetwork, destination: ChainNetwork) {
    return SUPPORTED_PAIRS.some(([s, d]) => s === source && d === destination);
  }

  private estimateSeconds(source: ChainNetwork, destination: ChainNetwork) {
    if (source === ChainNetwork.SOLANA || destination === ChainNetwork.SOLANA) return 90;
    if (source === ChainNetwork.TRON || destination === ChainNetwork.TRON) return 180;
    return 120;
  }

  private buildRoute(
    sourceNetwork: ChainNetwork,
    destinationNetwork: ChainNetwork,
    assetSymbol: string,
    supported: boolean,
  ): BridgeRoute {
    return {
      providerCode: this.code,
      routeId: `${sourceNetwork}-${destinationNetwork}-${assetSymbol}`.toLowerCase(),
      sourceNetwork,
      destinationNetwork,
      assetSymbol,
      supported,
      estimatedFeeNative: supported ? '0.002' : '0',
      estimatedFeeUsd: supported ? '0.50' : undefined,
      estimatedCompletionSeconds: supported
        ? this.estimateSeconds(sourceNetwork, destinationNetwork)
        : 0,
      hops: supported
        ? [
            { chain: sourceNetwork, protocol: 'lock' },
            { chain: destinationNetwork, protocol: 'mint' },
          ]
        : [],
      reason: supported ? undefined : 'unsupported',
    };
  }
}
