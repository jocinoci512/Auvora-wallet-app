import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import { createHash, randomBytes } from 'node:crypto';
import {
  ConnectionsNotFoundError,
  ConnectionsSigningNotAllowedError,
  ConnectionsUnsupportedError,
  ConnectionsValidationError,
} from '../../domain/errors';
import type {
  BrowserWalletSnapshot,
  ConnectionCapability,
  ConnectionKind,
  ConnectionProviderPort,
  DiscoveredDevice,
  ExternalSignResult,
  PairedDevice,
  PreparedExternalSign,
  WalletConnectProposal,
  WalletConnectSessionSnapshot,
} from '../../domain/connection-provider.port';

const DEVICES: DiscoveredDevice[] = [
  {
    deviceId: 'ledger-nano-x-sim-1',
    vendor: 'Ledger',
    model: 'Nano X',
    transport: 'USB',
    firmwareVersion: '2.2.3',
    firmwareCompatible: true,
    status: 'AVAILABLE',
  },
  {
    deviceId: 'trezor-model-t-sim-1',
    vendor: 'Trezor',
    model: 'Model T',
    transport: 'USB',
    firmwareVersion: '2.6.0',
    firmwareCompatible: true,
    status: 'AVAILABLE',
  },
];

@Injectable()
export class SimulatorConnectionProvider implements ConnectionProviderPort {
  readonly code = 'simulator';
  readonly name = 'Connections Simulator';
  readonly kind: ConnectionKind = 'HARDWARE';

  private paired = new Map<string, PairedDevice>();
  private proposals = new Map<string, WalletConnectProposal>();
  private sessions = new Map<string, WalletConnectSessionSnapshot>();
  private signs = new Map<
    string,
    PreparedExternalSign & { connectionRef: string; payload: string }
  >();
  private browser = new Map<string, BrowserWalletSnapshot>([
    [
      'metamask_sim',
      {
        providerId: 'metamask_sim',
        name: 'MetaMask (sim)',
        accounts: [],
        connected: false,
      },
    ],
    [
      'phantom_sim',
      {
        providerId: 'phantom_sim',
        name: 'Phantom (sim)',
        accounts: [],
        connected: false,
      },
    ],
  ]);

  getCapabilities(): ConnectionCapability {
    return {
      kind: 'HARDWARE',
      code: this.code,
      name: this.name,
      canSign: true,
      supportsSessions: true,
      supportsDiscovery: true,
    };
  }

  async discoverDevices(): Promise<DiscoveredDevice[]> {
    return DEVICES.map((d) => ({ ...d }));
  }

  async pairDevice(deviceId: string): Promise<PairedDevice> {
    const found = DEVICES.find((d) => d.deviceId === deviceId);
    if (!found) throw new ConnectionsNotFoundError('Device not found');
    if (!found.firmwareCompatible) {
      throw new ConnectionsUnsupportedError('Firmware incompatible');
    }
    const paired: PairedDevice = {
      ...found,
      status: 'AVAILABLE',
      pairedAt: new Date().toISOString(),
      accounts: [
        {
          network: ChainNetwork.ETHEREUM,
          address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          path: "m/44'/60'/0'/0/0",
        },
        {
          network: ChainNetwork.SOLANA,
          address: 'So11111111111111111111111111111111111111112',
          path: "m/44'/501'/0'",
        },
      ],
    };
    this.paired.set(deviceId, paired);
    return paired;
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    this.paired.delete(deviceId);
  }

  async createWalletConnectProposal(input: {
    networks: ChainNetwork[];
    permissions: string[];
  }): Promise<WalletConnectProposal> {
    const proposalId = randomBytes(8).toString('hex');
    const topic = `wc_${proposalId}`;
    const uri = `wc:${topic}@2?relay-protocol=irn&symKey=${randomBytes(16).toString('hex')}`;
    const proposal: WalletConnectProposal = {
      proposalId,
      topic,
      uri,
      qrPayload: uri,
      deepLink: `auvora://wc?uri=${encodeURIComponent(uri)}`,
      requestedNetworks: input.networks,
      permissions: input.permissions.length ? input.permissions : ['accounts', 'sign'],
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    };
    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  async approveSession(
    proposalId: string,
    accounts: string[],
  ): Promise<WalletConnectSessionSnapshot> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new ConnectionsNotFoundError('Proposal not found');
    if (!accounts.length) throw new ConnectionsValidationError('accounts required');
    const session: WalletConnectSessionSnapshot = {
      sessionId: randomBytes(8).toString('hex'),
      topic: proposal.topic,
      status: 'ACTIVE',
      peerName: 'Simulated DApp',
      peerUrl: 'https://dapp.auvora.local',
      networks: proposal.requestedNetworks,
      permissions: proposal.permissions,
      accounts,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    this.sessions.set(session.sessionId, session);
    this.proposals.delete(proposalId);
    return session;
  }

  async rejectSession(proposalId: string): Promise<WalletConnectSessionSnapshot> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new ConnectionsNotFoundError('Proposal not found');
    this.proposals.delete(proposalId);
    return {
      sessionId: proposal.proposalId,
      topic: proposal.topic,
      status: 'REJECTED',
      peerName: 'Simulated DApp',
      networks: proposal.requestedNetworks,
      permissions: proposal.permissions,
      accounts: [],
      createdAt: new Date().toISOString(),
      expiresAt: proposal.expiresAt,
    };
  }

  async restoreSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.set(sessionId, { ...session, status: 'TERMINATED' });
  }

  async listBrowserWallets() {
    return Array.from(this.browser.values()).map((b) => ({ ...b }));
  }

  async connectBrowserWallet(providerId: string) {
    const wallet = this.browser.get(providerId);
    if (!wallet) throw new ConnectionsNotFoundError('Browser wallet not found');
    const connected: BrowserWalletSnapshot = {
      ...wallet,
      connected: true,
      accounts: [
        {
          network: providerId.includes('phantom') ? ChainNetwork.SOLANA : ChainNetwork.ETHEREUM,
          address: providerId.includes('phantom')
            ? 'Ph1111111111111111111111111111111111111111'
            : '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        },
      ],
    };
    this.browser.set(providerId, connected);
    return connected;
  }

  async prepareSign(input: {
    kind: ConnectionKind;
    connectionRef: string;
    network: ChainNetwork;
    payloadType: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';
    payload: string;
    feeEstimate?: string;
  }): Promise<PreparedExternalSign> {
    if (input.kind === 'READONLY') {
      throw new ConnectionsSigningNotAllowedError();
    }
    if (!input.payload?.trim()) throw new ConnectionsValidationError('payload required');
    const requestId = randomBytes(8).toString('hex');
    const dataHash = createHash('sha256').update(input.payload).digest('hex');
    const prepared: PreparedExternalSign = {
      providerCode: this.code,
      kind: input.kind,
      requestId,
      network: input.network,
      payloadType: input.payloadType,
      preview:
        input.payloadType === 'TYPED_DATA'
          ? `typed-data:${input.payload.slice(0, 180)}`
          : input.payload.slice(0, 200),
      feeEstimate: input.feeEstimate ?? '0.001',
      to:
        input.payloadType === 'TRANSACTION'
          ? '0xcccccccccccccccccccccccccccccccccccccccc'
          : undefined,
      value: input.payloadType === 'TRANSACTION' ? '0.01' : undefined,
      dataHash,
      simulationOk: true,
      requiresConfirmation: true,
      estimatedLatencyMs: 850,
    };
    this.signs.set(requestId, {
      ...prepared,
      connectionRef: input.connectionRef,
      payload: input.payload,
    });
    return prepared;
  }

  async completeSign(requestId: string, confirmed: boolean): Promise<ExternalSignResult> {
    const prepared = this.signs.get(requestId);
    if (!prepared) throw new ConnectionsNotFoundError('Sign request not found');
    if (!confirmed) {
      return { requestId, status: 'REJECTED', verified: false, errorMessage: 'User rejected' };
    }
    const signature = createHash('sha256')
      .update(`${prepared.dataHash}:${prepared.connectionRef}`)
      .digest('hex');
    const result: ExternalSignResult = {
      requestId,
      status: 'COMPLETED',
      signature,
      txHash: prepared.payloadType === 'TRANSACTION' ? `0x${signature.slice(0, 64)}` : undefined,
      verified: true,
    };
    this.signs.delete(requestId);
    return result;
  }

  failSign(requestId: string, message: string) {
    this.signs.set(requestId, {
      providerCode: this.code,
      kind: 'HARDWARE',
      requestId,
      network: ChainNetwork.ETHEREUM,
      payloadType: 'MESSAGE',
      preview: '',
      dataHash: 'dead',
      simulationOk: false,
      requiresConfirmation: true,
      estimatedLatencyMs: 0,
      connectionRef: 'x',
      payload: message,
    });
  }

  async healthCheck() {
    const started = Date.now();
    return { healthy: true, latencyMs: Date.now() - started, detail: 'simulator ok' };
  }
}
