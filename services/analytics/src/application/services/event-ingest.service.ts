import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AnalyticsDomain,
  type Prisma,
} from '@auvora/database';
import { AuditService } from './audit.service';

export interface IngestEventInput {
  eventType: string;
  domain: AnalyticsDomain;
  aggregateId?: string;
  ownerUserId?: string;
  payload: Record<string, unknown>;
  metrics?: Record<string, number>;
  correlationId?: string;
  sourceService?: string;
  occurredAt?: Date;
}

@Injectable()
export class EventIngestService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async ingest(input: IngestEventInput) {
    const event = await this.prisma.analyticsEvent.create({
      data: {
        eventType: input.eventType,
        domain: input.domain,
        aggregateId: input.aggregateId,
        ownerUserId: input.ownerUserId,
        payload: input.payload as Prisma.InputJsonValue,
        metrics: (input.metrics ?? null) as Prisma.InputJsonValue,
        correlationId: input.correlationId,
        sourceService: input.sourceService,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await this.audit.record('event.ingested', {
      resourceType: 'analytics_event',
      resourceId: event.id,
      correlationId: input.correlationId,
      details: { eventType: input.eventType, domain: input.domain },
    });

    return event;
  }

  async ingestBatch(inputs: IngestEventInput[]) {
    const events = await this.prisma.$transaction(
      inputs.map((input) =>
        this.prisma.analyticsEvent.create({
          data: {
            eventType: input.eventType,
            domain: input.domain,
            aggregateId: input.aggregateId,
            ownerUserId: input.ownerUserId,
            payload: input.payload as Prisma.InputJsonValue,
            metrics: (input.metrics ?? null) as Prisma.InputJsonValue,
            correlationId: input.correlationId,
            sourceService: input.sourceService,
            occurredAt: input.occurredAt ?? new Date(),
          },
        }),
      ),
    );

    await this.audit.record('event.batch_ingested', {
      details: { count: events.length },
    });

    return { count: events.length, ids: events.map((event) => event.id) };
  }
}
