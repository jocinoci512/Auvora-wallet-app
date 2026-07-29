import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ConnectionsProviderError } from '../../domain/errors';
import type {
  ConnectionCapability,
  ConnectionKind,
  ConnectionProviderPort,
} from '../../domain/connection-provider.port';
import { LedgerStyleProvider } from './ledger-style.provider';
import { SimulatorConnectionProvider } from './simulator-connection.provider';
import { WalletConnectStyleProvider } from './walletconnect-style.provider';

@Injectable()
export class ConnectionProviderRegistry implements ConnectionProviderPort {
  readonly code = 'registry';
  readonly name = 'Connection Provider Registry';
  readonly kind: ConnectionKind = 'HARDWARE';
  private readonly logger = new Logger(ConnectionProviderRegistry.name);
  private readonly providers: ConnectionProviderPort[];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(SimulatorConnectionProvider) simulator: SimulatorConnectionProvider,
    @Inject(LedgerStyleProvider) ledger: LedgerStyleProvider,
    @Inject(WalletConnectStyleProvider) walletConnect: WalletConnectStyleProvider,
  ) {
    this.providers = env.CONNECTIONS_SIMULATOR_ENABLED
      ? [simulator, ledger, walletConnect]
      : [ledger, walletConnect];
  }

  listProviders(): Array<{ code: string; name: string; kind: ConnectionKind }> {
    return this.providers.map((p) => ({ code: p.code, name: p.name, kind: p.kind }));
  }

  getProvider(code: string): ConnectionProviderPort {
    const found = this.providers.find((p) => p.code === code);
    if (!found) throw new ConnectionsProviderError(`Unknown connection provider: ${code}`);
    return found;
  }

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

  listCapabilities(): ConnectionCapability[] {
    return this.providers.map((p) => p.getCapabilities());
  }

  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new ConnectionsProviderError('Provider timeout')),
            this.env.CONNECTIONS_PROVIDER_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private primary(): ConnectionProviderPort {
    return this.providers[0]!;
  }

  discoverDevices() {
    return this.withTimeout(async () => {
      const merged = new Map<
        string,
        Awaited<ReturnType<ConnectionProviderPort['discoverDevices']>>[number]
      >();
      for (const p of this.providers) {
        try {
          for (const d of await p.discoverDevices()) merged.set(d.deviceId, d);
        } catch (error) {
          this.logger.warn(
            `discover ${p.code}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return Array.from(merged.values());
    });
  }

  pairDevice(deviceId: string) {
    return this.withTimeout(async () => {
      if (deviceId.startsWith('ledger-')) {
        const ledger = this.providers.find((p) => p.code === 'ledger_sim') ?? this.primary();
        return ledger.pairDevice(deviceId);
      }
      let lastError: unknown;
      for (const provider of this.providers) {
        if (provider.kind !== 'HARDWARE' && provider.code !== 'simulator') continue;
        try {
          return await provider.pairDevice(deviceId);
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) throw lastError;
      throw new ConnectionsProviderError(`Unable to pair device: ${deviceId}`);
    });
  }
  disconnectDevice(deviceId: string) {
    return this.withTimeout(async () => {
      if (deviceId.startsWith('ledger-')) {
        const ledger = this.providers.find((p) => p.code === 'ledger_sim') ?? this.primary();
        return ledger.disconnectDevice(deviceId);
      }
      return this.primary().disconnectDevice(deviceId);
    });
  }
  createWalletConnectProposal(
    input: Parameters<ConnectionProviderPort['createWalletConnectProposal']>[0],
  ) {
    const wc = this.providers.find((p) => p.kind === 'WALLETCONNECT') ?? this.primary();
    return this.withTimeout(() => wc.createWalletConnectProposal(input));
  }
  approveSession(proposalId: string, accounts: string[]) {
    const wc = this.providers.find((p) => p.kind === 'WALLETCONNECT') ?? this.primary();
    return this.withTimeout(() => wc.approveSession(proposalId, accounts));
  }
  rejectSession(proposalId: string) {
    const wc = this.providers.find((p) => p.kind === 'WALLETCONNECT') ?? this.primary();
    return this.withTimeout(() => wc.rejectSession(proposalId));
  }
  restoreSession(sessionId: string) {
    const wc = this.providers.find((p) => p.kind === 'WALLETCONNECT') ?? this.primary();
    return this.withTimeout(() => wc.restoreSession(sessionId));
  }
  terminateSession(sessionId: string) {
    const wc = this.providers.find((p) => p.kind === 'WALLETCONNECT') ?? this.primary();
    return this.withTimeout(() => wc.terminateSession(sessionId));
  }
  listBrowserWallets() {
    return this.withTimeout(async () => {
      const merged = new Map<
        string,
        Awaited<ReturnType<ConnectionProviderPort['listBrowserWallets']>>[number]
      >();
      for (const provider of this.providers) {
        try {
          for (const wallet of await provider.listBrowserWallets()) {
            merged.set(wallet.providerId, wallet);
          }
        } catch (error) {
          this.logger.warn(
            `browser list ${provider.code}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return Array.from(merged.values());
    });
  }
  connectBrowserWallet(providerId: string) {
    return this.withTimeout(async () => {
      let lastError: unknown;
      for (const provider of this.providers) {
        try {
          const wallets = await provider.listBrowserWallets();
          if (wallets.some((w) => w.providerId === providerId) || provider.code === 'simulator') {
            return await provider.connectBrowserWallet(providerId);
          }
        } catch (error) {
          lastError = error;
        }
      }
      try {
        return await this.primary().connectBrowserWallet(providerId);
      } catch (error) {
        throw lastError ?? error;
      }
    });
  }
  prepareSign(input: Parameters<ConnectionProviderPort['prepareSign']>[0]) {
    return this.withTimeout(() => this.primary().prepareSign(input));
  }
  completeSign(requestId: string, confirmed: boolean) {
    return this.withTimeout(() => this.primary().completeSign(requestId, confirmed));
  }

  async healthCheck() {
    const started = Date.now();
    const checks = await Promise.all(this.providers.map((p) => p.healthCheck()));
    return {
      healthy: checks.every((c) => c.healthy),
      latencyMs: Date.now() - started,
      detail: checks
        .map((c, i) => `${this.providers[i]?.code ?? 'unknown'}:${c.healthy}`)
        .join(','),
    };
  }
}
