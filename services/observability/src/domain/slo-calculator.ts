export interface SliInput {
  goodEvents: number;
  totalEvents: number;
  targetPercent: number;
}

export interface SliResult {
  sliPercent: number;
  errorBudgetRemaining: number;
  reliabilityScore: number;
}

export function calculateSli(input: SliInput): SliResult {
  const total = Math.max(0, input.totalEvents);
  const good = Math.min(Math.max(0, input.goodEvents), total);
  const sliPercent = total === 0 ? 100 : (good / total) * 100;
  const budgetDenom = Math.max(0.0001, 100 - input.targetPercent);
  const rawBudget = ((sliPercent - input.targetPercent) / budgetDenom) * 100;
  const errorBudgetRemaining = Math.max(-100, Math.min(100, rawBudget));
  const reliabilityScore = Math.max(0, Math.min(100, sliPercent));
  return { sliPercent, errorBudgetRemaining, reliabilityScore };
}
