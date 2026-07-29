import { ConflictError, NotFoundError } from '../../domain';
import { TemplateService } from './template.service';

function buildTemplateRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tpl-1',
    code: 'welcome',
    name: 'Welcome email',
    category: 'AUTH',
    channel: 'EMAIL',
    format: 'TEXT',
    locale: 'en',
    subject: 'Welcome {{name}}',
    body: 'Hi {{name}}, thanks for joining!',
    variables: {},
    isEnabled: true,
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildPrismaMock(templateRow: ReturnType<typeof buildTemplateRow>) {
  return {
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue(templateRow),
      findMany: jest.fn().mockResolvedValue([templateRow]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue(templateRow),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...templateRow, ...data }),
        ),
    },
    notificationTemplateVersion: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([{ version: 1 }]),
    },
  };
}

describe('TemplateService', () => {
  it('creates a template plus its first version', async () => {
    const prisma = buildPrismaMock(buildTemplateRow());
    prisma.notificationTemplate.findUnique.mockResolvedValueOnce(null);
    const service = new TemplateService(prisma as never);

    await service.create({
      code: 'welcome',
      name: 'Welcome email',
      category: 'AUTH' as never,
      channel: 'EMAIL' as never,
      body: 'Hi {{name}}',
    });

    expect(prisma.notificationTemplate.create).toHaveBeenCalled();
    expect(prisma.notificationTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 1 }) }),
    );
  });

  it('rejects creating a duplicate code/channel/locale template', async () => {
    const prisma = buildPrismaMock(buildTemplateRow());
    const service = new TemplateService(prisma as never);

    await expect(
      service.create({
        code: 'welcome',
        name: 'Dup',
        category: 'AUTH' as never,
        channel: 'EMAIL' as never,
        body: 'x',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError for a missing template', async () => {
    const prisma = buildPrismaMock(buildTemplateRow());
    prisma.notificationTemplate.findUnique.mockResolvedValueOnce(null);
    const service = new TemplateService(prisma as never);

    await expect(service.get('missing')).rejects.toThrow(NotFoundError);
  });

  it('creates a new version and increments currentVersion on update', async () => {
    const prisma = buildPrismaMock(buildTemplateRow());
    const service = new TemplateService(prisma as never);

    const updated = await service.update('tpl-1', { body: 'Updated body {{name}}' });

    expect(updated.currentVersion).toBe(2);
    expect(prisma.notificationTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }),
    );
  });

  it('renders a preview using the persisted template body and variables', async () => {
    const prisma = buildPrismaMock(buildTemplateRow());
    const service = new TemplateService(prisma as never);

    const preview = await service.preview('tpl-1', { name: 'Ada' });
    expect(preview).toEqual({ subject: 'Welcome Ada', body: 'Hi Ada, thanks for joining!' });
  });
});
