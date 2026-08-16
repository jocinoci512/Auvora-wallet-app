import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  MfaRecoveryRecord,
  MfaRecoveryRepositoryPort,
  MfaTotpRecord,
  MfaTotpRepositoryPort,
} from '../../application/ports/mfa.repository.port';

@Injectable()
export class PrismaMfaTotpRepository implements MfaTotpRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<MfaTotpRecord | null> {
    return this.prisma.mfaTotpCredential.findUnique({ where: { userId } });
  }

  async upsertPending(userId: string, secretEncrypted: string): Promise<MfaTotpRecord> {
    return this.prisma.mfaTotpCredential.upsert({
      where: { userId },
      create: { userId, secretEncrypted },
      update: { secretEncrypted, confirmedAt: null, lastUsedStep: null },
    });
  }

  async confirm(userId: string, lastUsedStep: bigint, confirmedAt: Date): Promise<void> {
    await this.prisma.mfaTotpCredential.update({
      where: { userId },
      data: { confirmedAt, lastUsedStep },
    });
  }

  async markUsedStep(userId: string, lastUsedStep: bigint): Promise<void> {
    await this.prisma.mfaTotpCredential.update({
      where: { userId },
      data: { lastUsedStep },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.mfaTotpCredential.deleteMany({ where: { userId } });
  }
}

@Injectable()
export class PrismaMfaRecoveryRepository implements MfaRecoveryRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async replaceAll(userId: string, codeHashes: string[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.createMany({
        data: codeHashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
  }

  async listActiveByUserId(userId: string): Promise<MfaRecoveryRecord[]> {
    return this.prisma.mfaRecoveryCode.findMany({
      where: { userId, consumedAt: null },
    });
  }

  async consume(id: string): Promise<void> {
    await this.prisma.mfaRecoveryCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } });
  }
}
