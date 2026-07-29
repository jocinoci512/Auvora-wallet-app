import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import type { BridgeProviderPort, BridgeQuoteRequest } from '../../domain';
import { SimulatorBridgeProvider } from './simulator-bridge.provider';

/** Wormhole-style adapter — prefers Solana routes. */
@Injectable()
export class WormholeStyleProvider implements BridgeProviderPort {
  readonly code = 'wormhole_sim';
  readonly name = 'Wormhole Simulator';
  readonly priority = 70;

  constructor(@Inject(SimulatorBridgeProvider) private readonly sim: SimulatorBridgeProvider) {}

  getSupportedNetworks() {
    return this.sim.getSupportedNetworks();
  }

  listRoutes() {
    return this.sim.listRoutes().then((routes) =>
      routes.map((r) => ({
        ...r,
        providerCode: this.code,
        estimatedCompletionSeconds:
          r.sourceNetwork === ChainNetwork.SOLANA || r.destinationNetwork === ChainNetwork.SOLANA
            ? Math.max(60, r.estimatedCompletionSeconds - 20)
            : r.estimatedCompletionSeconds + 30,
      })),
    );
  }

  getSupportedAssets(network: ChainNetwork) {
    return this.sim.getSupportedAssets(network);
  }

  async getQuote(request: BridgeQuoteRequest) {
    const quote = await this.sim.getQuote(request);
    const solanaBoost =
      request.sourceNetwork === ChainNetwork.SOLANA ||
      request.destinationNetwork === ChainNetwork.SOLANA;
    return {
      ...quote,
      providerCode: this.code,
      routeSummary: quote.routeSummary.replace('simulator', 'wormhole_sim'),
      route: { ...quote.route, providerCode: this.code },
      estimatedCompletionSeconds: solanaBoost
        ? Math.max(60, quote.estimatedCompletionSeconds - 20)
        : quote.estimatedCompletionSeconds + 30,
      amountOut: solanaBoost ? (Number(quote.amountOut) * 1.001).toFixed(6) : quote.amountOut,
    };
  }

  prepareTransfer(request: BridgeQuoteRequest & { providerQuoteId: string }) {
    return this.sim.prepareTransfer(request).then((tx) => ({ ...tx, providerCode: this.code }));
  }

  executeTransfer(providerQuoteId: string) {
    return this.sim.executeTransfer(providerQuoteId);
  }

  getExecutionStatus(providerRef: string) {
    return this.sim.getExecutionStatus(providerRef);
  }

  healthCheck() {
    return this.sim.healthCheck().then((h) => ({ ...h, detail: 'wormhole_sim' }));
  }
}
