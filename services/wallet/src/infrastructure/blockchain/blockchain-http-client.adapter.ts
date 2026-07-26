import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { BlockchainHttpClientPort } from './blockchain-client.port';

interface ValidateAddressResponse {
  data?: { valid?: boolean };
  valid?: boolean;
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
      const ok = localFormatValidateAddress(chain, address);
      if (!ok) {
        this.logger.debug(
          `Local format validation rejected address for chain=${chain} (blockchain URL unset)`,
        );
      }
      return ok;
    }

    try {
      const response = await fetch(
        `${this.baseUrl.replace(/\/$/, '')}/api/v1/blockchain/addresses/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain, address }),
          signal: AbortSignal.timeout(5_000),
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
