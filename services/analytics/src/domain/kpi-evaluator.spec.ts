import { evaluateKpi } from './kpi-evaluator';

describe('kpi-evaluator', () => {
  it('marks higher-is-better KPI as ok when above target', () => {
    const result = evaluateKpi({
      currentValue: 120,
      targetValue: 100,
      warningThreshold: 90,
      criticalThreshold: 80,
      higherIsBetter: true,
    });
    expect(result.status).toBe('ok');
    expect(result.delta).toBe(20);
  });

  it('marks higher-is-better KPI as warning below warning threshold', () => {
    const result = evaluateKpi({
      currentValue: 85,
      targetValue: 100,
      warningThreshold: 90,
      criticalThreshold: 80,
      higherIsBetter: true,
    });
    expect(result.status).toBe('warning');
  });

  it('marks higher-is-better KPI as critical below critical threshold', () => {
    const result = evaluateKpi({
      currentValue: 70,
      targetValue: 100,
      warningThreshold: 90,
      criticalThreshold: 80,
      higherIsBetter: true,
    });
    expect(result.status).toBe('critical');
  });

  it('marks lower-is-better KPI as ok when below thresholds', () => {
    const result = evaluateKpi({
      currentValue: 0.01,
      targetValue: 0.05,
      warningThreshold: 0.03,
      criticalThreshold: 0.04,
      higherIsBetter: false,
    });
    expect(result.status).toBe('ok');
  });

  it('returns unknown when current value missing', () => {
    const result = evaluateKpi({
      currentValue: null,
      targetValue: 100,
      warningThreshold: 90,
      criticalThreshold: 80,
      higherIsBetter: true,
    });
    expect(result.status).toBe('unknown');
  });

  it('computes progress ratio against target', () => {
    const result = evaluateKpi({
      currentValue: 50,
      targetValue: 100,
      warningThreshold: null,
      criticalThreshold: null,
      higherIsBetter: true,
    });
    expect(result.progressRatio).toBe(0.5);
  });
});
