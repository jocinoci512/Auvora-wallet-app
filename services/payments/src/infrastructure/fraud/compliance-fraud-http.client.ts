import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FraudCheckInput, FraudCheckResult, FraudHookPort } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';

/**
 * Calls Compliance Platform internal fraud/policy endpoint.
 * Falls back to allow when COMPLIANCE_SERVICE_URL is unset.
 */
@Injectable()
export class ComplianceFraudHttpClient implements FraudHookPort {
  private readonly logger = new Logger(ComplianceFraudHttpClient.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async checkPayment(input: FraudCheckInput): Promise<FraudCheckResult> {
    const baseUrl = this.env.COMPLIANCE_SERVICE_URL;
    if (!baseUrl) {
      return { allow: true, reasons: ['compliance_not_configured'] };
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/compliance/fraud/check`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-api-key': this.env.INTERNAL_API_KEY,
        },
        body: JSON.stringify({
          ownerUserId: input.ownerUserId,
          amount: input.amount,
          currency: input.currency,
          paymentType: input.paymentType,
          paymentId: input.paymentId,
          metadata: input.metadata,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        this.logger.warn(`Compliance fraud check HTTP ${response.status}`);
        return { allow: false, riskScore: 100, reasons: ['compliance_unavailable'] };
      }
      const payload = (await response.json()) as {
        data?: { allow?: boolean; riskScore?: number; reasons?: string[] };
      };
      return {
        allow: payload.data?.allow !== false,
        riskScore: payload.data?.riskScore,
        reasons: payload.data?.reasons,
      };
    } catch (error) {
      this.logger.warn(
        `Compliance fraud check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { allow: false, riskScore: 100, reasons: ['compliance_error'] };
    }
  }
}
