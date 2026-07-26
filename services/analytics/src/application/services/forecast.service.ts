import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';
import {
  AnalyticsEventType,
  EVENT_BUS,
  linearTrend,
  metricValuesToTrendPoints,
  NotFoundError,
  type EventBusPort,
} from '../../domain';
import { MetricsService } from './metrics.service';

@Injectable()
export class ForecastService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MetricsService) private readonly metrics: MetricsService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async listModels() {
    return this.prisma.forecastModel.findMany({
      where: { isEnabled: true },
      orderBy: { code: 'asc' },
    });
  }

  async getModel(code: string) {
    const model = await this.prisma.forecastModel.findUnique({ where: { code } });
    if (!model) {
      throw new NotFoundError(`Forecast model not found: ${code}`);
    }
    return model;
  }

  async run(code: string, horizon = 7) {
    const model = await this.getModel(code);
    if (model.algorithm !== 'linear_trend') {
      throw new NotFoundError(`Unsupported forecast algorithm: ${model.algorithm}`);
    }

    const historical = await this.metrics.getValues(model.metricCode, {
      window: 'DAILY',
      take: 30,
    });
    const trend = linearTrend(metricValuesToTrendPoints(historical), horizon);
    const horizonStart = new Date();
    const horizonEnd = new Date();
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizon);

    const result = await this.prisma.forecastResult.create({
      data: {
        modelId: model.id,
        status: 'SUCCEEDED',
        horizonStart,
        horizonEnd,
        points: trend.points as unknown as Prisma.InputJsonValue,
        confidence: 0.75,
        generatedAt: new Date(),
        metadata: {
          slope: trend.slope,
          intercept: trend.intercept,
          algorithm: model.algorithm,
        } as Prisma.InputJsonValue,
      },
    });

    await this.events.publish({
      type: AnalyticsEventType.ForecastGenerated,
      aggregateId: result.id,
      payload: { modelCode: code, horizon },
    });

    return { model, result, trend };
  }

  async latestResult(code: string) {
    const model = await this.getModel(code);
    const result = await this.prisma.forecastResult.findFirst({
      where: { modelId: model.id, status: 'SUCCEEDED' },
      orderBy: { createdAt: 'desc' },
    });
    return { model, result };
  }
}
