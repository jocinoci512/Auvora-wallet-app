import { Inject, Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import type { BridgeProviderPort, BridgeQuoteRequest } from '../../domain';
import { SimulatorBridgeProvider } from './simulator-bridge.provider';

/** LayerZero-style adapter — delegates to simulator with branded metadata. */
@Injectable()
export class LayerZeroStyleProvider implements BridgeProviderPort {
  readonly code = 'layerzero_sim';
  readonly name = 'LayerZero Simulator';
  readonly priority = 80;

  constructor(@Inject(SimulatorBridgeProvider) private readonly sim: SimulatorBridgeProvider) {}

  getSupportedNetworks() {
    return this.sim.getSupportedNetworks().map((n) =>
      n.network === ChainNetwork.BITCOIN
        ? n
        : {
            ...n,
            bridgeSupported: n.network !== ChainNetwork.TRON ? n.bridgeSupported : false,
            reason:
              n.network === ChainNetwork.TRON ? 'Tron not supported on this provider' : n.reason,
          },
    );
  }

  listRoutes() {
    return this.sim
      .listRoutes()
      .then((routes) =>
        routes
          .filter(
            (r) =>
              r.sourceNetwork !== ChainNetwork.TRON && r.destinationNetwork !== ChainNetwork.TRON,
          )
          .map((r) => ({ ...r, providerCode: this.code })),
      );
  }

  getSupportedAssets(network: ChainNetwork) {
    return this.sim.getSupportedAssets(network);
  }

  async getQuote(request: BridgeQuoteRequest) {
    if (
      request.sourceNetwork === ChainNetwork.TRON ||
      request.destinationNetwork === ChainNetwork.TRON
    ) {
      const { BridgeUnsupportedRouteError } = await import('../../domain/errors');
      throw new BridgeUnsupportedRouteError('Tron not supported by layerzero_sim');
    }
    const quote = await this.sim.getQuote(request);
    return {
      ...quote,
      providerCode: this.code,
      routeSummary: quote.routeSummary.replace('simulator', 'layerzero_sim'),
      route: { ...quote.route, providerCode: this.code },
      estimatedFeeNative: (Number(quote.estimatedFeeNative) * 0.9).toFixed(6),
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
    return this.sim.healthCheck().then((h) => ({ ...h, detail: 'layerzero_sim' }));
  }
}
