import { NotFoundError } from '../../domain';
import { ModelRouterService } from './model-router.service';

function buildPrismaMock() {
  const providers = new Map<string, Record<string, unknown>>([
    [
      'sim-default',
      {
        id: 'provider-1',
        code: 'sim-default',
        name: 'Simulator',
        providerType: 'SIMULATOR',
        priority: 10,
        isEnabled: true,
        defaultModel: 'sim-gpt',
        baseUrl: null,
      },
    ],
  ]);

  return {
    aiProvider: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { code: string } }) =>
          Promise.resolve(providers.get(where.code) ?? null),
        ),
      findMany: jest.fn().mockImplementation(() => Promise.resolve([...providers.values()])),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { code: string }; data: Record<string, unknown> }) => {
            const existing = providers.get(where.code) ?? {};
            const updated = { ...existing, ...data };
            providers.set(where.code, updated);
            return Promise.resolve(updated);
          },
        ),
      upsert: jest
        .fn()
        .mockImplementation(
          ({
            where,
            create,
            update,
          }: {
            where: { code: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const existing = providers.get(where.code);
            const record = existing
              ? { ...existing, ...update }
              : { id: `provider-${providers.size + 1}`, ...create };
            providers.set(where.code, record);
            return Promise.resolve(record);
          },
        ),
    },
    __providers: providers,
  };
}

const routerMock = {
  resolve: jest.fn(),
  resolveWithFailover: jest.fn(),
  listAll: jest.fn().mockResolvedValue([]),
};

function buildAuditMock() {
  return { record: jest.fn().mockResolvedValue({}) };
}

describe('ModelRouterService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('setPriority updates priority and writes an audit record', async () => {
    const prisma = buildPrismaMock();
    const audit = buildAuditMock();
    const service = new ModelRouterService(routerMock as never, prisma as never, audit as never);

    const updated = await service.setPriority('sim-default', 5, 'admin-1');
    expect(updated).toMatchObject({ priority: 5 });
    expect(audit.record).toHaveBeenCalledWith(
      'ai.provider.priority_changed',
      expect.objectContaining({
        actorUserId: 'admin-1',
        details: { code: 'sim-default', priority: 5 },
      }),
    );
  });

  it('setPriority throws NotFoundError for an unknown provider code', async () => {
    const prisma = buildPrismaMock();
    const service = new ModelRouterService(
      routerMock as never,
      prisma as never,
      buildAuditMock() as never,
    );
    await expect(service.setPriority('missing', 1)).rejects.toThrow(NotFoundError);
  });

  it('upsertProvider creates a new provider row and writes an audit record', async () => {
    const prisma = buildPrismaMock();
    const audit = buildAuditMock();
    const service = new ModelRouterService(routerMock as never, prisma as never, audit as never);

    const created = await service.upsertProvider(
      {
        code: 'openai-2',
        name: 'Second OpenAI',
        providerType: 'OPENAI',
        priority: 25,
        defaultModel: 'gpt-4o-mini',
      },
      'admin-1',
    );
    expect(created).toMatchObject({ code: 'openai-2', name: 'Second OpenAI', priority: 25 });
    expect(audit.record).toHaveBeenCalledWith(
      'ai.provider.upserted',
      expect.objectContaining({ actorUserId: 'admin-1' }),
    );
  });

  it('upsertProvider updates an existing row without resetting fields the caller omitted', async () => {
    const prisma = buildPrismaMock();
    const service = new ModelRouterService(
      routerMock as never,
      prisma as never,
      buildAuditMock() as never,
    );

    const updated = await service.upsertProvider({
      code: 'sim-default',
      name: 'Simulator Renamed',
      providerType: 'SIMULATOR',
      priority: 10,
    });
    expect(updated).toMatchObject({
      code: 'sim-default',
      name: 'Simulator Renamed',
      defaultModel: 'sim-gpt',
    });
  });

  it('updateProvider applies a partial update (priority and/or name/defaultModel)', async () => {
    const prisma = buildPrismaMock();
    const service = new ModelRouterService(
      routerMock as never,
      prisma as never,
      buildAuditMock() as never,
    );

    const updated = await service.updateProvider('sim-default', { priority: 42 });
    expect(updated).toMatchObject({ priority: 42, name: 'Simulator' });
  });

  it('setEnabled toggles a provider and writes an audit record', async () => {
    const prisma = buildPrismaMock();
    const audit = buildAuditMock();
    const service = new ModelRouterService(routerMock as never, prisma as never, audit as never);

    const disabled = await service.setEnabled('sim-default', false, 'admin-1');
    expect(disabled).toMatchObject({ isEnabled: false });
    expect(audit.record).toHaveBeenCalledWith(
      'ai.provider.enabled_changed',
      expect.objectContaining({ actorUserId: 'admin-1' }),
    );
  });
});
