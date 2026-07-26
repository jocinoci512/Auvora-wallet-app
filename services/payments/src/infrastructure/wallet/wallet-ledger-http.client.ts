import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  WalletLedgerCreditInput,
  WalletLedgerDebitInput,
  WalletLedgerPort,
  WalletLedgerResult,
  WalletLedgerTransferInput,
  WalletOwnerLookup,
} from '../../application/ports/wallet-ledger.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Outbound HTTP client to Wallet Core's internal ledger API. Wallet Core
 * never imports payment code; all interaction flows one way, from Payments
 * to Wallet, authenticated with a shared internal API key header.
 */
@Injectable()
export class WalletLedgerHttpClient implements WalletLedgerPort {
  private readonly logger = new Logger(WalletLedgerHttpClient.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async credit(input: WalletLedgerCreditInput): Promise<WalletLedgerResult> {
    return this.post('/api/v1/internal/ledger/credit', input);
  }

  async debit(input: WalletLedgerDebitInput): Promise<WalletLedgerResult> {
    return this.post('/api/v1/internal/ledger/debit', input);
  }

  async transfer(input: WalletLedgerTransferInput): Promise<WalletLedgerResult> {
    return this.post('/api/v1/internal/ledger/transfer', input);
  }

  async getWalletOwner(walletId: string): Promise<WalletOwnerLookup | null> {
    const url = `${this.env.WALLET_SERVICE_URL.replace(/\/$/, '')}/api/v1/internal/wallets/${walletId}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-internal-api-key': this.env.INTERNAL_API_KEY,
        },
        signal: controller.signal,
      });

      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(`Wallet owner lookup failed (${response.status}): ${text}`);
        return null;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { id?: string; ownerUserId?: string };
      };
      const id = payload.data?.id;
      const ownerUserId = payload.data?.ownerUserId;
      if (!id || !ownerUserId) {
        return null;
      }
      return { id, ownerUserId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'wallet owner lookup failed';
      this.logger.warn(`Wallet owner lookup failed: ${message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post(
    path: string,
    body: WalletLedgerCreditInput | WalletLedgerDebitInput | WalletLedgerTransferInput,
  ): Promise<WalletLedgerResult> {
    const url = `${this.env.WALLET_SERVICE_URL.replace(/\/$/, '')}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': this.env.INTERNAL_API_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          success: false,
          message: `Wallet ledger call to ${path} failed with status ${response.status}: ${text}`,
        };
      }

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { transactionId?: string; transaction?: { id?: string } };
        transactionId?: string;
      };
      const transactionId =
        payload.data?.transactionId ??
        payload.data?.transaction?.id ??
        (typeof payload.transactionId === 'string' ? payload.transactionId : undefined);
      return { success: true, transactionId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'wallet ledger call failed';
      this.logger.warn(`Wallet ledger call to ${path} failed: ${message}`);
      return { success: false, message };
    } finally {
      clearTimeout(timeout);
    }
  }
}
