import type { FeeSpeed, WalletAsset, WalletNetwork } from './types';

const EVM = /^0x[a-fA-F0-9]{40}$/;
const BTC_BECH32 = /^(bc1|tb1)[a-z0-9]{25,90}$/i;
const BTC_LEGACY = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const NAME_LIKE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const UD_TLDS = new Set([
  'crypto',
  'nft',
  'wallet',
  'x',
  'dao',
  'blockchain',
  'bitcoin',
  'polygon',
]);

/** ENS / Unstoppable Domains style names (not raw chain addresses). */
export function isNameLikeRecipient(value: string): boolean {
  const a = value.trim();
  if (!a || a.startsWith('0x') || !a.includes('.')) return false;
  return NAME_LIKE.test(a);
}

/**
 * Client-side name preview for UX. Production should call a resolver API;
 * this keeps Send / Address Book usable offline with a deterministic preview.
 */
export function resolveNamePreview(name: string): {
  ok: boolean;
  address?: string;
  provider?: 'ENS' | 'Unstoppable Domains';
  message?: string;
} {
  const n = name.trim().toLowerCase();
  if (!isNameLikeRecipient(n)) {
    return { ok: false, message: 'Enter a valid ENS or domain name' };
  }
  const tld = n.split('.').pop() ?? '';
  const provider: 'ENS' | 'Unstoppable Domains' = UD_TLDS.has(tld) ? 'Unstoppable Domains' : 'ENS';
  return {
    ok: false,
    provider,
    message: `Live ${provider} lookup is not available yet. Enter a native address.`,
  };
}

export function explorerUrlFor(network: WalletNetwork, hash: string): string {
  const h = hash.startsWith('0x') ? hash : hash;
  switch (network) {
    case 'ethereum':
      return `https://etherscan.io/tx/${h}`;
    case 'polygon':
      return `https://polygonscan.com/tx/${h}`;
    case 'bnb':
      return `https://bscscan.com/tx/${h}`;
    case 'bitcoin':
      return `https://mempool.space/tx/${h}`;
    case 'solana':
      return `https://solscan.io/tx/${h}`;
    case 'tron':
      return `https://tronscan.org/#/transaction/${h}`;
    default:
      return `https://etherscan.io/tx/${h}`;
  }
}

export function validateAddressFormat(
  address: string,
  network: WalletNetwork,
): { ok: boolean; message?: string } {
  const a = address.trim();
  if (!a) return { ok: false, message: 'Enter a destination address' };

  // Names are validated separately via resolveNamePreview on EVM-family nets
  if (isNameLikeRecipient(a)) {
    if (network === 'ethereum' || network === 'polygon' || network === 'bnb') {
      return resolveNamePreview(a).ok
        ? { ok: true }
        : { ok: false, message: 'That name could not be resolved' };
    }
    return {
      ok: false,
      message: 'Domain names are supported on Ethereum, Polygon, and BNB for now',
    };
  }

  switch (network) {
    case 'ethereum':
    case 'polygon':
    case 'bnb':
      if (!EVM.test(a)) return { ok: false, message: 'Expected a 0x-prefixed EVM address' };
      return { ok: true };
    case 'bitcoin':
      if (!BTC_BECH32.test(a) && !BTC_LEGACY.test(a)) {
        return { ok: false, message: 'Expected a Bitcoin address (bech32 or legacy)' };
      }
      return { ok: true };
    case 'solana':
      if (!SOL.test(a)) return { ok: false, message: 'Expected a base58 Solana address' };
      return { ok: true };
    case 'tron':
      if (!TRON.test(a)) return { ok: false, message: 'Expected a Tron address starting with T' };
      return { ok: true };
    default:
      return {
        ok: a.length >= 20,
        message: a.length >= 20 ? undefined : 'Address looks incomplete',
      };
  }
}

export function estimateFeeDisplay(
  network: WalletNetwork,
  speed: FeeSpeed,
  customGwei?: number,
): { label: string; feeNative: string; feeUsd: string; eta: string } {
  const tables: Record<
    WalletNetwork,
    Record<Exclude<FeeSpeed, 'custom'>, { fee: string; usd: string; eta: string }>
  > = {
    ethereum: {
      slow: { fee: '0.0008 ETH', usd: '$2.70', eta: '~5 min' },
      standard: { fee: '0.0014 ETH', usd: '$4.80', eta: '~1 min' },
      fast: { fee: '0.0022 ETH', usd: '$7.50', eta: '~15 sec' },
    },
    polygon: {
      slow: { fee: '0.02 MATIC', usd: '$0.02', eta: '~2 min' },
      standard: { fee: '0.05 MATIC', usd: '$0.04', eta: '~30 sec' },
      fast: { fee: '0.12 MATIC', usd: '$0.10', eta: '~5 sec' },
    },
    bnb: {
      slow: { fee: '0.0003 BNB', usd: '$0.18', eta: '~2 min' },
      standard: { fee: '0.0005 BNB', usd: '$0.30', eta: '~30 sec' },
      fast: { fee: '0.0009 BNB', usd: '$0.54', eta: '~5 sec' },
    },
    bitcoin: {
      slow: { fee: '8 sat/vB', usd: '$1.20', eta: '~60 min' },
      standard: { fee: '14 sat/vB', usd: '$2.10', eta: '~20 min' },
      fast: { fee: '28 sat/vB', usd: '$4.20', eta: '~10 min' },
    },
    solana: {
      slow: { fee: '0.000005 SOL', usd: '$0.001', eta: '~2 sec' },
      standard: { fee: '0.00001 SOL', usd: '$0.001', eta: '~1 sec' },
      fast: { fee: '0.00002 SOL', usd: '$0.003', eta: '~400 ms' },
    },
    tron: {
      slow: { fee: '0 TRX + bandwidth', usd: '$0.00', eta: '~1 min' },
      standard: { fee: '1 TRX', usd: '$0.12', eta: '~20 sec' },
      fast: { fee: '5 TRX', usd: '$0.60', eta: '~3 sec' },
    },
  };

  if (speed === 'custom') {
    const gwei = customGwei ?? 20;
    return {
      label: 'Custom',
      feeNative: `${gwei} gwei`,
      feeUsd: `~$${(gwei * 0.12).toFixed(2)}`,
      eta: 'Variable',
    };
  }

  const row = tables[network][speed];
  return {
    label: speed[0]!.toUpperCase() + speed.slice(1),
    feeNative: row.fee,
    feeUsd: row.usd,
    eta: row.eta,
  };
}

export function parseAmount(value: string): number | null {
  const n = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** On-chain decimal places. UI still rejects extra fractional digits. */
export const ASSET_DECIMALS: Record<WalletAsset, number> = {
  BTC: 8,
  ETH: 18,
  SOL: 9,
  MATIC: 18,
  BNB: 18,
  TRX: 6,
  USDC: 6,
  USDT: 6,
};

export function nativeGasAsset(network: WalletNetwork): WalletAsset {
  switch (network) {
    case 'bitcoin':
      return 'BTC';
    case 'ethereum':
      return 'ETH';
    case 'solana':
      return 'SOL';
    case 'polygon':
      return 'MATIC';
    case 'bnb':
      return 'BNB';
    case 'tron':
      return 'TRX';
  }
}

export function parseLeadingNumber(value: string): number | null {
  const m = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function decimalPlaces(value: string): number {
  const cleaned = value.replace(/,/g, '').trim();
  const dot = cleaned.indexOf('.');
  if (dot < 0) return 0;
  return cleaned.slice(dot + 1).replace(/[^0-9]/g, '').length;
}

export function canAppendAmountDigit(current: string, key: string, maxDecimals: number): boolean {
  if (key === '⌫') return true;
  if (key === '.') return !current.includes('.');
  if (!/^\d$/.test(key)) return false;
  if (!current.includes('.')) return true;
  return decimalPlaces(current) < maxDecimals;
}

export type RecipientIssueKind = 'empty' | 'invalid_format' | 'unsupported_network' | 'ok';

/**
 * Guess which family an address belongs to. EVM chains share 0x format —
 * never auto-switch the selected network.
 */
export function guessAddressFamily(address: string): WalletNetwork | null {
  const a = address.trim();
  if (!a) return null;
  if (EVM.test(a)) return 'ethereum';
  if (BTC_BECH32.test(a) || BTC_LEGACY.test(a)) return 'bitcoin';
  if (TRON.test(a)) return 'tron';
  if (SOL.test(a)) return 'solana';
  return null;
}

const FAMILY_LABEL: Record<WalletNetwork, string> = {
  bitcoin: 'Bitcoin',
  ethereum: 'Ethereum (EVM)',
  solana: 'Solana',
  polygon: 'Ethereum (EVM)',
  bnb: 'Ethereum (EVM)',
  tron: 'Tron',
};

export function recipientIssue(
  address: string,
  network: WalletNetwork,
): { kind: RecipientIssueKind; message: string | null } {
  const a = address.trim();
  if (!a) {
    return { kind: 'empty', message: 'Enter a destination address' };
  }
  if (isNameLikeRecipient(a)) {
    const v = validateAddressFormat(a, network);
    return v.ok
      ? { kind: 'ok', message: null }
      : {
          kind: 'unsupported_network',
          message: v.message ?? 'That name is not supported on this network',
        };
  }
  const family = guessAddressFamily(a);
  const evm = network === 'ethereum' || network === 'polygon' || network === 'bnb';
  if (family && family !== network) {
    const familyIsEvm = family === 'ethereum' || family === 'polygon' || family === 'bnb';
    if (!(evm && familyIsEvm)) {
      return {
        kind: 'unsupported_network',
        message: `This looks like a ${FAMILY_LABEL[family]} address, not ${FAMILY_LABEL[network]}. Do not send — switch network or paste a matching address.`,
      };
    }
  }
  const v = validateAddressFormat(a, network);
  if (!v.ok) {
    return {
      kind: 'invalid_format',
      message: v.message ?? 'That address is not valid for this network',
    };
  }
  return { kind: 'ok', message: null };
}

export function validateSendAmount(
  value: string,
  balance: number,
  asset: WalletAsset,
): { ok: boolean; message?: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: 'Enter an amount greater than zero.' };
  if (trimmed.startsWith('-')) return { ok: false, message: 'Amount cannot be negative.' };
  if (decimalPlaces(trimmed) > ASSET_DECIMALS[asset]) {
    return {
      ok: false,
      message: `${asset} supports up to ${ASSET_DECIMALS[asset]} decimal places.`,
    };
  }
  const n = parseAmount(trimmed);
  if (n == null) return { ok: false, message: 'Enter an amount greater than zero.' };
  if (n > balance) return { ok: false, message: 'There is not enough balance for this amount.' };
  return { ok: true };
}

export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
