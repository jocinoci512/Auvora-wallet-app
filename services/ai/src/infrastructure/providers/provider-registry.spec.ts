import { ProviderUnavailableError } from '../../domain';
import { AiProviderRegistry } from './provider-registry';

function buildEnv(overrides: Partial<Record<string, unknown>> = {}) {
  return { ...overrides } as never;
}

function buildPrisma(rows: Array<Record<string, unknown>>) {
  return {
    aiProvider: {
      findMany: jest.fn().mockResolvedValue(rows),
      findUnique: jest.fn().mockImplementation(({ where: { code } }: { where: { code: string } }) =>
        Promise.resolve(rows.find((row) => row['code'] === code) ?? null),
      ),
    },
  };
}

const simRow = { code: 'sim-default', providerType: 'SIMULATOR', defaultModel: 'sim-gpt', baseUrl: null, isEnabled: true, priority: 10 };
const openaiRow = { code: 'openai-default', providerType: 'OPENAI', defaultModel: 'gpt-4o-mini', baseUrl: null, isEnabled: true, priority: 20 };

describe('AiProviderRegistry', () => {
  it('resolves the highest-priority enabled provider when no explicit code is given', async () => {
    const prisma = buildPrisma([simRow]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    const provider = await registry.resolve();
    expect(provider.code).toBe('sim-default');
    expect(provider.type).toBe('SIMULATOR');
  });

  it('throws ProviderUnavailableError when no enabled providers exist', async () => {
    const prisma = buildPrisma([]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    await expect(registry.resolve()).rejects.toThrow(ProviderUnavailableError);
  });

  it('resolves an explicit provider code', async () => {
    const prisma = buildPrisma([simRow, openaiRow]);
    const registry = new AiProviderRegistry(buildEnv({ AI_OPENAI_API_KEY: 'sk-test' }), prisma as never);
    const provider = await registry.resolve('openai-default');
    expect(provider.code).toBe('openai-default');
  });

  it('throws when the explicit provider code is not enabled', async () => {
    const prisma = buildPrisma([{ ...simRow, isEnabled: false }]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    await expect(registry.resolve('sim-default')).rejects.toThrow(ProviderUnavailableError);
  });

  it('degrades OPENAI to an unavailable provider when no API key is configured', async () => {
    const prisma = buildPrisma([openaiRow]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    const provider = await registry.resolve();
    await expect(provider.chat({ messages: [{ role: 'USER', content: 'hi' }] })).rejects.toThrow(
      ProviderUnavailableError,
    );
  });

  it('fails over to the next enabled provider when the first one throws', async () => {
    const prisma = buildPrisma([openaiRow, simRow]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);

    const { result, providerCode } = await registry.resolveWithFailover(async (provider) =>
      provider.chat({ messages: [{ role: 'USER', content: 'hi' }] }),
    );

    expect(providerCode).toBe('sim-default');
    expect(result.content).toContain('[simulator]');
  });

  it('lists a backend for every provider row regardless of enabled state', async () => {
    const prisma = buildPrisma([simRow, { ...openaiRow, isEnabled: false }]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    const all = await registry.listAll();
    expect(all).toHaveLength(2);
  });

  it('throws when resolveWithFailover has no successful provider', async () => {
    const prisma = buildPrisma([openaiRow]);
    const registry = new AiProviderRegistry(buildEnv(), prisma as never);
    await expect(
      registry.resolveWithFailover(async (provider) => provider.chat({ messages: [{ role: 'USER', content: 'hi' }] })),
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
