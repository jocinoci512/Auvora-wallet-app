import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { HoldingInput } from '../../application/services/portfolio-intelligence.service';

export const WALLET_HTTP_CLIENT = Symbol('WALLET_HTTP_CLIENT');

export interface WalletHttpClientPort {
  listActiveOwnerIds(): Promise<string[]>;
  getHoldings(ownerUserId: string): Promise<HoldingInput[]>;
}

interface Envelope<T> {
  data?: T;
}

@Injectable()
export class WalletHttpClientAdapter implements WalletHttpClientPort {
  private readonly logger = new Logger(WalletHttpClientAdapter.name);
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.baseUrl = env.WALLET_SERVICE_URL;
    this.apiKey = env.INTERNAL_API_KEY;
  }

  async listActiveOwnerIds(): Promise<string[]> {
    if (!this.baseUrl || !this.apiKey) return [];
    try {
      const payload = await this.get<{ ownerUserIds?: string[] }>(
        '/api/v1/internal/wallets/active-owners',
      );
      return payload?.ownerUserIds ?? [];
    } catch (error) {
      this.logger.debug(
        `listActiveOwnerIds failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getHoldings(ownerUserId: string): Promise<HoldingInput[]> {
    if (!this.baseUrl || !this.apiKey) return [];
    try {
      const payload = await this.get<{
        wallets?: Array<{
          walletId: string;
          assetCode: string;
          assetSymbol: string;
          assetChain: string;
          ledgerBalance: string;
        }>;
      }>(`/api/v1/internal/wallets/holdings/${encodeURIComponent(ownerUserId)}`);
      return (payload?.wallets ?? []).map((w) => ({
        walletId: w.walletId,
        assetCode: w.assetCode,
        assetSymbol: w.assetSymbol,
        assetChain: w.assetChain,
        quantity: w.ledgerBalance,
      }));
    } catch (error) {
      this.logger.debug(
        `getHoldings failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async get<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl!.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      headers: { 'x-internal-api-key': this.apiKey!, accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Envelope<T> | T;
    if (body && typeof body === 'object' && 'data' in body) {
      return (body as Envelope<T>).data ?? null;
    }
    return body as T;
  }
}
