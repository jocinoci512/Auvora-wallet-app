import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type ObsIncidentSeverity,
  type ObsIncidentStatus,
  type Prisma,
} from '@auvora/database';
import { IncidentError, NotFoundError } from '../../domain';
import { AuditService } from './audit.service';

@Injectable()
export class IncidentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private async nextCode(): Promise<string> {
    const count = await this.prisma.obsIncident.count();
    return `INC-${String(count + 1).padStart(5, '0')}`;
  }

  async create(input: {
    title: string;
    summary?: string;
    severity?: ObsIncidentSeverity;
    serviceName?: string;
    reporterUserId?: string;
    publicVisible?: boolean;
  }) {
    const code = await this.nextCode();
    const incident = await this.prisma.obsIncident.create({
      data: {
        code,
        title: input.title,
        summary: input.summary,
        severity: input.severity ?? 'SEV3',
        serviceName: input.serviceName,
        reporterUserId: input.reporterUserId,
        publicVisible: input.publicVisible ?? false,
        events: {
          create: {
            eventType: 'created',
            message: 'Incident created',
            actorUserId: input.reporterUserId,
          },
        },
      },
      include: { events: true },
    });
    await this.audit.record('incident.created', {
      actorUserId: input.reporterUserId,
      resourceId: incident.id,
      details: { code },
    });
    return incident;
  }

  async list(filters: { status?: ObsIncidentStatus; publicOnly?: boolean; take?: number } = {}) {
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.publicOnly ? { publicVisible: true } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.obsIncident.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: filters.take ?? 50,
        include: { events: { orderBy: { occurredAt: 'asc' } } },
      }),
      this.prisma.obsIncident.count({ where }),
    ]);
    return { items, total };
  }

  async get(idOrCode: string) {
    const incident = await this.prisma.obsIncident.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
    if (!incident) {
      throw new NotFoundError(`Incident ${idOrCode} not found`);
    }
    return incident;
  }

  private async appendEvent(
    incidentId: string,
    eventType: string,
    message: string,
    actorUserId?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.obsIncidentEvent.create({
      data: {
        incidentId,
        eventType,
        message,
        actorUserId,
        metadata: (metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async assign(id: string, assigneeUserId: string, actorUserId?: string) {
    const incident = await this.get(id);
    const updated = await this.prisma.obsIncident.update({
      where: { id: incident.id },
      data: { assigneeUserId },
      include: { events: true },
    });
    await this.appendEvent(incident.id, 'assigned', `Assigned to ${assigneeUserId}`, actorUserId);
    return updated;
  }

  async acknowledge(id: string, actorUserId?: string) {
    const incident = await this.get(id);
    const updated = await this.prisma.obsIncident.update({
      where: { id: incident.id },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
      include: { events: true },
    });
    await this.appendEvent(incident.id, 'acknowledged', 'Incident acknowledged', actorUserId);
    return updated;
  }

  async escalate(id: string, severity: ObsIncidentSeverity, actorUserId?: string) {
    const incident = await this.get(id);
    const updated = await this.prisma.obsIncident.update({
      where: { id: incident.id },
      data: { severity, status: 'INVESTIGATING' },
      include: { events: true },
    });
    await this.appendEvent(incident.id, 'escalated', `Escalated to ${severity}`, actorUserId);
    return updated;
  }

  async resolve(
    id: string,
    input: { rootCause?: string; postmortem?: string; actorUserId?: string } = {},
  ) {
    const incident = await this.get(id);
    if (incident.status === 'CLOSED') {
      throw new IncidentError('Closed incidents cannot be resolved again');
    }
    const updated = await this.prisma.obsIncident.update({
      where: { id: incident.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        rootCause: input.rootCause,
        postmortem: input.postmortem,
      },
      include: { events: true },
    });
    await this.appendEvent(incident.id, 'resolved', 'Incident resolved', input.actorUserId, {
      rootCause: input.rootCause,
    });
    return updated;
  }
}
