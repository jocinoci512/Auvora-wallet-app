import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type CustodyPolicyAction, type ApprovalPolicyKind, type Prisma } from '@auvora/database';
import {
  ConflictError,
  evaluatePolicySet,
  NotFoundError,
  resolvePolicyDecision,
  type PolicyContext,
  type PolicyDefinition,
} from '../../domain';

export interface CreateTransactionPolicyInput {
  code: string;
  name: string;
  description?: string;
  action: CustodyPolicyAction;
  priority?: number;
  expression: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface UpdateTransactionPolicyInput {
  name?: string;
  description?: string;
  action?: CustodyPolicyAction;
  priority?: number;
  expression?: Record<string, unknown>;
}

export interface CreateApprovalPolicyInput {
  code: string;
  name: string;
  description?: string;
  kind: ApprovalPolicyKind;
  threshold?: number;
  amountThreshold?: string;
  riskThreshold?: number;
  requiredRoles?: string[];
  signerGroupId?: string;
  expression?: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface UpdateApprovalPolicyInput {
  name?: string;
  description?: string;
  kind?: ApprovalPolicyKind;
  threshold?: number;
  amountThreshold?: string;
  riskThreshold?: number;
  requiredRoles?: string[];
  signerGroupId?: string;
  expression?: Record<string, unknown>;
}

/**
 * CRUD for transaction and approval policies plus the pure policy-engine evaluation entry
 * point. No signing/approval business rules are hardcoded — everything is driven by the
 * persisted JSON expressions configured by administrators.
 */
@Injectable()
export class PolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listTransactionPolicies() {
    return this.prisma.transactionPolicy.findMany({ orderBy: { priority: 'asc' } });
  }

  async getTransactionPolicy(id: string) {
    const policy = await this.prisma.transactionPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundError('Transaction policy not found');
    return policy;
  }

  async createTransactionPolicy(input: CreateTransactionPolicyInput) {
    const existing = await this.prisma.transactionPolicy.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`A transaction policy with code ${input.code} already exists`);
    return this.prisma.transactionPolicy.create({
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

  async updateTransactionPolicy(id: string, input: UpdateTransactionPolicyInput) {
    await this.getTransactionPolicy(id);
    return this.prisma.transactionPolicy.update({
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

  async setTransactionPolicyEnabled(id: string, isEnabled: boolean) {
    await this.getTransactionPolicy(id);
    return this.prisma.transactionPolicy.update({ where: { id }, data: { isEnabled } });
  }

  async listApprovalPolicies() {
    return this.prisma.approvalPolicy.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getApprovalPolicy(id: string) {
    const policy = await this.prisma.approvalPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundError('Approval policy not found');
    return policy;
  }

  async createApprovalPolicy(input: CreateApprovalPolicyInput) {
    const existing = await this.prisma.approvalPolicy.findUnique({ where: { code: input.code } });
    if (existing) throw new ConflictError(`An approval policy with code ${input.code} already exists`);
    return this.prisma.approvalPolicy.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        kind: input.kind,
        threshold: input.threshold ?? 1,
        amountThreshold: input.amountThreshold,
        riskThreshold: input.riskThreshold,
        requiredRoles: input.requiredRoles as Prisma.InputJsonValue | undefined,
        signerGroupId: input.signerGroupId,
        expression: input.expression as Prisma.InputJsonValue | undefined,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  async updateApprovalPolicy(id: string, input: UpdateApprovalPolicyInput) {
    await this.getApprovalPolicy(id);
    return this.prisma.approvalPolicy.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        kind: input.kind,
        threshold: input.threshold,
        amountThreshold: input.amountThreshold,
        riskThreshold: input.riskThreshold,
        requiredRoles: input.requiredRoles as Prisma.InputJsonValue | undefined,
        signerGroupId: input.signerGroupId,
        expression: input.expression as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async setApprovalPolicyEnabled(id: string, isEnabled: boolean) {
    await this.getApprovalPolicy(id);
    return this.prisma.approvalPolicy.update({ where: { id }, data: { isEnabled } });
  }

  /** Finds the best-matching enabled approval policy for a signing context, if any. */
  async findApplicableApprovalPolicy(ctx: PolicyContext) {
    const policies = await this.prisma.approvalPolicy.findMany({ where: { isEnabled: true } });
    const withExpression = policies.filter((policy) => policy.expression);
    const matched = withExpression.find((policy) =>
      evaluatePolicySet(
        [
          {
            code: policy.code,
            name: policy.name,
            action: 'REQUIRE_APPROVAL',
            isEnabled: true,
            priority: 0,
            expression: policy.expression,
          },
        ],
        ctx,
      )[0]?.matched,
    );
    if (matched) return matched;
    return policies.find((policy) => !policy.expression) ?? null;
  }

  async evaluateTransactionContext(ctx: PolicyContext) {
    const policies = await this.prisma.transactionPolicy.findMany({ where: { isEnabled: true } });
    const definitions: PolicyDefinition[] = policies.map((policy) => ({
      code: policy.code,
      name: policy.name,
      action: policy.action,
      isEnabled: policy.isEnabled,
      priority: policy.priority,
      expression: policy.expression,
    }));
    const evaluated = evaluatePolicySet(definitions, ctx);
    return resolvePolicyDecision(evaluated);
  }
}
