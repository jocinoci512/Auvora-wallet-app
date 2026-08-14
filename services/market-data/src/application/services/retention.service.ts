import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';

const BATCH_SIZE = 1_000;
// Bound work per run so retention never turns into a long table-locking sweep.
const MAX_BATCHES_PER_RUN = 50;

/**
 * Conservative, batched retention for append-only market history tables.
 *
 * Deletes rows older than a configurable cutoff in small ID-keyed batches so it
 * never issues a broad unbounded DELETE, never locks the whole table, and never
 * blocks API requests. Runs from a background worker; safe to run repeatedly.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private cutoff(days: number): Date {
    return new Date(Date.now() - days * 86_400_000);
  }

  async prunePriceQuotes(): Promise<number> {
    const cutoff = this.cutoff(this.env.MARKET_DATA_PRICE_RETENTION_DAYS);
    let deleted = 0;
    for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
      const rows = await this.prisma.priceQuote.findMany({
        where: { asOf: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;
      const result = await this.prisma.priceQuote.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      deleted += result.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return deleted;
  }

  async prunePortfolioSnapshots(): Promise<number> {
    const cutoff = this.cutoff(this.env.MARKET_DATA_PORTFOLIO_RETENTION_DAYS);
    let deleted = 0;
    for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
      const rows = await this.prisma.portfolioValueSnapshot.findMany({
        where: { asOf: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (rows.length === 0) break;
      const result = await this.prisma.portfolioValueSnapshot.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      deleted += result.count;
      if (rows.length < BATCH_SIZE) break;
    }
    return deleted;
  }

  async prune(): Promise<{ priceQuotes: number; portfolioSnapshots: number }> {
    const priceQuotes = await this.prunePriceQuotes();
    const portfolioSnapshots = await this.prunePortfolioSnapshots();
    if (priceQuotes > 0 || portfolioSnapshots > 0) {
      this.logger.log(
        `Retention pruned priceQuotes=${priceQuotes} portfolioSnapshots=${portfolioSnapshots}`,
      );
    }
    return { priceQuotes, portfolioSnapshots };
  }
}
