import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type Prisma, type WebhookDeliveryStatus } from '@auvora/database';
import { ConflictError, ForbiddenError, NotFoundError, resolveFailureOutcome } from '../../domain';
import { FIELD_ENCRYPTION, type FieldEncryptionPort } from '../../infrastructure/crypto/field-encryption.adapter';
import { signWebhookPayload, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_TIMESTAMP_HEADER } from '../../infrastructure/crypto/webhook-signer';

export interface RegisterWebhookInput {
  ownerUserId?: string;
  name: string;
  url: string;
  eventFilters?: string[];
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  eventFilters?: string[];
  isEnabled?: boolean;
  version?: string;
}

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  status: number;
  text(): Promise<string>;
}>;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
  ) {}

  private get fetchImpl(): FetchLike {
    return globalThis.fetch as unknown as FetchLike;
  }

  async register(input: RegisterWebhookInput) {
    const secret = randomBytes(32).toString('base64url');
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        ownerUserId: input.ownerUserId,
        name: input.name,
        url: input.url,
        secretEncrypted: this.crypto.encrypt(secret),
        eventFilters: (input.eventFilters ?? []) as Prisma.InputJsonValue,
      },
    });
    return { ...endpoint, secret };
  }

  async list(ownerUserId?: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: ownerUserId ? { ownerUserId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) throw new NotFoundError('Webhook endpoint not found');
    return endpoint;
  }

  async update(id: string, actor: { sub: string; isAdmin: boolean }, input: UpdateWebhookInput) {
    const endpoint = await this.get(id);
    this.assertSelfOrAdmin(endpoint.ownerUserId, actor);
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        name: input.name,
        url: input.url,
        eventFilters: input.eventFilters as Prisma.InputJsonValue | undefined,
        isEnabled: input.isEnabled,
        version: input.version,
      },
    });
  }

  async disable(id: string) {
    await this.get(id);
    return this.prisma.webhookEndpoint.update({ where: { id }, data: { isEnabled: false } });
  }

  /** Creates a pending delivery for an endpoint and immediately attempts dispatch. */
  async deliver(endpointId: string, eventType: string, payload: Record<string, unknown>) {
    const endpoint = await this.get(endpointId);
    if (!endpoint.isEnabled) {
      return null;
    }
    const filters = (endpoint.eventFilters as string[] | null) ?? [];
    if (filters.length > 0 && !filters.includes(eventType)) {
      return null;
    }

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        endpointId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return this.dispatch(delivery.id);
  }

  /**
   * Wraps the raw event payload in a versioned envelope before signing/sending. This lets
   * subscribers safely evolve their handling of `data` across `apiVersion` bumps without the
   * signature format itself changing.
   */
  private buildEnvelope(delivery: { eventType: string; payload: unknown }, endpointVersion: string) {
    return {
      apiVersion: endpointVersion,
      eventType: delivery.eventType,
      deliveredAt: new Date().toISOString(),
      data: delivery.payload,
    };
  }

  async dispatch(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!delivery) throw new NotFoundError('Webhook delivery not found');

    const envelope = this.buildEnvelope(delivery, delivery.endpoint.version);
    const secret = this.crypto.decrypt(delivery.endpoint.secretEncrypted);
    const rawBody = JSON.stringify(envelope);
    const timestamp = Date.now();
    const signature = signWebhookPayload(secret, rawBody, timestamp);

    try {
      const response = await this.fetchImpl(delivery.endpoint.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: String(timestamp),
        },
        body: rawBody,
      });
      const responseBody = await response.text();
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        return this.prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'SUCCESS',
            attemptCount: { increment: 1 },
            responseCode: response.status,
            responseBody: responseBody.slice(0, 2000),
            signature,
            deliveredAt: new Date(),
          },
        });
      }
      return this.handleFailure(delivery.id, delivery.attemptCount, response.status, responseBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Webhook dispatch failed for ${delivery.id}: ${message}`);
      return this.handleFailure(delivery.id, delivery.attemptCount, undefined, message);
    }
  }

  private async handleFailure(
    deliveryId: string,
    attemptCount: number,
    responseCode: number | undefined,
    responseBody: string | undefined,
  ) {
    const outcome = resolveFailureOutcome(attemptCount, { maxAttempts: 5 });
    const status: WebhookDeliveryStatus = outcome.outcome === 'DEAD_LETTER' ? 'DEAD_LETTER' : 'RETRYING';
    return this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        attemptCount: { increment: 1 },
        responseCode,
        responseBody: responseBody?.slice(0, 2000),
        nextAttemptAt: outcome.nextAttemptAt,
      },
    });
  }

  /**
   * Claims and dispatches a single due webhook retry (mirrors `QueueService.processNext`).
   * Uses the RETRYING -> PENDING status transition as an atomic claim so multiple worker
   * instances never double-dispatch the same delivery.
   */
  async processNextRetry(workerId = 'webhook-worker'): Promise<{ processed: boolean; deliveryId?: string }> {
    const now = new Date();
    const candidates = await this.prisma.webhookDelivery.findMany({
      where: { status: 'RETRYING', nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      take: 25,
    });
    if (candidates.length === 0) {
      return { processed: false };
    }

    for (const candidate of candidates) {
      const claimed = await this.prisma.webhookDelivery.updateMany({
        where: { id: candidate.id, status: 'RETRYING' },
        data: { status: 'PENDING' },
      });
      if (claimed.count === 0) {
        continue;
      }
      this.logger.log(`Webhook retry worker ${workerId} claimed delivery ${candidate.id}`);
      await this.dispatch(candidate.id);
      return { processed: true, deliveryId: candidate.id };
    }

    return { processed: false };
  }

  async retry(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundError('Webhook delivery not found');
    if (delivery.status === 'SUCCESS') {
      throw new ConflictError('Webhook delivery already succeeded');
    }
    return this.dispatch(deliveryId);
  }

  async replay(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundError('Webhook delivery not found');
    const clone = await this.prisma.webhookDelivery.create({
      data: {
        endpointId: delivery.endpointId,
        eventType: delivery.eventType,
        payload: delivery.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
    return this.dispatch(clone.id);
  }

  async listDeliveries(endpointId: string, filters: { skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.WebhookDeliveryWhereInput = { endpointId };
    const [items, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async listLogs(filters: { status?: WebhookDeliveryStatus; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.WebhookDeliveryWhereInput = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.webhookDelivery.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  private assertSelfOrAdmin(ownerUserId: string | null, requester: { sub: string; isAdmin: boolean }) {
    if (ownerUserId !== requester.sub && !requester.isAdmin) {
      throw new ForbiddenError('Access denied');
    }
  }
}
