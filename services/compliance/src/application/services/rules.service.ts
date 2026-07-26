import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ComplianceRuleAction, type Prisma } from '@auvora/database';
import { ConflictError, NotFoundError } from '../../domain';

export interface CreateRuleInput {
  code: string;
  name: string;
  description?: string;
  action: ComplianceRuleAction;
  priority?: number;
  expression: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  action?: ComplianceRuleAction;
  priority?: number;
  expression?: Record<string, unknown>;
}

/** Admin CRUD for the compliance rules engine's persisted rule set. */
@Injectable()
export class RulesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.complianceRule.findMany({ orderBy: { priority: 'asc' } });
  }

  async get(id: string) {
    return this.getOrThrow(id);
  }

  async create(input: CreateRuleInput) {
    const existing = await this.prisma.complianceRule.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError(`A rule with code ${input.code} already exists`);
    }
    return this.prisma.complianceRule.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        action: input.action,
        priority: input.priority ?? 100,
        expression: input.expression as Prisma.InputJsonValue,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  async update(id: string, input: UpdateRuleInput) {
    await this.getOrThrow(id);
    return this.prisma.complianceRule.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        action: input.action,
        priority: input.priority,
        expression: input.expression as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async setEnabled(id: string, isEnabled: boolean) {
    await this.getOrThrow(id);
    return this.prisma.complianceRule.update({ where: { id }, data: { isEnabled } });
  }

  private async getOrThrow(id: string) {
    const rule = await this.prisma.complianceRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundError('Compliance rule not found');
    }
    return rule;
  }
}
