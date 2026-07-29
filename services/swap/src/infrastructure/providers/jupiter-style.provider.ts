import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { applySlippage } from '../../domain/calculations';
import { SwapUnsupportedNetworkError } from '../../domain/errors';
import type {
  PreparedSwapTx,
  SwapAssetRef,
  SwapExecutionStatus,
  SwapNetworkCapability,
  SwapProviderPort,
  SwapProviderQuote,
  SwapProviderRoute,
  SwapQuoteRequest,
} from '../../domain/swap-provider.port';
import { type SimulatorSwapProvider } from './simulator-swap.provider';

/** Solana-focused secondary aggregator (simulated Jupiter-style routing). */
@Injectable()
export class JupiterStyleProvider implements SwapProviderPort {
  readonly code = 'jupiter_sim';
  readonly name = 'Jupiter-style Aggregator (sim)';

  constructor(private readonly simulator: SimulatorSwapProvider) {}

  getSupportedNetworks(): SwapNetworkCapability[] {
    return [
      { network: ChainNetwork.SOLANA, swapSupported: true },
      { network: ChainNetwork.ETHEREUM, swapSupported: false, reason: 'Solana-only provider' },
      {
        network: ChainNetwork.BNB_SMART_CHAIN,
        swapSupported: false,
        reason: 'Solana-only provider',
      },
      { network: ChainNetwork.TRON, swapSupported: false, reason: 'Solana-only provider' },
      { network: ChainNetwork.BITCOIN, swapSupported: false, reason: 'Solana-only provider' },
    ];
  }

  async getSupportedAssets(network: ChainNetwork): Promise<SwapAssetRef[]> {
    if (network !== ChainNetwork.SOLANA) return [];
    return this.simulator.getSupportedAssets(network);
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapProviderQuote> {
    if (request.network !== ChainNetwork.SOLANA) {
      throw new SwapUnsupportedNetworkError(request.network, 'jupiter_sim supports Solana only');
    }
    const base = await this.simulator.getQuote(request);
    const amountOut = (Number(base.amountOut) * 1.002).toFixed(8);
    const route: SwapProviderRoute = {
      ...base.route,
      providerCode: this.code,
      routeId: `jup-${base.route.routeId}`,
      hops: [
        { venue: 'orca', from: request.sellToken, to: 'USDC', portionBps: 5000 },
        { venue: 'raydium', from: 'USDC', to: request.buyToken, portionBps: 5000 },
      ],
      amountOut,
      priceImpactBps: Math.max(0, base.priceImpactBps - 1),
      estimatedCompletionSeconds: 25,
    };
    return {
      ...base,
      providerCode: this.code,
      providerQuoteId: `jup-${base.providerQuoteId}`,
      amountOut,
      minAmountOut: applySlippage(amountOut, request.slippageBps ?? 50),
      priceImpactBps: route.priceImpactBps,
      routeSummary: 'orca → raydium',
      route,
    };
  }

  async getRoutes(request: SwapQuoteRequest): Promise<SwapProviderRoute[]> {
    const quote = await this.getQuote(request);
    return [quote.route];
  }

  async buildTransaction(
    request: SwapQuoteRequest & { providerQuoteId: string },
  ): Promise<PreparedSwapTx> {
    if (request.network !== ChainNetwork.SOLANA) {
      throw new SwapUnsupportedNetworkError(request.network, 'jupiter_sim supports Solana only');
    }
    const tx = await this.simulator.buildTransaction({
      ...request,
      providerQuoteId: request.providerQuoteId.replace(/^jup-/, ''),
    });
    return {
      ...tx,
      providerCode: this.code,
      providerQuoteId: request.providerQuoteId,
      to: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      data: Buffer.from(JSON.stringify({ jupiter: true, quote: request.providerQuoteId })).toString(
        'base64',
      ),
    };
  }

  async getExecutionStatus(providerRef: string): Promise<SwapExecutionStatus> {
    return this.simulator.getExecutionStatus(providerRef);
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 4, detail: 'jupiter_sim ok' };
  }
}
