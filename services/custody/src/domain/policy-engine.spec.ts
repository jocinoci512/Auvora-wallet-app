import {
  evaluateExpression,
  evaluatePolicySet,
  resolvePolicyDecision,
  type PolicyDefinition,
  type PolicyExpression,
} from './policy-engine';

describe('policy-engine', () => {
  it('evaluates gte amount expressions', () => {
    const expr: PolicyExpression = { field: 'amount', op: 'gte', value: 10000 };
    expect(evaluateExpression(expr, { amount: 10000 })).toBe(true);
    expect(evaluateExpression(expr, { amount: 9999 })).toBe(false);
  });

  it('evaluates and/or combinations', () => {
    const expr: PolicyExpression = {
      field: 'riskScore',
      op: 'gte',
      value: 50,
      and: [{ field: 'country', op: 'in', value: ['IR', 'KP'] }],
    };
    expect(evaluateExpression(expr, { riskScore: 60, country: 'IR' })).toBe(true);
    expect(evaluateExpression(expr, { riskScore: 60, country: 'US' })).toBe(false);
  });

  it('evaluates contains and in operators for asset/destination fields', () => {
    expect(evaluateExpression({ field: 'destination', op: 'contains', value: 'mixer' }, { destination: 'known-mixer-addr' })).toBe(true);
    expect(evaluateExpression({ field: 'asset', op: 'in', value: ['BTC', 'ETH'] }, { asset: 'ETH' })).toBe(true);
    expect(evaluateExpression({ field: 'asset', op: 'in', value: ['BTC', 'ETH'] }, { asset: 'SOL' })).toBe(false);
  });

  it('ignores disabled policies and sorts by priority', () => {
    const policies: PolicyDefinition[] = [
      { code: 'B', name: 'B', action: 'ALERT', isEnabled: true, priority: 200, expression: { field: 'amount', op: 'gte', value: 0 } },
      { code: 'A', name: 'A', action: 'DENY', isEnabled: true, priority: 10, expression: { field: 'amount', op: 'gte', value: 0 } },
      { code: 'C', name: 'C', action: 'DENY', isEnabled: false, priority: 1, expression: { field: 'amount', op: 'gte', value: 0 } },
    ];
    const evaluated = evaluatePolicySet(policies, { amount: 5 });
    expect(evaluated.map((e) => e.code)).toEqual(['A', 'B']);
  });

  it('resolves DENY with highest precedence over REQUIRE_APPROVAL/DELAY/ALERT', () => {
    const decision = resolvePolicyDecision([
      { code: 'a', name: 'a', action: 'ALERT', priority: 1, matched: true },
      { code: 'b', name: 'b', action: 'REQUIRE_APPROVAL', priority: 2, matched: true },
      { code: 'c', name: 'c', action: 'DENY', priority: 3, matched: true },
      { code: 'd', name: 'd', action: 'DELAY', priority: 4, matched: true },
    ]);
    expect(decision.action).toBe('DENY');
    expect(decision.matched).toHaveLength(4);
  });

  it('resolves ALLOW when nothing matches', () => {
    const decision = resolvePolicyDecision([
      { code: 'a', name: 'a', action: 'ALERT', priority: 1, matched: false },
    ]);
    expect(decision.action).toBe('ALLOW');
    expect(decision.matched).toHaveLength(0);
  });

  it('resolves REQUIRE_APPROVAL over DELAY and ALERT when DENY absent', () => {
    const decision = resolvePolicyDecision([
      { code: 'a', name: 'a', action: 'ALERT', priority: 1, matched: true },
      { code: 'b', name: 'b', action: 'DELAY', priority: 2, matched: true },
      { code: 'c', name: 'c', action: 'REQUIRE_APPROVAL', priority: 3, matched: true },
    ]);
    expect(decision.action).toBe('REQUIRE_APPROVAL');
  });
});
