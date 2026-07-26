import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AnalyticsDomain, type Prisma } from '@auvora/database';
import { evaluateKpi, ForbiddenError, NotFoundError } from '../../domain';
import { MetricsService } from './metrics.service';

@Injectable()
export class KpiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
  ) {}

  async list(filters: { domain?: AnalyticsDomain; enabledOnly?: boolean } = {}) {
    return this.prisma.kpiDefinition.findMany({
      where: {
        domain: filters.domain,
        isEnabled: filters.enabledOnly ? true : undefined,
      },
      orderBy: { code: 'asc' },
    });
  }

  async get(code: string) {
    const kpi = await this.prisma.kpiDefinition.findUnique({ where: { code } });
    if (!kpi) {
      throw new NotFoundError(`KPI not found: ${code}`);
    }
    return kpi;
  }

  async create(input: {
    code: string;
    name: string;
    description?: string;
    domain: AnalyticsDomain;
    metricCode: string;
    targetValue?: number;
    warningThreshold?: number;
    criticalThreshold?: number;
    higherIsBetter?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    await this.metrics.getDefinition(input.metricCode);
    return this.prisma.kpiDefinition.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        domain: input.domain,
        metricCode: input.metricCode,
        targetValue: input.targetValue,
        warningThreshold: input.warningThreshold,
        criticalThreshold: input.criticalThreshold,
        higherIsBetter: input.higherIsBetter ?? true,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    code: string,
    input: Partial<{
      name: string;
      description: string;
      targetValue: number;
      warningThreshold: number;
      criticalThreshold: number;
      higherIsBetter: boolean;
      isEnabled: boolean;
      metadata: Record<string, unknown>;
    }>,
  ) {
    await this.get(code);
    return this.prisma.kpiDefinition.update({
      where: { code },
      data: {
        ...input,
        metadata: input.metadata === undefined ? undefined : (input.metadata as Prisma.InputJsonValue),
      },
    });
  }

  async evaluate(code: string) {
    const kpi = await this.get(code);
    const latest = await this.metrics.getLatestValue(kpi.metricCode, 'DAILY');
    const evaluation = evaluateKpi({
      currentValue: latest?.value ?? null,
      targetValue: kpi.targetValue,
      warningThreshold: kpi.warningThreshold,
      criticalThreshold: kpi.criticalThreshold,
      higherIsBetter: kpi.higherIsBetter,
    });
    return { kpi, latest, evaluation };
  }

  assertCanManage(isAdmin: boolean): void {
    if (!isAdmin) {
      throw new ForbiddenError('KPI management requires admin permissions');
    }
  }
}
