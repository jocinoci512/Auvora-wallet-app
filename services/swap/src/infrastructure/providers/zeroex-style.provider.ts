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

/** EVM-focused secondary aggregator (simulated 0x-style routing). */
@Injectable()
export class ZeroExStyleProvider implements SwapProviderPort {
  readonly code = 'zeroex_sim';
  readonly name = '0x-style Aggregator (sim)';

  constructor(private readonly simulator: SimulatorSwapProvider) {}

  getSupportedNetworks(): SwapNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, swapSupported: true },
      { network: ChainNetwork.BNB_SMART_CHAIN, swapSupported: true },
      { network: ChainNetwork.SOLANA, swapSupported: false, reason: 'EVM-only provider' },
      { network: ChainNetwork.TRON, swapSupported: false, reason: 'EVM-only provider' },
      { network: ChainNetwork.BITCOIN, swapSupported: false, reason: 'EVM-only provider' },
    ];
  }

  async getSupportedAssets(network: ChainNetwork): Promise<SwapAssetRef[]> {
    if (network !== ChainNetwork.ETHEREUM && network !== ChainNetwork.BNB_SMART_CHAIN) return [];
    return this.simulator.getSupportedAssets(network);
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapProviderQuote> {
    this.assertEvm(request.network);
    const base = await this.simulator.getQuote(request);
    const amountOut = (Number(base.amountOut) * 1.0015).toFixed(8);
    const route: SwapProviderRoute = {
      ...base.route,
      providerCode: this.code,
      routeId: `0x-${base.route.routeId}`,
      hops: [
        { venue: '0x-rfq', from: request.sellToken, to: request.buyToken, portionBps: 10_000 },
      ],
      amountOut,
      priceImpactBps: Math.max(0, base.priceImpactBps - 2),
    };
    return {
      ...base,
      providerCode: this.code,
      providerQuoteId: `0x-${base.providerQuoteId}`,
      amountOut,
      minAmountOut: applySlippage(amountOut, request.slippageBps ?? 50),
      priceImpactBps: route.priceImpactBps,
      routeSummary: '0x-rfq',
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
    this.assertEvm(request.network);
    const tx = await this.simulator.buildTransaction({
      ...request,
      providerQuoteId: request.providerQuoteId.replace(/^0x-/, ''),
    });
    return {
      ...tx,
      providerCode: this.code,
      providerQuoteId: request.providerQuoteId,
      to: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
    };
  }

  async getExecutionStatus(providerRef: string): Promise<SwapExecutionStatus> {
    return this.simulator.getExecutionStatus(providerRef);
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 3, detail: 'zeroex_sim ok' };
  }

  private assertEvm(network: ChainNetwork): void {
    if (network !== ChainNetwork.ETHEREUM && network !== ChainNetwork.BNB_SMART_CHAIN) {
      throw new SwapUnsupportedNetworkError(network, 'zeroex_sim supports ETH/BSC only');
    }
  }
}
