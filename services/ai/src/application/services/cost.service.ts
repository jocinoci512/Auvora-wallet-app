import { Injectable } from '@nestjs/common';
import { estimateCostUsdMicros, getModelRate } from '../../domain';

@Injectable()
export class CostService {
  estimate(model: string, inputTokens: number, outputTokens: number): number {
    return estimateCostUsdMicros(model, inputTokens, outputTokens);
  }

  rate(model: string) {
    return getModelRate(model);
  }

  microsToUsd(micros: number): number {
    return micros / 1_000_000;
  }
}
