import { AggregationWorkerService } from './aggregation-worker.service';

describe('AggregationWorkerService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not start timer in test environment', () => {
    const env = {
      NODE_ENV: 'test',
      ANALYTICS_AGGREGATION_WORKER_ENABLED: true,
      ANALYTICS_AGGREGATION_POLL_MS: 1000,
    };
    const aggregation = { processPendingEvents: jest.fn() };
    const scheduledReports = { processDueReports: jest.fn() };
    const worker = new AggregationWorkerService(
      env as never,
      aggregation as never,
      scheduledReports as never,
    );
    worker.onModuleInit();
    expect(aggregation.processPendingEvents).not.toHaveBeenCalled();
  });

  it('clears timer on destroy', () => {
    jest.useFakeTimers();
    const env = {
      NODE_ENV: 'development',
      ANALYTICS_AGGREGATION_WORKER_ENABLED: true,
      ANALYTICS_AGGREGATION_POLL_MS: 1000,
    };
    const aggregation = { processPendingEvents: jest.fn().mockResolvedValue(0) };
    const scheduledReports = { processDueReports: jest.fn().mockResolvedValue(0) };
    const worker = new AggregationWorkerService(
      env as never,
      aggregation as never,
      scheduledReports as never,
    );
    worker.onModuleInit();
    worker.onModuleDestroy();
    expect(worker.status().running).toBe(false);
  });
});
