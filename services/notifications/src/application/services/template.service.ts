import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type NotificationCategory,
  type NotificationChannel,
  type TemplateFormat,
  type Prisma,
} from '@auvora/database';
import { ConflictError, NotFoundError, renderTemplateParts, type TemplateFormatCode } from '../../domain';

export interface CreateTemplateInput {
  code: string;
  name: string;
  description?: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  format?: TemplateFormat;
  locale?: string;
  subject?: string;
  body: string;
  variables?: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  subject?: string;
  body?: string;
  variables?: Record<string, unknown>;
  createdBy?: string;
}

@Injectable()
export class TemplateService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(filters: { category?: NotificationCategory; channel?: NotificationChannel; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.NotificationTemplateWhereInput = {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationTemplate.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notificationTemplate.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    const template = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundError('Notification template not found');
    return template;
  }

  async getByCode(code: string, channel: NotificationChannel, locale = 'en') {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { code_channel_locale: { code, channel, locale } },
    });
    if (!template) throw new NotFoundError(`Notification template ${code}/${channel}/${locale} not found`);
    return template;
  }

  async create(input: CreateTemplateInput) {
    const locale = input.locale ?? 'en';
    const existing = await this.prisma.notificationTemplate.findUnique({
      where: { code_channel_locale: { code: input.code, channel: input.channel, locale } },
    });
    if (existing) {
      throw new ConflictError(`A template with code ${input.code} already exists for ${input.channel}/${locale}`);
    }

    const template = await this.prisma.notificationTemplate.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category,
        channel: input.channel,
        format: input.format ?? 'HTML',
        locale,
        subject: input.subject,
        body: input.body,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
        isEnabled: input.isEnabled ?? true,
        currentVersion: 1,
      },
    });

    await this.prisma.notificationTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        subject: input.subject,
        body: input.body,
        variables: (input.variables ?? {}) as Prisma.InputJsonValue,
      },
    });

    return template;
  }

  async update(id: string, input: UpdateTemplateInput) {
    const template = await this.get(id);
    const nextVersion = template.currentVersion + 1;

    const updated = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        subject: input.subject ?? template.subject,
        body: input.body ?? template.body,
        variables: (input.variables ?? template.variables) as Prisma.InputJsonValue,
        currentVersion: nextVersion,
      },
    });

    await this.prisma.notificationTemplateVersion.create({
      data: {
        templateId: id,
        version: nextVersion,
        subject: updated.subject,
        body: updated.body,
        variables: updated.variables as Prisma.InputJsonValue,
        createdBy: input.createdBy,
      },
    });

    return updated;
  }

  async listVersions(id: string) {
    await this.get(id);
    return this.prisma.notificationTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });
  }

  async setEnabled(id: string, isEnabled: boolean) {
    await this.get(id);
    return this.prisma.notificationTemplate.update({ where: { id }, data: { isEnabled } });
  }

  async preview(id: string, variables: Record<string, unknown>) {
    const template = await this.get(id);
    return renderTemplateParts(
      { subject: template.subject ?? undefined, body: template.body },
      variables,
      template.format as TemplateFormatCode,
    );
  }

  previewRaw(input: { subject?: string; body: string; format?: TemplateFormatCode; variables: Record<string, unknown> }) {
    return renderTemplateParts(
      { subject: input.subject, body: input.body },
      input.variables,
      input.format ?? 'TEXT',
    );
  }
}
