/** Per-1K-token USD-micros pricing (input, output). 1 USD = 1,000,000 micros. Unknown models fall back to DEFAULT_RATE. */
const MODEL_RATES_PER_1K_MICROS: Record<string, { input: number; output: number }> = {
  'sim-gpt': { input: 0, output: 0 },
  'gpt-4o-mini': { input: 150, output: 600 },
  'gpt-4o': { input: 2_500, output: 10_000 },
  'claude-3-5-haiku-latest': { input: 800, output: 4_000 },
  'claude-3-5-sonnet-latest': { input: 3_000, output: 15_000 },
  'gemini-1.5-flash': { input: 75, output: 300 },
  'gemini-1.5-pro': { input: 1_250, output: 5_000 },
};

const DEFAULT_RATE = { input: 500, output: 1_500 };

export function getModelRate(model: string): { input: number; output: number } {
  return MODEL_RATES_PER_1K_MICROS[model] ?? DEFAULT_RATE;
}

/** Estimates the USD-micros cost of a request given input/output token counts. */
export function estimateCostUsdMicros(model: string, inputTokens: number, outputTokens: number): number {
  const rate = getModelRate(model);
  const inputCost = (inputTokens / 1000) * rate.input;
  const outputCost = (outputTokens / 1000) * rate.output;
  return Math.round(inputCost + outputCost);
}
