export type RuleOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

export interface RuleExpression {
  field: string;
  op: RuleOperator;
  value: unknown;
  and?: RuleExpression[];
  or?: RuleExpression[];
}

export interface RuleContext {
  amount?: number;
  currency?: string;
  country?: string;
  asset?: string;
  walletId?: string;
  riskScore?: number;
  countryRisk?: number;
  deviceRisk?: number;
  behaviorRisk?: number;
  velocityRisk?: number;
  transactionRisk?: number;
  walletRisk?: number;
  blockchainRisk?: number;
  ipRisk?: number;
  accountRisk?: number;
  dailyCount?: number;
  dailyVolume?: number;
  [key: string]: unknown;
}

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

export function evaluateExpression(expression: RuleExpression, ctx: RuleContext): boolean {
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

export type RiskFactorKey =
  | 'country'
  | 'device'
  | 'behavior'
  | 'velocity'
  | 'transaction'
  | 'wallet'
  | 'blockchain'
  | 'ip'
  | 'account';

export interface RiskFactorInput {
  country?: number;
  device?: number;
  behavior?: number;
  velocity?: number;
  transaction?: number;
  wallet?: number;
  blockchain?: number;
  ip?: number;
  account?: number;
}

const DEFAULT_WEIGHTS: Record<RiskFactorKey, number> = {
  country: 0.15,
  device: 0.1,
  behavior: 0.15,
  velocity: 0.15,
  transaction: 0.15,
  wallet: 0.1,
  blockchain: 0.1,
  ip: 0.05,
  account: 0.05,
};

export function computeCompositeRiskScore(factors: RiskFactorInput): {
  score: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  normalized: Record<string, number>;
} {
  let weighted = 0;
  let weightSum = 0;
  const normalized: Record<string, number> = {};
  for (const key of Object.keys(DEFAULT_WEIGHTS) as RiskFactorKey[]) {
    const raw = factors[key];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;
    normalized[key] = value;
    weighted += value * DEFAULT_WEIGHTS[key];
    weightSum += DEFAULT_WEIGHTS[key];
  }
  const score = Math.round((weighted / weightSum) * 100) / 100;
  const band =
    score >= 90 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  return { score, band, normalized };
}
