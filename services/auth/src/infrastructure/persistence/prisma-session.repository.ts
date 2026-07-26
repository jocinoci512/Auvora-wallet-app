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
    return this.prisma.session.create({ data: input });
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

  async extend(sessionId: string, expiresAt: Date): Promise<void> {
    await this.prisma.session.update({ where: { id: sessionId }, data: { expiresAt } });
  }
}
