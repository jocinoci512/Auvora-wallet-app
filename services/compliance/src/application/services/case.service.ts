import { Inject, Injectable } from '@nestjs/common';
import { CaseStatus, PrismaService, type Prisma } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ComplianceEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  NotFoundError,
  PERMISSION_COMPLIANCE_ADMIN,
  PERMISSION_COMPLIANCE_CASES,
} from '../../domain';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';

@Injectable()
export class CaseService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
  ) {}

  async list(filters: { status?: CaseStatus; skip?: number; take?: number }) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.complianceCase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { notes: true, alerts: true },
      }),
      this.prisma.complianceCase.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    const item = await this.prisma.complianceCase.findUnique({
      where: { id },
      include: { notes: true, attachments: true, auditTrail: true, alerts: true },
    });
    if (!item) throw new NotFoundError('Case not found');
    return item;
  }

  async open(
    input: { ownerUserId?: string; title: string; description?: string; priority?: string },
    actor: JwtAccessClaims,
  ) {
    this.assertCases(actor);
    const created = await this.prisma.complianceCase.create({
      data: {
        reference: `CASE-${this.ids.uuid()}`,
        ownerUserId: input.ownerUserId,
        title: input.title,
        description: input.description,
        priority: (input.priority as never) ?? 'MEDIUM',
        openedByUserId: actor.sub,
      },
    });
    await this.audit(created.id, actor.sub, 'CASE_OPENED', { title: input.title });
    await this.events.publish({
      type: ComplianceEventType.ComplianceCaseOpened,
      aggregateId: created.id,
      payload: { reference: created.reference },
    });
    return created;
  }

  async assign(id: string, assigneeUserId: string, actor: JwtAccessClaims) {
    this.assertCases(actor);
    const updated = await this.prisma.complianceCase.update({
      where: { id },
      data: { assignedToUserId: assigneeUserId, status: CaseStatus.ASSIGNED },
    });
    await this.audit(id, actor.sub, 'CASE_ASSIGNED', { assigneeUserId });
    return updated;
  }

  async addNote(id: string, body: string, actor: JwtAccessClaims) {
    this.assertCases(actor);
    await this.get(id);
    const note = await this.prisma.complianceCaseNote.create({
      data: { caseId: id, authorUserId: actor.sub, body },
    });
    await this.audit(id, actor.sub, 'NOTE_ADDED', { noteId: note.id });
    return note;
  }

  async addAttachment(id: string, storageKey: string, actor: JwtAccessClaims, fileName?: string) {
    this.assertCases(actor);
    await this.get(id);
    return this.prisma.complianceCaseAttachment.create({
      data: {
        caseId: id,
        uploadedByUserId: actor.sub,
        storageKeyEncrypted: this.crypto.encrypt(storageKey),
        fileName,
      },
    });
  }

  async resolve(id: string, resolution: string, actor: JwtAccessClaims) {
    this.assertCases(actor);
    const updated = await this.prisma.complianceCase.update({
      where: { id },
      data: {
        status: CaseStatus.RESOLVED,
        resolution,
        resolvedAt: new Date(),
        closedAt: new Date(),
      },
    });
    await this.audit(id, actor.sub, 'CASE_RESOLVED', { resolution });
    await this.events.publish({
      type: ComplianceEventType.ComplianceCaseClosed,
      aggregateId: id,
      payload: { resolution },
    });
    return updated;
  }

  private async audit(
    caseId: string,
    actorUserId: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.complianceCaseAudit.create({
      data: {
        caseId,
        actorUserId,
        action,
        details: (details ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  private assertCases(actor: JwtAccessClaims) {
    if (
      !actor.permissions.includes(PERMISSION_COMPLIANCE_CASES) &&
      !actor.permissions.includes(PERMISSION_COMPLIANCE_ADMIN)
    ) {
      throw new ForbiddenError('Case management permission required');
    }
  }
}
