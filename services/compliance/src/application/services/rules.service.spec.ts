import { ConflictError, NotFoundError } from '../../domain';
import { RulesService } from './rules.service';

function makeService(rules: Array<Record<string, unknown>> = []) {
  const store = new Map(rules.map((rule) => [rule.id as string, rule]));
  const prisma = {
    complianceRule: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(store.values()))),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id) return Promise.resolve(store.get(where.id) ?? null);
        return Promise.resolve(Array.from(store.values()).find((r) => r.code === where.code) ?? null);
      }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: `rule-${store.size + 1}`, ...data };
        store.set(created.id, created);
        return Promise.resolve(created);
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = store.get(where.id) ?? {};
        const updated = { ...existing, ...data };
        store.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
  };
  const service = new RulesService(prisma as never);
  return { service, prisma };
}

describe('RulesService', () => {
  it('creates a new rule with defaults', async () => {
    const { service } = makeService();
    const rule = await service.create({
      code: 'test-rule',
      name: 'Test Rule',
      action: 'FLAG' as never,
      expression: { field: 'amount', op: 'gte', value: 100 },
    });
    expect(rule).toMatchObject({ code: 'test-rule', isEnabled: true, priority: 100 });
  });

  it('rejects duplicate rule codes', async () => {
    const { service } = makeService([{ id: 'rule-1', code: 'dup-rule' }]);
    await expect(
      service.create({
        code: 'dup-rule',
        name: 'Duplicate',
        action: 'FLAG' as never,
        expression: {},
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('lists rules ordered by priority', async () => {
    const { service, prisma } = makeService([{ id: 'rule-1', priority: 10 }]);
    await service.list();
    expect(prisma.complianceRule.findMany).toHaveBeenCalledWith({ orderBy: { priority: 'asc' } });
  });

  it('throws when updating a missing rule', async () => {
    const { service } = makeService();
    await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing rule', async () => {
    const { service } = makeService([{ id: 'rule-1', code: 'r1', name: 'Old' }]);
    const updated = await service.update('rule-1', { name: 'New name' });
    expect(updated).toMatchObject({ name: 'New name' });
  });

  it('enables and disables a rule', async () => {
    const { service } = makeService([{ id: 'rule-1', code: 'r1', isEnabled: true }]);
    const disabled = await service.setEnabled('rule-1', false);
    expect(disabled).toMatchObject({ isEnabled: false });
    const enabled = await service.setEnabled('rule-1', true);
    expect(enabled).toMatchObject({ isEnabled: true });
  });

  it('throws when disabling a missing rule', async () => {
    const { service } = makeService();
    await expect(service.setEnabled('missing', false)).rejects.toThrow(NotFoundError);
  });
});
