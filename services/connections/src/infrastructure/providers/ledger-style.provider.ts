import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionKind, ConnectionProviderPort } from '../../domain/connection-provider.port';
import { SimulatorConnectionProvider } from './simulator-connection.provider';

/** Hardware wallet adapter (simulated Ledger-style). */
@Injectable()
export class LedgerStyleProvider implements ConnectionProviderPort {
  readonly code = 'ledger_sim';
  readonly name = 'Ledger-style Hardware (sim)';
  readonly kind: ConnectionKind = 'HARDWARE';

  constructor(
    @Inject(SimulatorConnectionProvider) private readonly simulator: SimulatorConnectionProvider,
  ) {}

  getCapabilities() {
    return {
      kind: this.kind,
      code: this.code,
      name: this.name,
      canSign: true,
      supportsSessions: false,
      supportsDiscovery: true,
    };
  }

  discoverDevices() {
    return this.simulator
      .discoverDevices()
      .then((list) =>
        list
          .filter((d) => d.vendor === 'Ledger')
          .map((d) => ({ ...d, deviceId: `ledger-${d.deviceId}` })),
      );
  }

  pairDevice(deviceId: string) {
    const id = deviceId.replace(/^ledger-/, '');
    return this.simulator.pairDevice(id.includes('ledger') ? id : 'ledger-nano-x-sim-1');
  }

  disconnectDevice(deviceId: string) {
    return this.simulator.disconnectDevice(deviceId.replace(/^ledger-/, ''));
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
    return this.simulator.prepareSign({ ...input, kind: 'HARDWARE' }).then((p) => ({
      ...p,
      providerCode: this.code,
    }));
  }
  completeSign(requestId: string, confirmed: boolean) {
    return this.simulator.completeSign(requestId, confirmed);
  }
  healthCheck() {
    return this.simulator.healthCheck().then((h) => ({ ...h, detail: 'ledger_sim ok' }));
  }
}
