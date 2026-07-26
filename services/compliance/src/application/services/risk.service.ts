import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type Prisma, type RiskBand } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ComplianceEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  PERMISSION_COMPLIANCE_ADMIN,
  type RiskFactorInput,
  type RiskScoringProvider,
} from '../../domain';
import { RISK_SCORING_PROVIDER } from '../ports/provider.tokens';

export interface ScoreCustomerInput {
  ownerUserId: string;
  factors: RiskFactorInput;
}

/**
 * Computes and persists composite risk scores for a customer, independent of
 * the KYC submission flow (used for on-demand recompute and the risk dashboard).
 */
@Injectable()
export class RiskService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RISK_SCORING_PROVIDER) private readonly provider: RiskScoringProvider,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async scoreCustomer(input: ScoreCustomerInput) {
    const result = await this.provider.score({
      ownerUserId: input.ownerUserId,
      factors: input.factors as Record<string, number>,
    });

    const profile = await this.prisma.kycProfile.findUnique({ where: { ownerUserId: input.ownerUserId } });

    const record = await this.prisma.riskScoreRecord.create({
      data: {
        profileId: profile?.id,
        ownerUserId: input.ownerUserId,
        score: result.score,
        band: result.band as RiskBand,
        factors: result.factors as Prisma.InputJsonValue,
        providerCode: this.provider.getCode(),
      },
    });

    if (profile) {
      await this.prisma.kycProfile.update({
        where: { id: profile.id },
        data: { riskScore: result.score, riskBand: result.band as RiskBand },
      });
    }

    await this.events.publish({
      type: ComplianceEventType.RiskScoreUpdated,
      aggregateId: profile?.id,
      payload: { ownerUserId: input.ownerUserId, score: result.score, band: result.band },
    });

    return record;
  }

  async getOwn(ownerUserId: string, requester: JwtAccessClaims) {
    this.assertSelfOrAdmin(ownerUserId, requester);
    return this.latest(ownerUserId);
  }

  async latest(ownerUserId: string) {
    return this.prisma.riskScoreRecord.findFirst({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async history(ownerUserId: string, take = 20) {
    return this.prisma.riskScoreRecord.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
    });
  }

  private assertSelfOrAdmin(ownerUserId: string, requester: JwtAccessClaims): void {
    if (ownerUserId !== requester.sub && !requester.permissions.includes(PERMISSION_COMPLIANCE_ADMIN)) {
      throw new ForbiddenError('Access denied');
    }
  }
}
