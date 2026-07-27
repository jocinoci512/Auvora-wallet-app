import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type {
  BlockchainHttpClientPort,
  ChainAddressResult,
  ChainBalanceResult,
  ChainNetworkStatusResult,
  ChainSyncJobResult,
} from './blockchain-client.port';

interface Envelope<T> {
  data?: T;
}

/** Local format checks used when blockchain service URL is not configured (fail-closed for unknown chains). */
export function localFormatValidateAddress(chain: string, address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const c = chain.trim().toUpperCase().replace(/[-\s]/g, '_');
  switch (c) {
    case 'BITCOIN':
    case 'BTC':
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    case 'ETHEREUM':
    case 'ETH':
    case 'POLYGON':
    case 'MATIC':
    case 'BNB_SMART_CHAIN':
    case 'BSC':
    case 'BNB':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'SOLANA':
    case 'SOL':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case 'TRON':
    case 'TRX':
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case 'LITECOIN':
    case 'LTC':
      return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    default:
      return false;
  }
}

const PHASE18_CHAINS = [
  'ETHEREUM',
  'BNB_SMART_CHAIN',
  'BITCOIN',
  'SOLANA',
  'TRON',
] as const;

/**
 * Calls blockchain service internal APIs when `BLOCKCHAIN_SERVICE_URL` +
 * `INTERNAL_API_KEY` are configured. Falls back to local format validation only.
 */
@Injectable()
export class BlockchainHttpClientAdapter implements BlockchainHttpClientPort {
  private readonly logger = new Logger(BlockchainHttpClientAdapter.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.baseUrl = env.BLOCKCHAIN_SERVICE_URL;
    this.apiKey = env.INTERNAL_API_KEY;
    this.timeoutMs = env.BLOCKCHAIN_HTTP_TIMEOUT_MS;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async validateAddress(chain: string, address: string): Promise<boolean> {
    if (!this.isConfigured()) {
      return localFormatValidateAddress(chain, address);
    }
    try {
      const payload = await this.post<{ chain: string; address: string; valid: boolean }>(
        '/api/v1/internal/blockchain/addresses/validate',
        { chain, address },
      );
      return Boolean(payload?.valid);
    } catch (error) {
      this.logger.warn(
        `Blockchain validateAddress failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return localFormatValidateAddress(chain, address);
    }
  }

  async createAddress(input: {
    chain: string;
    ownerUserId: string;
    walletId?: string;
    label?: string;
  }): Promise<ChainAddressResult | null> {
    if (!this.isConfigured()) {
      this.logger.debug('createAddress skipped — blockchain service not configured');
      return null;
    }
    try {
      return await this.post<ChainAddressResult>('/api/v1/internal/blockchain/addresses', input);
    } catch (error) {
      this.logger.warn(
        `Blockchain createAddress failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async getBalance(chain: string, address: string): Promise<ChainBalanceResult | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      return await this.get<ChainBalanceResult>(
        `/api/v1/internal/blockchain/balances/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
      );
    } catch (error) {
      this.logger.warn(
        `Blockchain getBalance failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async getNetworkStatus(chain: string): Promise<ChainNetworkStatusResult | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      return await this.get<ChainNetworkStatusResult>(
        `/api/v1/internal/blockchain/networks/${encodeURIComponent(chain)}/status`,
      );
    } catch (error) {
      this.logger.warn(
        `Blockchain getNetworkStatus failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async triggerSync(chain: string): Promise<ChainSyncJobResult | null> {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      return await this.post<ChainSyncJobResult>('/api/v1/internal/blockchain/sync', { chain });
    } catch (error) {
      this.logger.warn(
        `Blockchain triggerSync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async listChains(): Promise<string[]> {
    if (!this.isConfigured()) {
      return [...PHASE18_CHAINS];
    }
    try {
      const payload = await this.get<{ chains: string[] }>('/api/v1/internal/blockchain/chains');
      return payload?.chains?.length ? payload.chains : [...PHASE18_CHAINS];
    } catch {
      return [...PHASE18_CHAINS];
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-internal-api-key': this.apiKey ?? '',
    };
  }

  private async get<T>(path: string): Promise<T | null> {
    const response = await fetch(`${this.baseUrl!.replace(/\/$/, '')}${path}`, {
      method: 'GET',
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const body = (await response.json()) as Envelope<T> | T;
    return (body as Envelope<T>).data ?? (body as T);
  }

  private async post<T>(path: string, body: unknown): Promise<T | null> {
    const response = await fetch(`${this.baseUrl!.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as Envelope<T> | T;
    return (payload as Envelope<T>).data ?? (payload as T);
  }
}
