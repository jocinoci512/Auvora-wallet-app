import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';

@Injectable()
export class CapacityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(serviceName?: string, take = 100) {
    return this.prisma.obsCapacitySample.findMany({
      where: serviceName ? { serviceName } : undefined,
      orderBy: { observedAt: 'desc' },
      take,
    });
  }

  async latestByService() {
    const samples = await this.prisma.obsCapacitySample.findMany({
      orderBy: { observedAt: 'desc' },
      take: 500,
    });
    const latest = new Map<string, (typeof samples)[number]>();
    for (const sample of samples) {
      if (!latest.has(sample.serviceName)) {
        latest.set(sample.serviceName, sample);
      }
    }
    return [...latest.values()];
  }

  async forecast(serviceName: string, take = 20) {
    const samples = await this.prisma.obsCapacitySample.findMany({
      where: { serviceName },
      orderBy: { observedAt: 'asc' },
      take,
    });
    const series = samples
      .map((s) => s.cpuPercent ?? s.memoryPercent ?? s.queueDepth ?? s.txThroughput)
      .filter((v): v is number => typeof v === 'number');
    if (series.length < 2) {
      return { serviceName, forecastLoad: series[0] ?? null, points: series.length };
    }
    const n = series.length;
    const xs = series.map((_, i) => i);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = series.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * series[i]!, 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);
    const slope = (n * sumXY - sumX * sumY) / Math.max(1, n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    const forecastLoad = intercept + slope * n;
    return { serviceName, forecastLoad, slope, points: n };
  }
}
