export type RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

export interface PolicyExpression {
  field: string;
  op: RuleOperator;
  value: unknown;
  and?: PolicyExpression[];
  or?: PolicyExpression[];
}

export interface PolicyContext {
  asset?: string;
  amount?: number;
  destination?: string;
  country?: string;
  riskScore?: number;
  walletType?: string;
  userRole?: string;
  time?: number;
  velocity?: number;
  complianceResult?: string;
  [key: string]: unknown;
}

export type PolicyActionCode = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL' | 'DELAY' | 'ALERT';

function compare(left: unknown, op: RuleOperator, right: unknown): boolean {
  if (op === 'in') {
    return Array.isArray(right) && right.includes(left);
  }
  if (op === 'contains') {
    return typeof left === 'string' && typeof right === 'string' && left.includes(right);
  }
  const a = typeof left === 'number' ? left : Number(left);
  const b = typeof right === 'number' ? right : Number(right);
  switch (op) {
    case 'eq':
      return left === right || a === b;
    case 'neq':
      return left !== right && a !== b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
    default:
      return false;
  }
}

/** Evaluates a single JSON-defined policy expression against a runtime context. No business rules are hardcoded here. */
export function evaluateExpression(expression: PolicyExpression, ctx: PolicyContext): boolean {
  const fieldValue = ctx[expression.field];
  const selfMatch = compare(fieldValue, expression.op, expression.value);
  if (expression.and?.length) {
    return selfMatch && expression.and.every((child) => evaluateExpression(child, ctx));
  }
  if (expression.or?.length) {
    return selfMatch || expression.or.some((child) => evaluateExpression(child, ctx));
  }
  return selfMatch;
}

export interface PolicyDefinition {
  code: string;
  name: string;
  action: PolicyActionCode;
  expression: unknown;
  isEnabled: boolean;
  priority: number;
}

export interface EvaluatedPolicy {
  code: string;
  name: string;
  action: PolicyActionCode;
  priority: number;
  matched: boolean;
}

export function evaluatePolicySet(policies: PolicyDefinition[], ctx: PolicyContext): EvaluatedPolicy[] {
  return policies
    .filter((policy) => policy.isEnabled)
    .sort((a, b) => a.priority - b.priority)
    .map((policy) => ({
      code: policy.code,
      name: policy.name,
      action: policy.action,
      priority: policy.priority,
      matched: evaluateExpression(policy.expression as PolicyExpression, ctx),
    }));
}

const ACTION_PRECEDENCE: Record<PolicyActionCode, number> = {
  DENY: 4,
  REQUIRE_APPROVAL: 3,
  DELAY: 2,
  ALERT: 1,
  ALLOW: 0,
};

export interface PolicyDecision {
  action: PolicyActionCode;
  matched: EvaluatedPolicy[];
}

/** Resolves the strongest matched action across all matched policies (DENY beats REQUIRE_APPROVAL beats DELAY beats ALERT beats ALLOW). */
export function resolvePolicyDecision(evaluated: EvaluatedPolicy[]): PolicyDecision {
  const matched = evaluated.filter((policy) => policy.matched);
  if (matched.length === 0) {
    return { action: 'ALLOW', matched: [] };
  }
  const winning = matched.reduce((best, current) =>
    ACTION_PRECEDENCE[current.action] > ACTION_PRECEDENCE[best.action] ? current : best,
  );
  return { action: winning.action, matched };
}
