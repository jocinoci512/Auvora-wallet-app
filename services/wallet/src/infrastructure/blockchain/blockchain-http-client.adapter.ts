import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { BlockchainHttpClientPort } from './blockchain-client.port';

interface ValidateAddressResponse {
  data?: { valid?: boolean };
  valid?: boolean;
}

/**
 * Calls the blockchain service's `POST /api/v1/blockchain/addresses/validate`
 * endpoint when `BLOCKCHAIN_SERVICE_URL` is configured. Only `validateAddress`
 * is implemented today — this is a thin, optional integration seam, not a
 * general-purpose blockchain client (see `blockchain-client.port.ts`).
 */
@Injectable()
export class BlockchainHttpClientAdapter implements BlockchainHttpClientPort {
  private readonly logger = new Logger(BlockchainHttpClientAdapter.name);
  private readonly baseUrl?: string;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.baseUrl = env.BLOCKCHAIN_SERVICE_URL;
  }

  async validateAddress(chain: string, address: string): Promise<boolean> {
    if (!this.baseUrl) {
      return true;
    }

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/api/v1/blockchain/addresses/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain, address }),
        },
      );
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json().catch(() => undefined)) as
        | ValidateAddressResponse
        | undefined;
      return Boolean(payload?.data?.valid ?? payload?.valid);
    } catch (error) {
      this.logger.warn(
        `Blockchain service address validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
