import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionKind, ConnectionProviderPort } from '../../domain/connection-provider.port';
import { SimulatorConnectionProvider } from './simulator-connection.provider';

/** WalletConnect v2-style adapter (simulated). */
@Injectable()
export class WalletConnectStyleProvider implements ConnectionProviderPort {
  readonly code = 'walletconnect_sim';
  readonly name = 'WalletConnect-style (sim)';
  readonly kind: ConnectionKind = 'WALLETCONNECT';

  constructor(
    @Inject(SimulatorConnectionProvider) private readonly simulator: SimulatorConnectionProvider,
  ) {}

  getCapabilities() {
    return {
      kind: this.kind,
      code: this.code,
      name: this.name,
      canSign: true,
      supportsSessions: true,
      supportsDiscovery: false,
    };
  }

  discoverDevices() {
    return Promise.resolve([]);
  }
  pairDevice() {
    return this.simulator.pairDevice('ledger-nano-x-sim-1');
  }
  disconnectDevice(deviceId: string) {
    return this.simulator.disconnectDevice(deviceId);
  }
  createWalletConnectProposal(
    input: Parameters<ConnectionProviderPort['createWalletConnectProposal']>[0],
  ) {
    return this.simulator.createWalletConnectProposal(input);
  }
  approveSession(proposalId: string, accounts: string[]) {
    return this.simulator.approveSession(proposalId, accounts);
  }
  rejectSession(proposalId: string) {
    return this.simulator.rejectSession(proposalId);
  }
  restoreSession(sessionId: string) {
    return this.simulator.restoreSession(sessionId);
  }
  terminateSession(sessionId: string) {
    return this.simulator.terminateSession(sessionId);
  }
  listBrowserWallets() {
    return Promise.resolve([]);
  }
  connectBrowserWallet(providerId: string) {
    return this.simulator.connectBrowserWallet(providerId);
  }
  prepareSign(input: Parameters<ConnectionProviderPort['prepareSign']>[0]) {
    return this.simulator.prepareSign({ ...input, kind: 'WALLETCONNECT' }).then((p) => ({
      ...p,
      providerCode: this.code,
    }));
  }
  completeSign(requestId: string, confirmed: boolean) {
    return this.simulator.completeSign(requestId, confirmed);
  }
  healthCheck() {
    return this.simulator.healthCheck().then((h) => ({ ...h, detail: 'walletconnect_sim ok' }));
  }
}
