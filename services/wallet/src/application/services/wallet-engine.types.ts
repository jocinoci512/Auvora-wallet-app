import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('auvora-wallet-engine');

export async function withWalletSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
    const started = Date.now();
    try {
      const result = await fn();
      span.setAttribute('duration_ms', Date.now() - started);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setAttribute('duration_ms', Date.now() - started);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message.slice(0, 200) : 'error',
      });
      throw error;
    } finally {
      span.end();
    }
  });
}

export type WalletAccountPreference = {
  index: number;
  label: string;
  derivationPath?: string;
  isDefault?: boolean;
  address?: string;
};

export type WalletPreferences = {
  activeNetwork?: string;
  activeAccountIndex?: number;
  accounts?: WalletAccountPreference[];
  preferredNetworks?: string[];
};

export type ChainSyncMetadata = {
  address?: string;
  addressId?: string;
  chain?: string;
  lastBalance?: string;
  lastSyncedAt?: string;
  lastBlockHeight?: string;
  lastError?: string;
  retryCount?: number;
  importMode?: 'public_address' | 'generated';
  recoveryVerifiedAt?: string;
  /** Never store private keys — this field documents that export is public-only. */
  exportPolicy?: 'public_metadata_only';
};

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readPreferences(value: unknown): WalletPreferences {
  return asRecord(value) as WalletPreferences;
}

export function readChainSync(metadata: unknown): ChainSyncMetadata {
  const meta = asRecord(metadata);
  return asRecord(meta.chainSync) as ChainSyncMetadata;
}

export function mergeChainSync(
  metadata: unknown,
  patch: ChainSyncMetadata,
): Record<string, unknown> {
  const meta = asRecord(metadata);
  const current = readChainSync(metadata);
  return {
    ...meta,
    chainSync: { ...current, ...patch, exportPolicy: 'public_metadata_only' },
  };
}

export const PHASE18_SUPPORTED_NETWORKS = [
  'ETHEREUM',
  'BNB_SMART_CHAIN',
  'BITCOIN',
  'SOLANA',
  'TRON',
] as const;

export function defaultDerivationPath(chain: string, accountIndex: number): string {
  const index = Math.max(0, Math.floor(accountIndex));
  switch (chain) {
    case 'BITCOIN':
      return `m/84'/0'/0'/0/${index}`;
    case 'SOLANA':
      return `m/44'/501'/${index}'/0'`;
    case 'TRON':
      return `m/44'/195'/0'/0/${index}`;
    case 'BNB_SMART_CHAIN':
    case 'ETHEREUM':
    case 'POLYGON':
    default:
      return `m/44'/60'/0'/0/${index}`;
  }
}

export function tokenStandardForChain(chain: string): string {
  switch (chain) {
    case 'ETHEREUM':
    case 'POLYGON':
      return 'ERC20';
    case 'BNB_SMART_CHAIN':
      return 'BEP20';
    case 'SOLANA':
      return 'SPL';
    case 'TRON':
      return 'TRC20';
    case 'BITCOIN':
      return 'NATIVE';
    default:
      return 'OTHER';
  }
}
