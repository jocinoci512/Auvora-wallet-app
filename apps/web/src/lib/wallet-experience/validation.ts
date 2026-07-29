import type { FeeSpeed, WalletNetwork } from './types';

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
  // Deterministic demo address so review screens stay stable
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  const hex = (h.toString(16) + 'a1b2c3d4e5f67890abcdef0123456789').slice(0, 40);
  return { ok: true, address: `0x${hex}`, provider };
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
