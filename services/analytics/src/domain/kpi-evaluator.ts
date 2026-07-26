export type KpiHealthStatus = 'ok' | 'warning' | 'critical' | 'unknown';

export interface KpiEvaluationInput {
  currentValue: number | null;
  targetValue: number | null;
  warningThreshold: number | null;
  criticalThreshold: number | null;
  higherIsBetter: boolean;
}

export interface KpiEvaluationResult {
  status: KpiHealthStatus;
  currentValue: number | null;
  targetValue: number | null;
  delta: number | null;
  progressRatio: number | null;
}

function compareAgainstThreshold(
  value: number,
  threshold: number,
  higherIsBetter: boolean,
): boolean {
  return higherIsBetter ? value >= threshold : value <= threshold;
}

export function evaluateKpi(input: KpiEvaluationInput): KpiEvaluationResult {
  const { currentValue, targetValue, warningThreshold, criticalThreshold, higherIsBetter } = input;

  if (currentValue === null || !Number.isFinite(currentValue)) {
    return {
      status: 'unknown',
      currentValue,
      targetValue,
      delta: null,
      progressRatio: null,
    };
  }

  let status: KpiHealthStatus = 'ok';

  if (criticalThreshold !== null && Number.isFinite(criticalThreshold)) {
    const meetsCritical = compareAgainstThreshold(currentValue, criticalThreshold, higherIsBetter);
    if (!meetsCritical) {
      status = 'critical';
    }
  }

  if (status === 'ok' && warningThreshold !== null && Number.isFinite(warningThreshold)) {
    const meetsWarning = compareAgainstThreshold(currentValue, warningThreshold, higherIsBetter);
    if (!meetsWarning) {
      status = 'warning';
    }
  }

  const delta = targetValue === null ? null : currentValue - targetValue;
  const progressRatio =
    targetValue === null || targetValue === 0 ? null : currentValue / targetValue;

  return {
    status,
    currentValue,
    targetValue,
    delta,
    progressRatio,
  };
}
