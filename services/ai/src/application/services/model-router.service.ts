import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiProvider } from '@auvora/database';
import {
  NotFoundError,
  type AiProviderPort,
  type AiProviderTypeCode,
  type ModelRouterPort,
} from '../../domain';
import { MODEL_ROUTER } from '../ports/provider.tokens';
import { AuditService } from './audit.service';

export interface ProviderStatusEntry {
  code: string;
  name: string;
  providerType: string;
  isEnabled: boolean;
  priority: number;
  defaultModel: string | null;
  healthStatus: string;
  lastCheckedAt: Date | null;
}

export interface UpsertProviderInput {
  code: string;
  name: string;
  providerType: AiProviderTypeCode;
  priority: number;
  defaultModel?: string;
  baseUrl?: string;
  isEnabled?: boolean;
}

export interface UpdateProviderInput {
  priority?: number;
  name?: string;
  defaultModel?: string;
}

/**
 * Owns the `ai_providers` config table. Rows here are pure configuration (priority, enablement,
 * default model, base URL); the concrete backend is selected at request time by
 * `AiProviderRegistry.buildBackend` based on `providerType`.
 *
 * Governance note: `upsertProvider`/`updateProvider` let operators add or reconfigure a provider
 * row for an *existing* `providerType` (e.g. a second OpenAI-compatible endpoint) with no code
 * change or deploy. Introducing a brand-new `providerType` value still requires a matching case in
 * `AiProviderRegistry.buildBackend` (services/ai/src/infrastructure/providers/provider-registry.ts)
 * plus a deploy — these methods cannot make an unrecognized type functional on their own.
 */
@Injectable()
export class ModelRouterService {
  constructor(
    @Inject(MODEL_ROUTER) private readonly router: ModelRouterPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async selectProvider(explicitProviderCode?: string): Promise<AiProviderPort> {
    return this.router.resolve(explicitProviderCode);
  }

  async withFailover<T>(
    fn: (provider: AiProviderPort) => Promise<T>,
    explicitProviderCode?: string,
  ): Promise<{ result: T; providerCode: string }> {
    return this.router.resolveWithFailover(fn, explicitProviderCode);
  }

  async status(): Promise<ProviderStatusEntry[]> {
    const rows = await this.prisma.aiProvider.findMany({ orderBy: { priority: 'asc' } });
    return rows.map((row) => ({
      code: row.code,
      name: row.name,
      providerType: row.providerType,
      isEnabled: row.isEnabled,
      priority: row.priority,
      defaultModel: row.defaultModel,
      healthStatus: row.healthStatus,
      lastCheckedAt: row.lastCheckedAt,
    }));
  }

  async refreshHealth(): Promise<Array<{ code: string; healthy: boolean; details?: string }>> {
    const providers = await this.router.listAll();
    const results = await Promise.all(
      providers.map(async (provider) => ({ provider, health: await provider.health() })),
    );
    await Promise.all(
      results.map(({ provider, health }) =>
        this.prisma.aiProvider.update({
          where: { code: provider.code },
          data: {
            healthStatus: health.healthy ? 'HEALTHY' : 'UNAVAILABLE',
            lastCheckedAt: health.checkedAt,
          },
        }),
      ),
    );
    return results.map(({ provider, health }) => ({
      code: provider.code,
      healthy: health.healthy,
      details: health.details,
    }));
  }

  private async requireProvider(code: string): Promise<AiProvider> {
    const provider = await this.prisma.aiProvider.findUnique({ where: { code } });
    if (!provider) throw new NotFoundError(`AI provider ${code} not found`);
    return provider;
  }

  async setEnabled(code: string, isEnabled: boolean, actorUserId?: string) {
    const provider = await this.requireProvider(code);
    const updated = await this.prisma.aiProvider.update({ where: { code }, data: { isEnabled } });
    await this.audit.record('ai.provider.enabled_changed', {
      actorUserId,
      resourceType: 'AiProvider',
      resourceId: provider.id,
      details: { code, isEnabled },
    });
    return updated;
  }

  /**
   * Creates or reconfigures a provider row without a code change. See the class-level governance
   * note: new rows of an existing `providerType` are config-only; a new `providerType` value is not.
   */
  async upsertProvider(input: UpsertProviderInput, actorUserId?: string) {
    const provider = await this.prisma.aiProvider.upsert({
      where: { code: input.code },
      create: {
        code: input.code,
        name: input.name,
        providerType: input.providerType,
        priority: input.priority,
        defaultModel: input.defaultModel,
        baseUrl: input.baseUrl,
        isEnabled: input.isEnabled ?? false,
      },
      update: {
        name: input.name,
        providerType: input.providerType,
        ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      },
    });
    await this.audit.record('ai.provider.upserted', {
      actorUserId,
      resourceType: 'AiProvider',
      resourceId: provider.id,
      details: { code: input.code, providerType: input.providerType, priority: input.priority },
    });
    return provider;
  }

  /** Partial config update used by the admin `PATCH providers/:code` route (priority and/or name/defaultModel). */
  async updateProvider(code: string, input: UpdateProviderInput, actorUserId?: string) {
    const provider = await this.requireProvider(code);
    const updated = await this.prisma.aiProvider.update({
      where: { code },
      data: {
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.defaultModel !== undefined ? { defaultModel: input.defaultModel } : {}),
      },
    });
    await this.audit.record('ai.provider.updated', {
      actorUserId,
      resourceType: 'AiProvider',
      resourceId: provider.id,
      details: { code, ...input },
    });
    return updated;
  }

  async setPriority(code: string, priority: number, actorUserId?: string) {
    const provider = await this.requireProvider(code);
    const updated = await this.prisma.aiProvider.update({ where: { code }, data: { priority } });
    await this.audit.record('ai.provider.priority_changed', {
      actorUserId,
      resourceType: 'AiProvider',
      resourceId: provider.id,
      details: { code, priority },
    });
    return updated;
  }
}
