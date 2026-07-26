import {
  AmlAlertSeverity,
  AmlAlertStatus,
  CasePriority,
  CaseStatus,
  PrismaService,
  type Prisma,
} from '@auvora/database';
import { Inject, Injectable } from '@nestjs/common';
import {
  ComplianceEventType,
  EVENT_BUS,
  type EventBusPort,
  type FraudProvider,
  type RuleContext,
} from '../../domain';
import { FRAUD_PROVIDER } from '../ports/provider.tokens';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import { RulesEngineService } from './rules-engine.service';

export interface PolicyEvaluateInput {
  ownerUserId: string;
  amount: string;
  currency: string;
  paymentType?: string;
  paymentId?: string;
  walletId?: string;
  country?: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyEvaluateResult {
  allow: boolean;
  riskScore: number;
  reasons: string[];
  matchedRules: Array<{ code: string; action: string }>;
  alertIds: string[];
}

const BLOCKING_ACTIONS = new Set(['BLOCK', 'HOLD', 'REQUIRE_REVIEW']);
const ALERTING_ACTIONS = new Set(['FLAG', 'HOLD', 'BLOCK', 'OPEN_CASE', 'REQUIRE_REVIEW']);

@Injectable()
export class PolicyGateService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RulesEngineService) private readonly rulesEngine: RulesEngineService,
    @Inject(FRAUD_PROVIDER) private readonly fraud: FraudProvider,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async evaluatePayment(input: PolicyEvaluateInput): Promise<PolicyEvaluateResult> {
    const profile = await this.prisma.kycProfile.findUnique({ where: { ownerUserId: input.ownerUserId } });
    const amount = Number(input.amount);
    const dailyCount = await this.prisma.amlAlert.count({
      where: {
        ownerUserId: input.ownerUserId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const ctx: RuleContext = {
      amount,
      currency: input.currency,
      country: input.country ?? profile?.country ?? undefined,
      riskScore: profile ? Number(profile.riskScore) : 25,
      countryRisk: input.country === 'IR' || input.country === 'KP' ? 95 : 20,
      dailyCount,
      deviceRisk: 15,
      behaviorRisk: 20,
      velocityRisk: Math.min(100, dailyCount * 10),
      transactionRisk: amount >= 10000 ? 60 : 20,
      walletRisk: 15,
      blockchainRisk: 15,
      ipRisk: 10,
      accountRisk: profile?.level === 'NONE' ? 50 : 15,
    };

    const rules = await this.prisma.complianceRule.findMany({ where: { isEnabled: true } });
    const evaluated = this.rulesEngine.evaluateAll(
      rules.map((r) => ({
        code: r.code,
        name: r.name,
        action: String(r.action),
        expression: r.expression,
        isEnabled: r.isEnabled,
        priority: r.priority,
      })),
      ctx,
    );
    const matched = evaluated.filter((r) => r.matched);

    const fraud = await this.fraud.evaluate({
      ownerUserId: input.ownerUserId,
      amount: input.amount,
      currency: input.currency,
      paymentType: input.paymentType,
      metadata: input.metadata,
    });

    const reasons: string[] = [...fraud.reasons];
    const alertIds: string[] = [];
    let allow = fraud.allow;

    for (const rule of matched) {
      reasons.push(`rule:${rule.code}:${rule.action}`);
      if (BLOCKING_ACTIONS.has(rule.action)) {
        allow = false;
      }

      if (ALERTING_ACTIONS.has(rule.action)) {
        const severity =
          rule.action === 'BLOCK'
            ? AmlAlertSeverity.CRITICAL
            : rule.action === 'HOLD'
              ? AmlAlertSeverity.HIGH
              : AmlAlertSeverity.MEDIUM;
        const alert = await this.prisma.amlAlert.create({
          data: {
            ownerUserId: input.ownerUserId,
            paymentId: input.paymentId,
            walletId: input.walletId,
            ruleCode: rule.code,
            severity,
            status: AmlAlertStatus.OPEN,
            title: `AML rule matched: ${rule.name}`,
            description: `Action ${rule.action} for amount ${input.amount} ${input.currency}`,
            amount: input.amount,
            currency: input.currency,
            evidence: { context: ctx } as Prisma.InputJsonValue,
          },
        });
        alertIds.push(alert.id);
        await this.events.publish({
          type: ComplianceEventType.AMLAlertCreated,
          aggregateId: alert.id,
          payload: { ruleCode: rule.code, ownerUserId: input.ownerUserId, severity },
        });

        if (rule.action === 'OPEN_CASE' || rule.action === 'BLOCK') {
          const opened = await this.prisma.complianceCase.create({
            data: {
              reference: `CASE-${this.ids.uuid()}`,
              ownerUserId: input.ownerUserId,
              title: `Auto case for ${rule.code}`,
              description: alert.description,
              status: CaseStatus.OPEN,
              priority:
                severity === AmlAlertSeverity.CRITICAL ? CasePriority.CRITICAL : CasePriority.HIGH,
            },
          });
          await this.prisma.amlAlert.update({
            where: { id: alert.id },
            data: { caseId: opened.id },
          });
          await this.events.publish({
            type: ComplianceEventType.ComplianceCaseOpened,
            aggregateId: opened.id,
            payload: { reference: opened.reference, ruleCode: rule.code },
          });
        }
      }
    }

    if (!fraud.allow) {
      await this.events.publish({
        type: ComplianceEventType.FraudDetected,
        aggregateId: input.paymentId,
        payload: { ownerUserId: input.ownerUserId, reasons: fraud.reasons, riskScore: fraud.riskScore },
      });
    }

    return {
      allow,
      riskScore: Math.max(fraud.riskScore, Number(ctx.riskScore ?? 0)),
      reasons,
      matchedRules: matched.map((m) => ({ code: m.code, action: m.action })),
      alertIds,
    };
  }
}
