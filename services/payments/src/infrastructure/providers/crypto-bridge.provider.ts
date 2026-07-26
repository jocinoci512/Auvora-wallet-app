import { Inject, Injectable, Logger } from '@nestjs/common';
import { PaymentType } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { ProviderHealthResult } from '../../domain';
import { BasePaymentSimulatorProvider } from './base-payment-simulator.provider';

/**
 * Bridges crypto deposits/withdrawals to the Blockchain Integration service.
 * Authorization/capture are simulated locally with synthetic provider refs;
 * `healthCheck` performs a lightweight call against the blockchain service so
 * that provider selection reflects real upstream availability.
 */
@Injectable()
export class CryptoBridgeProvider extends BasePaymentSimulatorProvider {
  private readonly logger = new Logger(CryptoBridgeProvider.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {
    super('CRYPTO_BRIDGE', 'Crypto Bridge', [PaymentType.CRYPTO_DEPOSIT, PaymentType.CRYPTO_WITHDRAWAL]);
  }

  override async healthCheck(): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${this.env.BLOCKCHAIN_SERVICE_URL.replace(/\/$/, '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return { healthy: response.ok, latencyMs: Date.now() - start };
    } catch (error) {
      this.logger.warn(
        `Blockchain service health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { healthy: false, latencyMs: Date.now() - start, message: 'blockchain service unreachable' };
    }
  }
}
