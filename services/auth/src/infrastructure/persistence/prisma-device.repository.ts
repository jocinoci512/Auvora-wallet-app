import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  DeviceRecord,
  DeviceRepositoryPort,
  UpsertDeviceInput,
} from '../../application/ports/device-repository.port';

@Injectable()
export class PrismaDeviceRepository implements DeviceRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByFingerprint(userId: string, fingerprint: string): Promise<DeviceRecord | null> {
    return this.prisma.device.findUnique({
      where: { userId_fingerprint: { userId, fingerprint } },
    });
  }

  async upsert(input: UpsertDeviceInput): Promise<DeviceRecord> {
    return this.prisma.device.upsert({
      where: { userId_fingerprint: { userId: input.userId, fingerprint: input.fingerprint } },
      create: {
        userId: input.userId,
        fingerprint: input.fingerprint,
        name: input.name,
        platform: input.platform,
        appVersion: input.appVersion,
        userAgent: input.userAgent,
      },
      update: {
        name: input.name,
        platform: input.platform,
        appVersion: input.appVersion,
        userAgent: input.userAgent,
        lastSeenAt: new Date(),
        revokedAt: null,
      },
    });
  }

  async listByUserId(userId: string): Promise<DeviceRecord[]> {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async revoke(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });
  }

  async touch(deviceId: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }
}
