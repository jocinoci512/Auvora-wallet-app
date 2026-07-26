import { IncidentService } from './incident.service';

describe('IncidentService', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      obsIncident: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'i1',
          code: 'INC-00001',
          events: [{ eventType: 'created' }],
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'i1',
          code: 'INC-00001',
          status: 'OPEN',
          events: [],
        }),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'i1',
          code: 'INC-00001',
          events: [],
          ...data,
        })),
      },
      obsIncidentEvent: {
        create: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
      ...overrides,
    };
    const audit = { record: jest.fn() };
    return { service: new IncidentService(prisma as never, audit as never), prisma, audit };
  }

  it('creates incident with timeline event', async () => {
    const { service, audit } = buildService();
    const incident = await service.create({ title: 'API outage', reporterUserId: 'u1' });
    expect(incident.code).toBe('INC-00001');
    expect(audit.record).toHaveBeenCalledWith('incident.created', expect.any(Object));
  });

  it('acknowledges incident', async () => {
    const { service, prisma } = buildService();
    const updated = await service.acknowledge('i1', 'u1');
    expect(updated.status).toBe('ACKNOWLEDGED');
    expect(prisma.obsIncidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'acknowledged' }),
      }),
    );
  });

  it('escalates incident severity', async () => {
    const { service, prisma } = buildService();
    const updated = await service.escalate('i1', 'SEV1', 'u1');
    expect(updated.severity).toBe('SEV1');
    expect(prisma.obsIncidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'escalated' }),
      }),
    );
  });

  it('resolves incident with root cause', async () => {
    const { service, prisma } = buildService();
    const updated = await service.resolve('i1', {
      rootCause: 'bad deploy',
      actorUserId: 'u1',
    });
    expect(updated.status).toBe('RESOLVED');
    expect(prisma.obsIncidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'resolved' }),
      }),
    );
  });
});
