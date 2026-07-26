import { NotFoundError } from '../../domain';
import { ForecastService } from './forecast.service';

describe('ForecastService', () => {
  const metrics = {
    getValues: jest.fn().mockResolvedValue([
      { bucketStart: new Date('2026-07-01'), value: 10 },
      { bucketStart: new Date('2026-07-02'), value: 20 },
    ]),
  };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('runs linear_trend forecast and stores result', async () => {
    const prisma = {
      forecastModel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'fm-1',
          code: 'tx_volume_linear',
          metricCode: 'tx_volume',
          algorithm: 'linear_trend',
        }),
        findMany: jest.fn(),
      },
      forecastResult: {
        create: jest.fn().mockResolvedValue({ id: 'fr-1', status: 'SUCCEEDED' }),
        findFirst: jest.fn(),
      },
    };
    const service = new ForecastService(prisma as never, metrics as never, events as never);
    const result = await service.run('tx_volume_linear', 3);
    expect(result.result.status).toBe('SUCCEEDED');
    expect(result.trend.points.length).toBe(3);
  });

  it('throws for unsupported algorithm', async () => {
    const prisma = {
      forecastModel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'fm-1',
          code: 'bad',
          algorithm: 'arima',
        }),
      },
    };
    const service = new ForecastService(prisma as never, metrics as never, events as never);
    await expect(service.run('bad')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns latest forecast result', async () => {
    const prisma = {
      forecastModel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'fm-1', code: 'tx_volume_linear' }),
      },
      forecastResult: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fr-1' }),
      },
    };
    const service = new ForecastService(prisma as never, metrics as never, events as never);
    const latest = await service.latestResult('tx_volume_linear');
    expect(latest.result?.id).toBe('fr-1');
  });
});
