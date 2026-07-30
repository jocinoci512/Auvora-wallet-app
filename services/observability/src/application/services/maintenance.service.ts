import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';

@Injectable()
export class MaintenanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listActive() {
    const now = new Date();
    return this.prisma.obsMaintenanceNotice.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  listAll() {
    return this.prisma.obsMaintenanceNotice.findMany({ orderBy: { startsAt: 'desc' } });
  }

  create(input: {
    title: string;
    message: string;
    severity?: string;
    startsAt: Date;
    endsAt?: Date;
    isActive?: boolean;
  }) {
    return this.prisma.obsMaintenanceNotice.create({
      data: {
        title: input.title,
        message: input.message,
        severity: input.severity ?? 'info',
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive ?? true,
      },
    });
  }

  async setActive(id: string, isActive: boolean) {
    return this.prisma.obsMaintenanceNotice.update({
      where: { id },
      data: {
        isActive,
        ...(isActive ? {} : { endsAt: new Date() }),
      },
    });
  }
}
