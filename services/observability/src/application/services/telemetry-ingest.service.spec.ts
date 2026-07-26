import { TelemetryIngestService } from './telemetry-ingest.service';

describe('TelemetryIngestService', () => {
  it('masks log payloads on ingest', async () => {
    const prisma = {
      obsLogEntry: {
        create: jest.fn().mockImplementation(async ({ data }) => data),
      },
    };
    const audit = { record: jest.fn() };
    const service = new TelemetryIngestService(prisma as never, audit as never);
    const entry = await service.ingestLog({
      serviceName: 'auth',
      level: 'info',
      message: 'login for user@example.com',
      payload: { password: 'secret', ok: true },
    });
    expect(entry.message).toContain('[REDACTED_EMAIL]');
    expect(entry.payload).toEqual({ password: '[REDACTED]', ok: true });
  });
});
