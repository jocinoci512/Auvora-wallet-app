'use client';

import { createApiClient, getStoredAccessToken } from '../api-client';
import { DEMO_HOLDINGS, DEMO_PERFORMANCE, type Holding } from '../dashboard-demo';

export type PortfolioDataState = 'live' | 'cached' | 'demo' | 'unavailable';

export type LivePortfolioResult = {
  state: PortfolioDataState;
  holdings: Holding[];
  performance: typeof DEMO_PERFORMANCE;
  message: string;
  generatedAt: string | null;
};

type WatchRow = {
  id?: string;
  network?: string;
  address?: string;
  label?: string | null;
  linkMode?: string | null;
  ownershipVerifiedAt?: string | null;
};

type BalanceRow = {
  balance?: string | null;
  confirmed?: string | null;
  amount?: string | null;
  symbol?: string | null;
};

const NETWORK_LABEL: Record<string, { network: string; symbol: string; name: string }> = {
  BITCOIN: { network: 'Bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  ETHEREUM: { network: 'Ethereum', symbol: 'ETH', name: 'Ether' },
  SOLANA: { network: 'Solana', symbol: 'SOL', name: 'Solana' },
  BNB_SMART_CHAIN: { network: 'BNB Smart Chain', symbol: 'BNB', name: 'BNB' },
  TRON: { network: 'TRON', symbol: 'TRX', name: 'TRON' },
  POLYGON: { network: 'Polygon', symbol: 'POL', name: 'Polygon' },
};

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as BalanceRow;
    return parseAmount(o.balance ?? o.confirmed ?? o.amount ?? 0);
  }
  return 0;
}

function toHolding(watch: WatchRow, amount: number, i: number): Holding {
  const meta = NETWORK_LABEL[String(watch.network ?? '')] ?? {
    network: String(watch.network ?? 'Unknown'),
    symbol: 'ASSET',
    name: 'Asset',
  };
  const short = (watch.address ?? '').slice(0, 6);
  const id = String(watch.id ?? `live-${i}`);
  return {
    id,
    symbol: meta.symbol,
    name: meta.name,
    network: meta.network,
    balance: amount,
    priceUsd: 0,
    valueUsd: 0,
    change24hPct: 0,
    allocationPct: 0,
    walletId: id,
    walletLabel: watch.label || `${meta.network} · ${short}…`,
  };
}

/**
 * Authenticated live portfolio from registered public addresses.
 * Alchemy privileged keys stay server-side (blockchain service).
 * Unsigned visitors may see labeled demo; signed-in screens never silently fall back to demo balances.
 */
export async function loadLivePortfolio(options?: {
  preferDemoWhenEmpty?: boolean;
}): Promise<LivePortfolioResult> {
  const token = getStoredAccessToken();
  // Authenticated: never prefer demo. Unsigned: demo allowed unless caller opts out.
  const preferDemoWhenEmpty = options?.preferDemoWhenEmpty ?? (token ? false : true);
  if (!token) {
    return {
      state: 'demo',
      holdings: DEMO_HOLDINGS,
      performance: DEMO_PERFORMANCE,
      message: 'Sample holdings — sign in and register public addresses for live balances.',
      generatedAt: null,
    };
  }

  const client = createApiClient({ timeoutMs: 20_000 });
  try {
    const watchRaw = (await client.listWatchAddresses()) as WatchRow[];
    const watches = Array.isArray(watchRaw) ? watchRaw : [];

    if (!watches.length) {
      // Also try wallet-engine portfolio for imported public wallets.
      try {
        const engine = (await client.getWalletEnginePortfolio()) as {
          wallets?: Array<{
            walletId: string;
            assetSymbol: string;
            assetChain: string;
            alias?: string | null;
            label?: string | null;
            chainBalance?: string | null;
            ledgerBalance?: string | null;
          }>;
          generatedAt?: string;
        };
        const wallets = engine.wallets ?? [];
        if (wallets.length) {
          const holdings = wallets.map((w, i) => {
            const amount = parseAmount(w.chainBalance ?? w.ledgerBalance);
            const meta = NETWORK_LABEL[String(w.assetChain)] ?? {
              network: String(w.assetChain),
              symbol: w.assetSymbol,
              name: w.assetSymbol,
            };
            const id = w.walletId || `eng-${i}`;
            return {
              id,
              symbol: meta.symbol,
              name: meta.name,
              network: meta.network,
              balance: amount,
              priceUsd: 0,
              valueUsd: 0,
              change24hPct: 0,
              allocationPct: 0,
              walletId: id,
              walletLabel: w.label || w.alias || meta.network,
            } satisfies Holding;
          });
          return {
            state: 'live',
            holdings,
            performance: DEMO_PERFORMANCE,
            message:
              'Live chain balances from registered public wallets (server-side RPC). Prices may still be unavailable.',
            generatedAt: engine.generatedAt ?? new Date().toISOString(),
          };
        }
      } catch {
        /* fall through */
      }

      if (preferDemoWhenEmpty) {
        return {
          state: 'demo',
          holdings: DEMO_HOLDINGS,
          performance: DEMO_PERFORMANCE,
          message:
            'No public addresses registered yet. Showing sample holdings — add a watch/linked address to go live.',
          generatedAt: null,
        };
      }
      return {
        state: 'unavailable',
        holdings: [],
        performance: DEMO_PERFORMANCE,
        message:
          'No registered public addresses. Add a watch or ownership-linked address for live balances.',
        generatedAt: null,
      };
    }

    const holdings: Holding[] = [];
    let liveHits = 0;
    let failures = 0;
    await Promise.all(
      watches.map(async (w, i) => {
        const network = String(w.network ?? '');
        const address = String(w.address ?? '');
        if (!network || !address) return;
        try {
          const bal = await client.getPublicChainBalance(network, address);
          const amount = parseAmount(bal);
          if (amount > 0 || bal != null) liveHits += 1;
          holdings.push(toHolding(w, amount, i));
        } catch {
          failures += 1;
          holdings.push(toHolding(w, 0, i));
        }
      }),
    );

    if (!holdings.length) {
      return {
        state: 'unavailable',
        holdings: [],
        performance: DEMO_PERFORMANCE,
        message: 'Could not load balances for registered addresses.',
        generatedAt: null,
      };
    }

    const state: PortfolioDataState =
      liveHits > 0 ? 'live' : failures === watches.length ? 'unavailable' : 'live';

    return {
      state,
      holdings,
      performance: DEMO_PERFORMANCE,
      message:
        state === 'live'
          ? 'Live balances from registered public addresses via server-side providers (Alchemy primary when configured).'
          : 'Registered addresses found but balances unavailable right now.',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      state: 'unavailable',
      holdings: [],
      performance: DEMO_PERFORMANCE,
      message: 'Portfolio API unavailable. Try again — demo data is not shown as live.',
      generatedAt: null,
    };
  }
}
