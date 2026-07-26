import type { JwtAccessClaims } from '@auvora/types';
import { ForbiddenError, NotFoundError } from '../../domain';
import { CaseService } from './case.service';

const CASE_MANAGER: JwtAccessClaims = {
  sub: 'manager-1',
  email: 'manager@auvora.local',
  sessionId: 's1',
  roles: ['admin'],
  permissions: ['compliance:cases' as never],
};

const PLAIN_USER: JwtAccessClaims = {
  sub: 'user-1',
  email: 'user@auvora.local',
  sessionId: 's2',
  roles: [],
  permissions: ['compliance:read' as never],
};

function makeService() {
  const cases = new Map<string, Record<string, unknown>>();
  const prisma = {
    complianceCase: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(Array.from(cases.values()))),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(cases.get(where.id) ?? null),
      ),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const created = { id: 'case-1', status: 'OPEN', ...data };
        cases.set(created.id, created);
        return Promise.resolve(created);
      }),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const updated = { ...(cases.get(where.id) ?? {}), ...data };
        cases.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    complianceCaseNote: { create: jest.fn().mockResolvedValue({ id: 'note-1' }) },
    complianceCaseAttachment: { create: jest.fn().mockResolvedValue({ id: 'attachment-1' }) },
    complianceCaseAudit: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const ids = { uuid: () => 'generated-id' };
  const events = { publish: jest.fn() };
  const crypto = { encrypt: (v: string) => `enc:${v}`, decrypt: (v: string) => v, hash: (v: string) => `hash:${v}` };
  const service = new CaseService(prisma as never, ids as never, events as never, crypto as never);
  return { service, prisma, events };
}

describe('CaseService', () => {
  it('opens a new case and records an audit entry', async () => {
    const { service, prisma, events } = makeService();
    const opened = await service.open({ title: 'Suspicious wire transfer' }, CASE_MANAGER);
    expect(opened.title).toBe('Suspicious wire transfer');
    expect(prisma.complianceCaseAudit.create).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ComplianceCaseOpened' }));
  });

  it('rejects case creation without the cases permission', async () => {
    const { service } = makeService();
    await expect(service.open({ title: 'No permission' }, PLAIN_USER)).rejects.toThrow(ForbiddenError);
  });

  it('assigns a case to an investigator', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 'Case to assign' }, CASE_MANAGER);
    const assigned = await service.assign(opened.id as string, 'investigator-1', CASE_MANAGER);
    expect(assigned).toMatchObject({ assignedToUserId: 'investigator-1', status: 'ASSIGNED' });
  });

  it('adds a note to an existing case', async () => {
    const { service } = makeService();
    const opened = await service.open({ title: 'Case with notes' }, CASE_MANAGER);
    const note = await service.addNote(opened.id as string, 'Reviewed transaction history', CASE_MANAGER);
    expect(note).toMatchObject({ id: 'note-1' });
  });

  it('throws when adding a note to a missing case', async () => {
    const { service } = makeService();
    await expect(service.addNote('missing-case', 'note', CASE_MANAGER)).rejects.toThrow(NotFoundError);
  });

  it('resolves a case and publishes a closed event', async () => {
    const { service, events } = makeService();
    const opened = await service.open({ title: 'Resolvable case' }, CASE_MANAGER);
    const resolved = await service.resolve(opened.id as string, 'False positive', CASE_MANAGER);
    expect(resolved).toMatchObject({ status: 'RESOLVED', resolution: 'False positive' });
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'ComplianceCaseClosed' }));
  });
});
