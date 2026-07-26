import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ObsServiceDomain, type Prisma } from '@auvora/database';

@Injectable()
export class DependencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.obsServiceDependency.findMany({ orderBy: { sourceService: 'asc' } });
  }

  async upsert(input: {
    sourceService: string;
    targetService: string;
    dependencyType?: string;
    domain?: ObsServiceDomain;
    isCritical?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.obsServiceDependency.upsert({
      where: {
        sourceService_targetService_dependencyType: {
          sourceService: input.sourceService,
          targetService: input.targetService,
          dependencyType: input.dependencyType ?? 'http',
        },
      },
      create: {
        sourceService: input.sourceService,
        targetService: input.targetService,
        dependencyType: input.dependencyType ?? 'http',
        domain: input.domain ?? 'SYSTEM',
        isCritical: input.isCritical ?? false,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
      update: {
        isCritical: input.isCritical,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async graph() {
    const edges = await this.list();
    const nodes = [...new Set(edges.flatMap((e) => [e.sourceService, e.targetService]))];
    return { nodes: nodes.map((id) => ({ id })), edges };
  }
}
