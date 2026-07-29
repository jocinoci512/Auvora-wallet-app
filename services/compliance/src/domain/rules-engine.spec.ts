import { evaluateExpression, computeCompositeRiskScore, type RuleExpression } from './rules-engine';

describe('rules-engine', () => {
  it('evaluates gte amount expressions', () => {
    const expr: RuleExpression = { field: 'amount', op: 'gte', value: 10000 };
    expect(evaluateExpression(expr, { amount: 10000 })).toBe(true);
    expect(evaluateExpression(expr, { amount: 9999 })).toBe(false);
  });

  it('evaluates and/or combinations', () => {
    const expr: RuleExpression = {
      field: 'riskScore',
      op: 'gte',
      value: 50,
      and: [{ field: 'countryRisk', op: 'gte', value: 70 }],
    };
    expect(evaluateExpression(expr, { riskScore: 60, countryRisk: 80 })).toBe(true);
    expect(evaluateExpression(expr, { riskScore: 60, countryRisk: 10 })).toBe(false);
  });

  it('computes composite risk bands', () => {
    expect(computeCompositeRiskScore({ country: 10, device: 10 }).band).toBe('LOW');
    expect(
      computeCompositeRiskScore({
        country: 80,
        device: 80,
        behavior: 80,
        velocity: 80,
        transaction: 80,
      }).band,
    ).toBe('MEDIUM');
    expect(
      computeCompositeRiskScore({
        country: 100,
        device: 100,
        behavior: 100,
        velocity: 100,
        transaction: 100,
        wallet: 100,
        blockchain: 100,
        ip: 100,
        account: 100,
      }).band,
    ).toBe('CRITICAL');
  });
});
