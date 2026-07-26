import { Injectable } from '@nestjs/common';
import type { FraudCheckInput, FraudCheckResult, FraudHookPort } from '../../domain';

/** Default fraud hook: allows every payment. Replace with a real risk engine integration. */
@Injectable()
export class NoopFraudHookAdapter implements FraudHookPort {
  async checkPayment(_input: FraudCheckInput): Promise<FraudCheckResult> {
    return { allow: true };
  }
}
