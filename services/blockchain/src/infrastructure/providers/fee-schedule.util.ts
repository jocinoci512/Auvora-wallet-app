import type { FeePriority, Prisma } from '@auvora/database';

export interface FeeScheduleMetadata {
  base: string;
  unit: string;
  multipliers?: Partial<Record<FeePriority, number>>;
}

export const DEFAULT_FEE_MULTIPLIERS: Record<FeePriority, number> = {
  SLOW: 0.5,
  STANDARD: 1,
  FAST: 1.75,
  PRIORITY: 3,
};

/** Reads the optional `{ fees: { base, unit, multipliers } }` shape from BlockchainNetworkConfig.metadata. */
export function extractFeeMetadata(
  metadata: Prisma.JsonValue | null | undefined,
): FeeScheduleMetadata | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const fees = (metadata as Record<string, unknown>)['fees'];
  if (!fees || typeof fees !== 'object' || Array.isArray(fees)) {
    return null;
  }
  const record = fees as Record<string, unknown>;
  const base = record['base'];
  const unit = record['unit'];
  if (typeof base !== 'string' || typeof unit !== 'string') {
    return null;
  }
  const multipliersRaw = record['multipliers'];
  const multipliers =
    multipliersRaw && typeof multipliersRaw === 'object' && !Array.isArray(multipliersRaw)
      ? (multipliersRaw as Partial<Record<FeePriority, number>>)
      : undefined;
  return { base, unit, multipliers };
}
