import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiProvider } from '@auvora/database';
import type { AiProviderPort, AiProviderTypeCode, ModelRouterPort } from '../../domain';
import { ProviderUnavailableError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { AnthropicHttpProvider } from './anthropic-http.provider';
import { GeminiHttpProvider } from './gemini-http.provider';
import { HttpOpenAiCompatibleProvider } from './http-openai-compatible.provider';
import { SimulatorAiProvider } from './simulator.provider';
import { UnavailableAiProvider } from './unavailable.provider';

const AZURE_API_VERSION = '2024-06-01';

/**
 * Resolves the concrete provider backend for a given `ai_providers` row.
 *
 * Enabled/disabled and ordering live in the DB (`isEnabled`, `priority`) so operators can
 * toggle/reorder providers without a deploy. The concrete backend (simulator vs real HTTP
 * client) is always selected from environment credentials — never from request input — and a
 * provider enabled in the DB without usable credentials degrades to `UnavailableAiProvider`
 * rather than being skipped, so admins can see it listed as unhealthy.
 */
@Injectable()
export class AiProviderRegistry implements ModelRouterPort {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private buildBackend(row: Pick<AiProvider, 'code' | 'providerType' | 'defaultModel' | 'baseUrl'>): AiProviderPort {
    const type = row.providerType as AiProviderTypeCode;
    switch (type) {
      case 'SIMULATOR':
        return new SimulatorAiProvider(row.code, row.defaultModel ?? 'sim-gpt');

      case 'OPENAI': {
        if (!this.env.AI_OPENAI_API_KEY) return new UnavailableAiProvider(row.code, type);
        return new HttpOpenAiCompatibleProvider(row.code, type, {
          baseUrl: row.baseUrl ?? this.env.AI_OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
          apiKey: this.env.AI_OPENAI_API_KEY,
          defaultModel: row.defaultModel ?? 'gpt-4o-mini',
        });
      }

      case 'AZURE_OPENAI': {
        const base = this.env.AI_AZURE_OPENAI_BASE_URL;
        const deployment = this.env.AI_AZURE_OPENAI_DEPLOYMENT;
        if (!this.env.AI_AZURE_OPENAI_API_KEY || !base || !deployment) {
          return new UnavailableAiProvider(row.code, type);
        }
        return new HttpOpenAiCompatibleProvider(row.code, type, {
          baseUrl: `${base.replace(/\/$/, '')}/openai/deployments/${deployment}`,
          apiKey: this.env.AI_AZURE_OPENAI_API_KEY,
          defaultModel: row.defaultModel ?? 'gpt-4o-mini',
          authHeaderName: 'api-key',
          authHeaderPrefix: '',
          extraQuery: `?api-version=${AZURE_API_VERSION}`,
        });
      }

      case 'LOCAL': {
        if (!this.env.AI_LOCAL_LLM_BASE_URL) return new UnavailableAiProvider(row.code, type);
        return new HttpOpenAiCompatibleProvider(row.code, type, {
          baseUrl: row.baseUrl ?? this.env.AI_LOCAL_LLM_BASE_URL,
          apiKey: this.env.AI_LOCAL_LLM_API_KEY,
          defaultModel: row.defaultModel ?? 'local-llm',
        });
      }

      case 'ANTHROPIC': {
        if (!this.env.AI_ANTHROPIC_API_KEY) return new UnavailableAiProvider(row.code, type);
        return new AnthropicHttpProvider(row.code, {
          apiKey: this.env.AI_ANTHROPIC_API_KEY,
          defaultModel: row.defaultModel ?? 'claude-3-5-haiku-latest',
        });
      }

      case 'GEMINI': {
        if (!this.env.AI_GEMINI_API_KEY) return new UnavailableAiProvider(row.code, type);
        return new GeminiHttpProvider(row.code, {
          apiKey: this.env.AI_GEMINI_API_KEY,
          defaultModel: row.defaultModel ?? 'gemini-1.5-flash',
        });
      }

      default:
        return new UnavailableAiProvider(row.code, type);
    }
  }

  private async loadEnabledRows(): Promise<AiProvider[]> {
    return this.prisma.aiProvider.findMany({ where: { isEnabled: true }, orderBy: { priority: 'asc' } });
  }

  async resolve(explicitProviderCode?: string): Promise<AiProviderPort> {
    if (explicitProviderCode) {
      const row = await this.prisma.aiProvider.findUnique({ where: { code: explicitProviderCode } });
      if (!row || !row.isEnabled) {
        throw new ProviderUnavailableError(`Provider ${explicitProviderCode} is not enabled`);
      }
      return this.buildBackend(row);
    }

    const rows = await this.loadEnabledRows();
    const first = rows[0];
    if (!first) {
      throw new ProviderUnavailableError('No enabled AI providers configured');
    }
    return this.buildBackend(first);
  }

  /** Tries the explicit provider (if given), otherwise every enabled provider in priority order, returning the first success. */
  async resolveWithFailover<T>(
    fn: (provider: AiProviderPort) => Promise<T>,
    explicitProviderCode?: string,
  ): Promise<{ result: T; providerCode: string }> {
    if (explicitProviderCode) {
      const provider = await this.resolve(explicitProviderCode);
      return { result: await fn(provider), providerCode: provider.code };
    }

    const rows = await this.loadEnabledRows();
    if (rows.length === 0) {
      throw new ProviderUnavailableError('No enabled AI providers configured');
    }

    let lastError: unknown;
    for (const row of rows) {
      const provider = this.buildBackend(row);
      try {
        const result = await fn(provider);
        return { result, providerCode: provider.code };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new ProviderUnavailableError('All AI providers failed');
  }

  async listAll(): Promise<AiProviderPort[]> {
    const rows = await this.prisma.aiProvider.findMany({ orderBy: { priority: 'asc' } });
    return rows.map((row) => this.buildBackend(row));
  }
}
