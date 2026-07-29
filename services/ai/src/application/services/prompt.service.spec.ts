import { ConflictError, NotFoundError, ValidationError } from '../../domain';
import { PromptService } from './prompt.service';

function buildPrismaMock() {
  const templates = new Map<string, Record<string, unknown>>();
  const versions = new Map<string, Record<string, unknown>>();

  return {
    aiPromptTemplate: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id?: string; code?: string } }) => {
          if (where.id) return Promise.resolve(templates.get(where.id) ?? null);
          const found = [...templates.values()].find((t) => t['code'] === where.code);
          return Promise.resolve(found ?? null);
        }),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const id = `tpl-${templates.size + 1}`;
        const { versions: versionCreate, ...rest } = data;
        const record = { id, createdAt: new Date(), updatedAt: new Date(), ...rest };
        templates.set(id, record);
        const versionData = (versionCreate as { create: Record<string, unknown> }).create;
        versions.set(`${id}:${versionData['version']}`, {
          id: `ver-${id}-1`,
          templateId: id,
          createdAt: new Date(),
          ...versionData,
        });
        return Promise.resolve(record);
      }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = templates.get(where.id) ?? {};
            const updated = { ...existing, ...data };
            templates.set(where.id, updated);
            return Promise.resolve(updated);
          },
        ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    aiPromptVersion: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        const key = `${data['templateId']}:${data['version']}`;
        const record = { id: `ver-${key}`, createdAt: new Date(), ...data };
        versions.set(key, record);
        return Promise.resolve(record);
      }),
      findUnique: jest
        .fn()
        .mockImplementation(
          ({
            where,
          }: {
            where: { templateId_version: { templateId: string; version: number } };
          }) => {
            const key = `${where.templateId_version.templateId}:${where.templateId_version.version}`;
            return Promise.resolve(versions.get(key) ?? null);
          },
        ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    __templates: templates,
    __versions: versions,
  };
}

function buildAuditMock() {
  return { record: jest.fn().mockResolvedValue({}) };
}

describe('PromptService', () => {
  it('creates a template with an initial version 1', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);

    const template = await service.create({
      code: 'assistant.test',
      name: 'Test Assistant',
      category: 'SUPPORT' as never,
      userPrompt: '{{message}}',
      systemPrompt: 'You are a test assistant.',
    });

    expect(template).toMatchObject({ code: 'assistant.test', status: 'DRAFT', currentVersion: 1 });
  });

  it('throws ConflictError when creating a template with a duplicate code', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    await service.create({
      code: 'dup',
      name: 'Dup',
      category: 'SUPPORT' as never,
      userPrompt: 'hi',
    });

    await expect(
      service.create({
        code: 'dup',
        name: 'Dup 2',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('creates a new version and bumps currentVersion back to DRAFT', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    const template = await service.create({
      code: 'v-test',
      name: 'V',
      category: 'SUPPORT' as never,
      userPrompt: 'v1',
    });

    const updated = await service.createVersion(template['id'] as string, { userPrompt: 'v2' });
    expect(updated.currentVersion).toBe(2);
    expect(updated.status).toBe('DRAFT');
  });

  it('renders a preview using the active version', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    const template = await service.create({
      code: 'preview-test',
      name: 'Preview',
      category: 'SUPPORT' as never,
      systemPrompt: 'System for {{who}}',
      userPrompt: 'Hello {{name}}',
    });

    const rendered = await service.preview(template['id'] as string, { name: 'Ada', who: 'devs' });
    expect(rendered).toEqual({ systemPrompt: 'System for devs', userPrompt: 'Hello Ada' });
  });

  it('approves and archives a template', async () => {
    const prisma = buildPrismaMock();
    const audit = buildAuditMock();
    const service = new PromptService(prisma as never, audit as never);
    const template = await service.create({
      code: 'lifecycle',
      name: 'L',
      category: 'SUPPORT' as never,
      userPrompt: 'hi',
    });

    const approved = await service.approve(template['id'] as string, 'admin-1');
    expect(approved.status).toBe('APPROVED');
    expect(audit.record).toHaveBeenCalledWith(
      'ai.prompt.approved',
      expect.objectContaining({ actorUserId: 'admin-1' }),
    );

    const archived = await service.archive(template['id'] as string);
    expect(archived.status).toBe('ARCHIVED');
    expect(archived.isEnabled).toBe(false);
  });

  it('rolls back to a historic version by creating a new version with the old content', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    const template = await service.create({
      code: 'rollback-test',
      name: 'R',
      category: 'SUPPORT' as never,
      userPrompt: 'v1 content',
    });
    await service.createVersion(template['id'] as string, { userPrompt: 'v2 content' });

    const rolledBack = await service.rollback(template['id'] as string, 1);
    expect(rolledBack.currentVersion).toBe(3);
    expect(rolledBack.status).toBe('DRAFT');

    const { version } = await service.getActiveVersion(template['id'] as string);
    expect(version.userPrompt).toBe('v1 content');
  });

  it('rejects rolling back to the currently active version', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    const template = await service.create({
      code: 'noop-rollback',
      name: 'N',
      category: 'SUPPORT' as never,
      userPrompt: 'v1',
    });

    await expect(service.rollback(template['id'] as string, 1)).rejects.toThrow(ValidationError);
  });

  it('throws NotFoundError for an unknown template', async () => {
    const prisma = buildPrismaMock();
    const service = new PromptService(prisma as never, buildAuditMock() as never);
    await expect(service.get('missing')).rejects.toThrow(NotFoundError);
  });

  describe('approval workflow', () => {
    it('moves a DRAFT template to PENDING_APPROVAL via submitForApproval', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'submit-test',
        name: 'S',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      });

      const submitted = await service.submitForApproval(template['id'] as string);
      expect(submitted.status).toBe('PENDING_APPROVAL');
    });

    it('rejects submitting a template that is not in DRAFT', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'submit-twice',
        name: 'S',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      });
      await service.submitForApproval(template['id'] as string);

      await expect(service.submitForApproval(template['id'] as string)).rejects.toThrow(
        ValidationError,
      );
    });

    it('rejects a PENDING_APPROVAL template back to DRAFT', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'reject-test',
        name: 'R',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      });
      await service.submitForApproval(template['id'] as string);

      const rejected = await service.reject(template['id'] as string);
      expect(rejected.status).toBe('DRAFT');
    });

    it('rejects calling reject on a template that is not pending approval', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'reject-invalid',
        name: 'R',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      });

      await expect(service.reject(template['id'] as string)).rejects.toThrow(ValidationError);
    });

    it('getActiveVersionByCode only serves APPROVED and enabled templates (the chat/automation gate)', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'gate-test',
        name: 'G',
        category: 'SUPPORT' as never,
        userPrompt: 'hi',
      });

      // Still DRAFT: not servable to the live chat path.
      await expect(service.getActiveVersionByCode('gate-test')).rejects.toThrow(NotFoundError);

      await service.approve(template['id'] as string);
      const { version } = await service.getActiveVersionByCode('gate-test');
      expect(version.userPrompt).toBe('hi');

      // Disabling an approved template also removes it from the live gate.
      await service.setEnabled(template['id'] as string, false);
      await expect(service.getActiveVersionByCode('gate-test')).rejects.toThrow(NotFoundError);
    });

    it('createVersion and rollback reset an APPROVED template back to DRAFT, closing the gate', async () => {
      const prisma = buildPrismaMock();
      const service = new PromptService(prisma as never, buildAuditMock() as never);
      const template = await service.create({
        code: 'regate-test',
        name: 'G',
        category: 'SUPPORT' as never,
        userPrompt: 'v1',
      });
      await service.approve(template['id'] as string);
      await expect(service.getActiveVersionByCode('regate-test')).resolves.toBeDefined();

      await service.createVersion(template['id'] as string, { userPrompt: 'v2' });
      await expect(service.getActiveVersionByCode('regate-test')).rejects.toThrow(NotFoundError);
    });
  });
});
