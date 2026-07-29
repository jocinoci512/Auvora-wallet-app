import type { ChainNetwork } from '@auvora/database';

export type ConnectionKind = 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';

export type ConnectionCapability = {
  kind: ConnectionKind;
  code: string;
  name: string;
  canSign: boolean;
  supportsSessions: boolean;
  supportsDiscovery: boolean;
};

export type DiscoveredDevice = {
  deviceId: string;
  vendor: string;
  model: string;
  transport: 'USB' | 'BLE' | 'NFC' | 'SIM';
  firmwareVersion: string;
  firmwareCompatible: boolean;
  status: 'AVAILABLE' | 'LOCKED' | 'BUSY' | 'DISCONNECTED';
};

export type PairedDevice = DiscoveredDevice & {
  pairedAt: string;
  accounts: Array<{ network: ChainNetwork; address: string; path?: string }>;
};

export type WalletConnectProposal = {
  proposalId: string;
  topic: string;
  uri: string;
  qrPayload: string;
  deepLink: string;
  requestedNetworks: ChainNetwork[];
  permissions: string[];
  expiresAt: string;
};

export type WalletConnectSessionSnapshot = {
  sessionId: string;
  topic: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'EXPIRED' | 'TERMINATED';
  peerName: string;
  peerUrl?: string;
  networks: ChainNetwork[];
  permissions: string[];
  accounts: string[];
  createdAt: string;
  expiresAt: string;
};

export type BrowserWalletSnapshot = {
  providerId: string;
  name: string;
  accounts: Array<{ network: ChainNetwork; address: string }>;
  connected: boolean;
};

export type PreparedExternalSign = {
  providerCode: string;
  kind: ConnectionKind;
  requestId: string;
  network: ChainNetwork;
  payloadType: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';
  preview: string;
  feeEstimate?: string;
  to?: string;
  value?: string;
  dataHash: string;
  simulationOk: boolean;
  requiresConfirmation: boolean;
  estimatedLatencyMs: number;
};

export type ExternalSignResult = {
  requestId: string;
  status: 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'REJECTED';
  signature?: string;
  txHash?: string;
  errorMessage?: string;
  verified: boolean;
};

export const CONNECTION_PROVIDER = Symbol('CONNECTION_PROVIDER');

export interface ConnectionProviderPort {
  readonly code: string;
  readonly name: string;
  readonly kind: ConnectionKind;
  getCapabilities(): ConnectionCapability;
  /** Optional: registries expose all provider capabilities. */
  listCapabilities?(): ConnectionCapability[];
  discoverDevices(): Promise<DiscoveredDevice[]>;
  pairDevice(deviceId: string): Promise<PairedDevice>;
  disconnectDevice(deviceId: string): Promise<void>;
  createWalletConnectProposal(input: {
    networks: ChainNetwork[];
    permissions: string[];
  }): Promise<WalletConnectProposal>;
  approveSession(proposalId: string, accounts: string[]): Promise<WalletConnectSessionSnapshot>;
  rejectSession(proposalId: string): Promise<WalletConnectSessionSnapshot>;
  restoreSession(sessionId: string): Promise<WalletConnectSessionSnapshot | null>;
  terminateSession(sessionId: string): Promise<void>;
  listBrowserWallets(): Promise<BrowserWalletSnapshot[]>;
  connectBrowserWallet(providerId: string): Promise<BrowserWalletSnapshot>;
  prepareSign(input: {
    kind: ConnectionKind;
    connectionRef: string;
    network: ChainNetwork;
    payloadType: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';
    payload: string;
    feeEstimate?: string;
  }): Promise<PreparedExternalSign>;
  completeSign(requestId: string, confirmed: boolean): Promise<ExternalSignResult>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; detail?: string }>;
}
