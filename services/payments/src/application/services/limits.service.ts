import { Inject, Injectable } from '@nestjs/common';
import { LimitWindow } from '@auvora/database';
import {
  LIMIT_REPOSITORY,
  type LimitRepositoryPort,
  type PaymentLimitRecord,
} from '../ports/limit-repository.port';
import { PAYMENT_REPOSITORY, type PaymentRepositoryPort } from '../ports/payment-repository.port';
import { LimitExceededError } from '../../domain';

export interface LimitCheckInput {
  ownerUserId: string;
  amount: string;
  currency: string;
  accountTier?: string | null;
  country?: string | null;
  riskProfile?: string | null;
}

const WINDOW_MS: Record<LimitWindow, number | null> = {
  [LimitWindow.PER_TRANSACTION]: null,
  [LimitWindow.DAILY]: 24 * 60 * 60 * 1000,
  [LimitWindow.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [LimitWindow.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Evaluates configured `PaymentLimit` rows (per-user, per-tier, per-country,
 * per-risk-profile) against a candidate payment amount before it is created.
 */
@Injectable()
export class LimitsService {
  constructor(
    @Inject(LIMIT_REPOSITORY) private readonly limits: LimitRepositoryPort,
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepositoryPort,
  ) {}

  /** Returns the limits directly scoped to a given user (used by the user-facing "my limits" endpoint). */
  async listForUser(ownerUserId: string): Promise<PaymentLimitRecord[]> {
    return this.limits.findApplicable({ ownerUserId, accountTier: 'standard' });
  }

  async evaluate(input: LimitCheckInput): Promise<void> {
    const applicable = await this.limits.findApplicable({
      ownerUserId: input.ownerUserId,
      // Never trust client-supplied tier alone — default to standard globals.
      accountTier: input.accountTier?.trim() || 'standard',
      country: input.country,
      riskProfile: input.riskProfile,
    });

    if (applicable.length === 0) {
      throw new LimitExceededError(
        'No applicable payment limits are configured; refusing to process payment (fail-closed)',
      );
    }

    for (const limit of applicable) {
      if (!limit.isEnabled) {
        continue;
      }
      if (limit.currency && limit.currency !== input.currency) {
        continue;
      }

      if (limit.window === LimitWindow.PER_TRANSACTION) {
        if (Number(input.amount) > Number(limit.amount)) {
          throw new LimitExceededError(
            `Transaction amount ${input.amount} ${input.currency} exceeds the per-transaction limit of ${limit.amount}`,
          );
        }
        continue;
      }

      const windowMs = WINDOW_MS[limit.window];
      if (!windowMs) {
        continue;
      }

      const since = new Date(Date.now() - windowMs);
      const { total } = await this.payments.sumAmountSince(input.ownerUserId, since);
      const projected = Number(total) + Number(input.amount);
      if (projected > Number(limit.amount)) {
        throw new LimitExceededError(
          `Projected ${limit.window.toLowerCase()} total of ${projected} ${input.currency} would exceed the limit of ${limit.amount}`,
        );
      }
    }
  }
}
