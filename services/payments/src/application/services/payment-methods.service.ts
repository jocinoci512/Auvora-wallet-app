import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@auvora/database';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import {
  PAYMENT_METHOD_REPOSITORY,
  type CreatePaymentMethodData,
  type PaymentMethodFilters,
  type PaymentMethodRecord,
  type PaymentMethodRepositoryPort,
} from '../ports/payment-method-repository.port';
import { ForbiddenError, NotFoundError, PERMISSION_PAYMENT_ADMIN } from '../../domain';

export interface CreatePaymentMethodInput extends Omit<
  CreatePaymentMethodData,
  'ownerUserId' | 'metadata'
> {
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaymentMethodsService {
  constructor(
    @Inject(PAYMENT_METHOD_REPOSITORY) private readonly methods: PaymentMethodRepositoryPort,
  ) {}

  async create(ownerUserId: string, input: CreatePaymentMethodInput): Promise<PaymentMethodRecord> {
    if (input.isDefault) {
      await this.methods.clearDefault(ownerUserId);
    }
    return this.methods.create({
      ownerUserId,
      type: input.type,
      label: input.label,
      last4: input.last4,
      country: input.country,
      currency: input.currency,
      isDefault: input.isDefault,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    });
  }

  async listForUser(
    ownerUserId: string,
    filters: PaymentMethodFilters = {},
  ): Promise<{ items: PaymentMethodRecord[]; total: number }> {
    return this.methods.list({ ...filters, ownerUserId });
  }

  async get(id: string, requester: JwtAccessClaims): Promise<PaymentMethodRecord> {
    const method = await this.requireMethod(id);
    this.assertOwnershipOrAdmin(method, requester);
    return method;
  }

  async archive(id: string, requester: JwtAccessClaims): Promise<PaymentMethodRecord> {
    const method = await this.requireMethod(id);
    this.assertOwnershipOrAdmin(method, requester);
    return this.methods.update(id, { isActive: false, archivedAt: new Date() });
  }

  private async requireMethod(id: string): Promise<PaymentMethodRecord> {
    const method = await this.methods.findById(id);
    if (!method) {
      throw new NotFoundError('Payment method not found');
    }
    return method;
  }

  private assertOwnershipOrAdmin(method: PaymentMethodRecord, requester: JwtAccessClaims): void {
    if (
      method.ownerUserId !== requester.sub &&
      !requester.permissions.includes(PERMISSION_PAYMENT_ADMIN as PermissionCode)
    ) {
      throw new ForbiddenError('Access denied');
    }
  }
}
