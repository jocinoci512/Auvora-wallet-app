import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';

export const CUSTODY_SIGNING_CLIENT = Symbol('CUSTODY_SIGNING_CLIENT');

export interface CustodySignInput {
  keyId: string;
  payload: string;
  amount?: string;
  asset?: string;
  destination?: string;
  metadata?: Record<string, unknown>;
}

export interface CustodySignResult {
  signed: boolean;
  signature?: string;
  signingRequestId?: string;
  reasons?: string[];
}

export interface CustodySigningPort {
  sign(input: CustodySignInput): Promise<CustodySignResult>;
}

@Injectable()
export class NoopCustodySigningAdapter implements CustodySigningPort {
  async sign(): Promise<CustodySignResult> {
    return { signed: false, reasons: ['custody_not_configured'] };
  }
}

/**
 * Optional HTTP client to custody internal sign API.
 * When CUSTODY_SERVICE_URL is unset, NoopCustodySigningAdapter is used.
 */
@Injectable()
export class CustodySigningHttpClient implements CustodySigningPort {
  private readonly logger = new Logger(CustodySigningHttpClient.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async sign(input: CustodySignInput): Promise<CustodySignResult> {
    const baseUrl = this.env.CUSTODY_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      return { signed: false, reasons: ['custody_not_configured'] };
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/custody/sign`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': apiKey,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        this.logger.warn(`Custody sign HTTP ${response.status}`);
        return { signed: false, reasons: ['custody_unavailable'] };
      }
      const payload = (await response.json()) as {
        data?: { id?: string; signature?: string; status?: string };
      };
      const signature = payload.data?.signature;
      return {
        signed: Boolean(signature),
        signature,
        signingRequestId: payload.data?.id,
        reasons: signature ? undefined : ['custody_unsigned'],
      };
    } catch (error) {
      this.logger.warn(
        `Custody sign failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { signed: false, reasons: ['custody_error'] };
    }
  }
}
