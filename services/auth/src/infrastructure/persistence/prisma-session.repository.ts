import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  CreateSessionInput,
  SessionRecord,
  SessionRepositoryPort,
} from '../../application/ports/session-repository.port';

@Injectable()
export class PrismaSessionRepository implements SessionRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        surface: input.surface ?? 'consumer',
      },
    });
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async listByUserId(userId: string): Promise<SessionRecord[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllForUserSurface(userId: string, surface: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, surface, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async extend(sessionId: string, expiresAt: Date): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { expiresAt } });
  }

  async markMfaSatisfied(sessionId: string, at: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { mfaSatisfiedAt: at },
    });
  }

  async setStepUpExpiresAt(sessionId: string, expiresAt: Date | null): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { stepUpExpiresAt: expiresAt },
    });
  }

  async countActiveByUserId(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }
}
