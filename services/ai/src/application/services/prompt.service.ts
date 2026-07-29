import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiPromptCategory, type Prisma } from '@auvora/database';
import { ConflictError, NotFoundError, renderPromptParts, ValidationError } from '../../domain';
import { AuditService } from './audit.service';

export interface CreatePromptTemplateInput {
  code: string;
  name: string;
  description?: string;
  category: AiPromptCategory;
  systemPrompt?: string;
  userPrompt: string;
  variables?: Record<string, unknown>;
  modelHint?: string;
  temperature?: number;
  maxTokens?: number;
  createdBy?: string;
}

export interface CreatePromptVersionInput {
  systemPrompt?: string;
  userPrompt: string;
  variables?: Record<string, unknown>;
  modelHint?: string;
  temperature?: number;
  maxTokens?: number;
  changeNotes?: string;
  createdBy?: string;
}

@Injectable()
export class PromptService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async list(filters: { category?: AiPromptCategory; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.AiPromptTemplateWhereInput = filters.category
      ? { category: filters.category }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.aiPromptTemplate.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.aiPromptTemplate.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    const template = await this.prisma.aiPromptTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('Prompt template not found');
    return template;
  }

  async getByCode(code: string) {
    const template = await this.prisma.aiPromptTemplate.findUnique({ where: { code } });
    if (!template) throw new NotFoundError(`Prompt template ${code} not found`);
    return template;
  }

  async getActiveVersion(templateId: string) {
    const template = await this.get(templateId);
    const version = await this.prisma.aiPromptVersion.findUnique({
      where: { templateId_version: { templateId, version: template.currentVersion } },
    });
    if (!version) throw new NotFoundError('Prompt version not found');
    return { template, version };
  }

  /**
   * Resolves the prompt used by the live chat/automation path. Unlike `getActiveVersion` (used by
   * admin preview/rollback, which may legitimately inspect drafts), this enforces the approval
   * gate: only `APPROVED` and enabled templates are ever served to end users. Callers should treat
   * a `NotFoundError` here as "no admin-managed prompt is live yet" and fall back to a built-in
   * default, exactly as unmanaged assistant types already do.
   */
  async getActiveVersionByCode(code: string) {
    const template = await this.getByCode(code);
    if (template.status !== 'APPROVED' || !template.isEnabled) {
      throw new NotFoundError(`Prompt template ${code} has no approved, enabled version`);
    }
    const version = await this.prisma.aiPromptVersion.findUnique({
      where: { templateId_version: { templateId: template.id, version: template.currentVersion } },
    });
    if (!version) throw new NotFoundError('Prompt version not found');
    return { template, version };
  }

  async create(input: CreatePromptTemplateInput) {
    const existing = await this.prisma.aiPromptTemplate.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError(`A prompt template with code ${input.code} already exists`);
    }

    return this.prisma.aiPromptTemplate.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        status: 'DRAFT',
        isEnabled: true,
        currentVersion: 1,
        createdBy: input.createdBy,
        versions: {
          create: {
            version: 1,
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            variables: (input.variables ?? {}) as Prisma.InputJsonValue,
            modelHint: input.modelHint,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            createdBy: input.createdBy,
            changeNotes: 'Initial version',
          },
        },
      },
    });
  }

  /** Adds a new version and resets status to DRAFT — every content change requires re-approval. */
  async createVersion(templateId: string, input: CreatePromptVersionInput, actorUserId?: string) {
    const template = await this.get(templateId);
    const nextVersion = template.currentVersion + 1;

    await this.prisma.aiPromptVersion.create({
      data: {
        templateId,
        version: nextVersion,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        modelHint: input.modelHint,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        createdBy: input.createdBy,
        changeNotes: input.changeNotes,
      },
    });

    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { currentVersion: nextVersion, status: 'DRAFT' },
    });
    await this.audit.record('ai.prompt.version_created', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
      details: { version: nextVersion },
    });
    return updated;
  }

  async listVersions(templateId: string) {
    await this.get(templateId);
    return this.prisma.aiPromptVersion.findMany({
      where: { templateId },
      orderBy: { version: 'desc' },
    });
  }

  async preview(templateId: string, variables: Record<string, unknown>) {
    const { version } = await this.getActiveVersion(templateId);
    return renderPromptParts(
      { systemPrompt: version.systemPrompt, userPrompt: version.userPrompt },
      variables,
    );
  }

  previewRaw(input: {
    systemPrompt?: string;
    userPrompt: string;
    variables: Record<string, unknown>;
  }) {
    return renderPromptParts(
      { systemPrompt: input.systemPrompt, userPrompt: input.userPrompt },
      input.variables,
    );
  }

  /** Moves a DRAFT template into the approval queue. */
  async submitForApproval(templateId: string, actorUserId?: string) {
    const template = await this.get(templateId);
    if (template.status !== 'DRAFT') {
      throw new ValidationError(
        `Cannot submit a template with status ${template.status} for approval`,
      );
    }
    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { status: 'PENDING_APPROVAL' },
    });
    await this.audit.record('ai.prompt.submitted', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
    });
    return updated;
  }

  /** Approves from PENDING_APPROVAL (normal flow) or directly from DRAFT (fast-track/admin override). */
  async approve(templateId: string, actorUserId?: string) {
    const template = await this.get(templateId);
    if (template.status !== 'PENDING_APPROVAL' && template.status !== 'DRAFT') {
      throw new ValidationError(`Cannot approve a template with status ${template.status}`);
    }
    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { status: 'APPROVED' },
    });
    await this.audit.record('ai.prompt.approved', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
    });
    return updated;
  }

  /** Sends a pending template back to DRAFT for rework. */
  async reject(templateId: string, actorUserId?: string) {
    const template = await this.get(templateId);
    if (template.status !== 'PENDING_APPROVAL') {
      throw new ValidationError('Only templates pending approval can be rejected');
    }
    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { status: 'DRAFT' },
    });
    await this.audit.record('ai.prompt.rejected', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
    });
    return updated;
  }

  async archive(templateId: string, actorUserId?: string) {
    await this.get(templateId);
    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { status: 'ARCHIVED', isEnabled: false },
    });
    await this.audit.record('ai.prompt.archived', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
    });
    return updated;
  }

  async setEnabled(templateId: string, isEnabled: boolean, actorUserId?: string) {
    await this.get(templateId);
    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { isEnabled },
    });
    await this.audit.record('ai.prompt.enabled_changed', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
      details: { isEnabled },
    });
    return updated;
  }

  /** Restores a historic version's content as a brand-new version and resets status to DRAFT (requires re-approval). */
  async rollback(templateId: string, toVersion: number, actorUserId?: string) {
    const template = await this.get(templateId);
    const target = await this.prisma.aiPromptVersion.findUnique({
      where: { templateId_version: { templateId, version: toVersion } },
    });
    if (!target) {
      throw new NotFoundError(`Version ${toVersion} not found for prompt template ${templateId}`);
    }
    if (toVersion === template.currentVersion) {
      throw new ValidationError('Cannot roll back to the currently active version');
    }

    const nextVersion = template.currentVersion + 1;
    await this.prisma.aiPromptVersion.create({
      data: {
        templateId,
        version: nextVersion,
        systemPrompt: target.systemPrompt,
        userPrompt: target.userPrompt,
        variables: target.variables as Prisma.InputJsonValue,
        modelHint: target.modelHint,
        temperature: target.temperature,
        maxTokens: target.maxTokens,
        changeNotes: `Rollback to version ${toVersion}`,
      },
    });

    const updated = await this.prisma.aiPromptTemplate.update({
      where: { id: templateId },
      data: { currentVersion: nextVersion, status: 'DRAFT' },
    });
    await this.audit.record('ai.prompt.rolled_back', {
      actorUserId,
      resourceType: 'AiPromptTemplate',
      resourceId: templateId,
      details: { toVersion, newVersion: nextVersion },
    });
    return updated;
  }
}
