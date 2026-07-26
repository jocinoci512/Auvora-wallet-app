import { EventIngestService } from './event-ingest.service';

describe('EventIngestService', () => {
  const audit = { record: jest.fn().mockResolvedValue({}) };

  beforeEach(() => jest.clearAllMocks());

  it('ingests a single event and audits', async () => {
    const prisma = {
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1', eventType: 'wallet.created' }),
      },
    };
    const service = new EventIngestService(prisma as never, audit as never);
    const event = await service.ingest({
      eventType: 'wallet.created',
      domain: 'WALLET',
      payload: { walletId: 'w1' },
      metrics: { tx_volume: 1 },
    });
    expect(event.id).toBe('evt-1');
    expect(audit.record).toHaveBeenCalledWith('event.ingested', expect.any(Object));
  });

  it('ingests a batch in a transaction', async () => {
    const prisma = {
      analyticsEvent: {
        create: jest.fn().mockImplementation(({ data }: { data: { eventType: string } }) =>
          Promise.resolve({ id: `evt-${data.eventType}`, ...data }),
        ),
      },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new EventIngestService(prisma as never, audit as never);
    const result = await service.ingestBatch([
      { eventType: 'a', domain: 'WALLET', payload: {} },
      { eventType: 'b', domain: 'WALLET', payload: {} },
    ]);
    expect(result.count).toBe(2);
    expect(audit.record).toHaveBeenCalledWith('event.batch_ingested', expect.any(Object));
  });
});
