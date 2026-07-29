import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { applySlippage, parseAmount, priceImpactBps } from '../../domain/calculations';
import { SwapUnsupportedNetworkError, SwapValidationError } from '../../domain/errors';
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

const ASSETS: Record<string, SwapAssetRef[]> = {
  [ChainNetwork.ETHEREUM]: [
    {
      symbol: 'ETH',
      network: ChainNetwork.ETHEREUM,
      contractAddress: '',
      decimals: 18,
      standard: 'NATIVE',
      verified: true,
      name: 'Ether',
    },
    {
      symbol: 'USDC',
      network: ChainNetwork.ETHEREUM,
      contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      standard: 'ERC20',
      verified: true,
      name: 'USD Coin',
    },
    {
      symbol: 'USDT',
      network: ChainNetwork.ETHEREUM,
      contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      standard: 'ERC20',
      verified: true,
      name: 'Tether USD',
    },
  ],
  [ChainNetwork.BNB_SMART_CHAIN]: [
    {
      symbol: 'BNB',
      network: ChainNetwork.BNB_SMART_CHAIN,
      contractAddress: '',
      decimals: 18,
      standard: 'NATIVE',
      verified: true,
      name: 'BNB',
    },
    {
      symbol: 'USDC',
      network: ChainNetwork.BNB_SMART_CHAIN,
      contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      decimals: 18,
      standard: 'BEP20',
      verified: true,
      name: 'USD Coin',
    },
  ],
  [ChainNetwork.SOLANA]: [
    {
      symbol: 'SOL',
      network: ChainNetwork.SOLANA,
      contractAddress: '',
      decimals: 9,
      standard: 'NATIVE',
      verified: true,
      name: 'Solana',
    },
    {
      symbol: 'USDC',
      network: ChainNetwork.SOLANA,
      contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      standard: 'SPL',
      verified: true,
      name: 'USD Coin',
    },
  ],
  [ChainNetwork.TRON]: [
    {
      symbol: 'TRX',
      network: ChainNetwork.TRON,
      contractAddress: '',
      decimals: 6,
      standard: 'NATIVE',
      verified: true,
      name: 'TRON',
    },
    {
      symbol: 'USDT',
      network: ChainNetwork.TRON,
      contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      decimals: 6,
      standard: 'TRC20',
      verified: true,
      name: 'Tether USD',
    },
  ],
};

const MID: Record<string, number> = {
  ETH: 3500,
  BNB: 600,
  SOL: 150,
  TRX: 0.12,
  USDC: 1,
  USDT: 1,
};

@Injectable()
export class SimulatorSwapProvider implements SwapProviderPort {
  readonly code = 'simulator';
  readonly name = 'Auvora Swap Simulator';
  private readonly statuses = new Map<string, SwapExecutionStatus>();

  getSupportedNetworks(): SwapNetworkCapability[] {
    return [
      { network: ChainNetwork.ETHEREUM, swapSupported: true },
      { network: ChainNetwork.BNB_SMART_CHAIN, swapSupported: true },
      { network: ChainNetwork.SOLANA, swapSupported: true },
      { network: ChainNetwork.TRON, swapSupported: true },
      {
        network: ChainNetwork.BITCOIN,
        swapSupported: false,
        reason: 'Direct DEX swaps are not applicable; future OTC/bridge support planned',
      },
    ];
  }

  async getSupportedAssets(network: ChainNetwork): Promise<SwapAssetRef[]> {
    return ASSETS[network] ?? [];
  }

  async getQuote(request: SwapQuoteRequest): Promise<SwapProviderQuote> {
    this.assertSupported(request.network);
    const sell = parseAmount(request.sellAmount);
    const midSell = MID[request.sellToken.toUpperCase()];
    const midBuy = MID[request.buyToken.toUpperCase()];
    if (!midSell || !midBuy) {
      throw new SwapValidationError('Unsupported token pair for simulator', {
        sellToken: request.sellToken,
        buyToken: request.buyToken,
      });
    }
    const idealOut = (sell * midSell) / midBuy;
    const sizePenalty = Math.min(0.03, (sell * midSell) / 1_000_000);
    const quotedOut = idealOut * (1 - sizePenalty);
    const impact = priceImpactBps(idealOut, quotedOut);
    const amountOut = quotedOut.toFixed(8);
    const minAmountOut = applySlippage(amountOut, request.slippageBps ?? 50);
    const route = this.buildRoute(request, amountOut, impact);
    const providerQuoteId = `sim-${request.network}-${Date.now()}`;
    return {
      providerCode: this.code,
      providerQuoteId,
      network: request.network,
      sellToken: request.sellToken.toUpperCase(),
      buyToken: request.buyToken.toUpperCase(),
      sellAmount: request.sellAmount,
      amountOut,
      minAmountOut,
      priceImpactBps: impact,
      estimatedGas: request.network === ChainNetwork.SOLANA ? '200000' : '180000',
      estimatedFeeNative: this.feeNative(request.network),
      feeAmount: (quotedOut * 0.003).toFixed(8),
      feeAsset: request.buyToken.toUpperCase(),
      routeSummary: route.hops.map((h) => h.venue).join(' → '),
      route,
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
      supportsSimulation: true,
      raw: { midMarketOut: idealOut, sizePenalty },
    };
  }

  async getRoutes(request: SwapQuoteRequest): Promise<SwapProviderRoute[]> {
    const quote = await this.getQuote(request);
    const alt = {
      ...quote.route,
      routeId: `${quote.route.routeId}-alt`,
      hops: [
        { venue: 'sim-pool-a', from: request.sellToken, to: 'USDC', portionBps: 6000 },
        { venue: 'sim-pool-b', from: 'USDC', to: request.buyToken, portionBps: 4000 },
      ],
      amountOut: (Number(quote.amountOut) * 0.997).toFixed(8),
      priceImpactBps: quote.priceImpactBps + 5,
    };
    return [quote.route, alt];
  }

  async buildTransaction(
    request: SwapQuoteRequest & { providerQuoteId: string },
  ): Promise<PreparedSwapTx> {
    this.assertSupported(request.network);
    if (!request.providerQuoteId.startsWith('sim-')) {
      throw new SwapValidationError('Unknown simulator quote id');
    }
    return {
      providerCode: this.code,
      providerQuoteId: request.providerQuoteId,
      network: request.network,
      to: '0xSwapRouterSimulator000000000000000001',
      data: `0xswap${Buffer.from(
        JSON.stringify({
          sell: request.sellToken,
          buy: request.buyToken,
          amount: request.sellAmount,
          slippageBps: request.slippageBps,
        }),
      ).toString('hex')}`,
      value: request.sellContractAddress ? '0' : request.sellAmount,
      gasLimit: '250000',
      maxFeePerGas: '20000000000',
      simulationOk: true,
      simulationDetail: 'simulator dry-run ok',
      nonceHint: String(Date.now() % 10_000),
    };
  }

  async getExecutionStatus(providerRef: string): Promise<SwapExecutionStatus> {
    const existing = this.statuses.get(providerRef);
    if (existing) return existing;
    const status: SwapExecutionStatus = {
      providerRef,
      status: 'COMPLETED',
      txHash: `0xsim${providerRef.replace(/\W/g, '').slice(0, 40)}`,
      confirmations: 12,
      amountOutActual: undefined,
    };
    this.statuses.set(providerRef, status);
    return status;
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 1, detail: 'simulator ok' };
  }

  private assertSupported(network: ChainNetwork): void {
    if (network === ChainNetwork.BITCOIN) {
      throw new SwapUnsupportedNetworkError(
        network,
        'Direct DEX swaps are not applicable on Bitcoin; future OTC/bridge support planned',
      );
    }
    if (!ASSETS[network]) {
      throw new SwapUnsupportedNetworkError(network);
    }
  }

  private feeNative(network: ChainNetwork): string {
    switch (network) {
      case ChainNetwork.SOLANA:
        return '0.000005';
      case ChainNetwork.TRON:
        return '1';
      case ChainNetwork.BNB_SMART_CHAIN:
        return '0.0003';
      default:
        return '0.002';
    }
  }

  private buildRoute(
    request: SwapQuoteRequest,
    amountOut: string,
    priceImpactBpsValue: number,
  ): SwapProviderRoute {
    return {
      providerCode: this.code,
      routeId: `sim-route-${request.sellToken}-${request.buyToken}`,
      hops: [
        {
          venue: 'sim-amm',
          from: request.sellToken.toUpperCase(),
          to: request.buyToken.toUpperCase(),
          portionBps: 10_000,
        },
      ],
      amountOut,
      priceImpactBps: priceImpactBpsValue,
      estimatedGas: '180000',
      estimatedFeeNative: this.feeNative(request.network),
      estimatedCompletionSeconds: request.network === ChainNetwork.BITCOIN ? 3600 : 45,
    };
  }
}
