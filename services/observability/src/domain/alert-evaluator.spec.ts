import { evaluateThreshold } from './alert-evaluator';

describe('alert-evaluator', () => {
  it('evaluates comparisons', () => {
    expect(evaluateThreshold(10, 5, 'gt')).toBe(true);
    expect(evaluateThreshold(5, 5, 'gte')).toBe(true);
    expect(evaluateThreshold(4, 5, 'lt')).toBe(true);
    expect(evaluateThreshold(5, 5, 'lte')).toBe(true);
    expect(evaluateThreshold(5, 5, 'eq')).toBe(true);
    expect(evaluateThreshold(6, 5, 'eq')).toBe(false);
  });
});
