import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { LoginOutcome } from '@auvora/database';
import type {
  LoginHistoryRecord,
  LoginHistoryRepositoryPort,
  RecordLoginInput,
} from '../../application/ports/login-history-repository.port';

@Injectable()
export class PrismaLoginHistoryRepository implements LoginHistoryRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: RecordLoginInput): Promise<void> {
    await this.prisma.loginHistory.create({
      data: {
        userId: input.userId,
        email: input.email,
        outcome: input.outcome === 'SUCCESS' ? LoginOutcome.SUCCESS : LoginOutcome.FAILURE,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        reason: input.reason,
      },
    });
  }

  async listByUserId(userId: string, skip = 0, take = 50): Promise<LoginHistoryRecord[]> {
    const records = await this.prisma.loginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.email,
      outcome: r.outcome === LoginOutcome.SUCCESS ? 'SUCCESS' : 'FAILURE',
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      reason: r.reason,
      createdAt: r.createdAt,
    }));
  }
}
