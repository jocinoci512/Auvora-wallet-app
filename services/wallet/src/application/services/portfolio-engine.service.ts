import { Inject, Injectable, Optional } from '@nestjs/common';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { ForbiddenError } from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import { LEDGER_REPOSITORY, type LedgerRepositoryPort } from '../ports/ledger-repository.port';
import {
  WALLET_REPOSITORY,
  type WalletRecord,
  type WalletRepositoryPort,
} from '../ports/wallet-repository.port';
import {
  MARKET_DATA_HTTP_CLIENT,
  type MarketDataHttpClientPort,
  type MarketValuationResult,
} from '../../infrastructure/market-data/market-data-http.client';
import { readChainSync, withWalletSpan } from './wallet-engine.types';

export type PortfolioWalletSummary = {
  walletId: string;
  assetCode: string;
  assetSymbol: string;
  assetChain: string;
  assetStandard: string;
  alias: string | null;
  label: string | null;
  ledgerBalance: string;
  availableBalance: string;
  chainBalance: string | null;
  lastSyncedAt: string | null;
  valueUsd?: string | null;
  priceUsd?: string | null;
  allocationPct?: string | null;
};

export type NetworkPortfolioTotal = {
  chain: string;
  walletCount: number;
  ledgerTotal: string;
  chainTotal: string | null;
  valueUsd?: string | null;
  allocationPct?: string | null;
};

export type TokenPortfolioTotal = {
  assetCode: string;
  assetSymbol: string;
  standard: string;
  walletCount: number;
  ledgerTotal: string;
  valueUsd?: string | null;
  allocationPct?: string | null;
  change24hPct?: string | null;
};

export type PortfolioSnapshot = {
  ownerUserId: string;
  generatedAt: string;
  wallets: PortfolioWalletSummary[];
  networkTotals: NetworkPortfolioTotal[];
  tokenTotals: TokenPortfolioTotal[];
  portfolioLedgerTotal: string;
  walletCount: number;
  /** Present when market-data service is configured. */
  portfolioValueUsd?: string | null;
  dailyGainLossUsd?: string | null;
  weeklyGainLossUsd?: string | null;
  monthlyGainLossUsd?: string | null;
  unrealizedProfitLossUsd?: string | null;
  largestHoldings?: MarketValuationResult['largestHoldings'];
};

@Injectable()
export class PortfolioEngineService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepositoryPort,
    @Optional()
    @Inject(MARKET_DATA_HTTP_CLIENT)
    private readonly marketData?: MarketDataHttpClientPort,
  ) {}

  async getPortfolioForUser(
    ownerUserId: string,
    requester: JwtAccessClaims,
  ): Promise<PortfolioSnapshot> {
    return withWalletSpan('wallet.portfolio.refresh', { ownerUserId }, async () => {
      if (ownerUserId !== requester.sub && !this.hasAdmin(requester)) {
        throw new ForbiddenError('Access denied');
      }
      const { items } = await this.wallets.listByOwner(ownerUserId, 0, 200);
      return this.aggregate(ownerUserId, items);
    });
  }

  async getWalletSummary(
    walletId: string,
    requester: JwtAccessClaims,
  ): Promise<PortfolioWalletSummary> {
    const wallet = await this.wallets.findById(walletId);
    if (!wallet) {
      throw new ForbiddenError('Access denied');
    }
    if (wallet.ownerUserId !== requester.sub && !this.hasAdmin(requester)) {
      throw new ForbiddenError('Access denied');
    }
    const [summary] = await this.mapWallets([wallet]);
    return summary!;
  }

  async aggregate(ownerUserId: string, items: WalletRecord[]): Promise<PortfolioSnapshot> {
    const wallets = await this.mapWallets(items);
    const byNetwork = new Map<
      string,
      { count: number; ledger: number; chain: number; hasChain: boolean }
    >();
    const byToken = new Map<
      string,
      { symbol: string; standard: string; count: number; ledger: number }
    >();

    let portfolioLedger = 0;
    for (const w of wallets) {
      const ledger = Number(w.ledgerBalance) || 0;
      portfolioLedger += ledger;
      const net = byNetwork.get(w.assetChain) ?? {
        count: 0,
        ledger: 0,
        chain: 0,
        hasChain: false,
      };
      net.count += 1;
      net.ledger += ledger;
      if (w.chainBalance != null) {
        net.chain += Number(w.chainBalance) || 0;
        net.hasChain = true;
      }
      byNetwork.set(w.assetChain, net);

      const tok = byToken.get(w.assetCode) ?? {
        symbol: w.assetSymbol,
        standard: w.assetStandard,
        count: 0,
        ledger: 0,
      };
      tok.count += 1;
      tok.ledger += ledger;
      byToken.set(w.assetCode, tok);
    }

    const snapshot: PortfolioSnapshot = {
      ownerUserId,
      generatedAt: new Date().toISOString(),
      wallets,
      networkTotals: [...byNetwork.entries()].map(([chain, v]) => ({
        chain,
        walletCount: v.count,
        ledgerTotal: v.ledger.toFixed(8),
        chainTotal: v.hasChain ? v.chain.toFixed(8) : null,
      })),
      tokenTotals: [...byToken.entries()].map(([assetCode, v]) => ({
        assetCode,
        assetSymbol: v.symbol,
        standard: v.standard,
        walletCount: v.count,
        ledgerTotal: v.ledger.toFixed(8),
      })),
      portfolioLedgerTotal: portfolioLedger.toFixed(8),
      walletCount: wallets.length,
    };

    return this.enrichWithMarketData(snapshot);
  }

  private async enrichWithMarketData(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot> {
    if (!this.marketData?.isConfigured()) {
      return snapshot;
    }
    const valuation = await this.marketData.valueHoldings(
      snapshot.ownerUserId,
      snapshot.wallets.map((w) => ({
        walletId: w.walletId,
        assetCode: w.assetCode,
        assetSymbol: w.assetSymbol,
        assetChain: w.assetChain,
        quantity: w.ledgerBalance,
      })),
    );
    if (!valuation) return snapshot;

    const tokenByCode = new Map(valuation.tokenAllocation.map((t) => [t.assetCode, t]));
    const netByChain = new Map(valuation.networkBreakdown.map((n) => [n.chain, n]));

    return {
      ...snapshot,
      portfolioValueUsd: valuation.totalValueUsd,
      dailyGainLossUsd: valuation.dailyGainLossUsd,
      weeklyGainLossUsd: valuation.weeklyGainLossUsd,
      monthlyGainLossUsd: valuation.monthlyGainLossUsd,
      unrealizedProfitLossUsd: valuation.unrealizedProfitLossUsd,
      largestHoldings: valuation.largestHoldings,
      wallets: snapshot.wallets.map((w) => {
        const t = tokenByCode.get(w.assetCode);
        return {
          ...w,
          priceUsd: t?.priceUsd ?? null,
          valueUsd: t?.valueUsd ?? null,
          allocationPct: t?.allocationPct ?? null,
        };
      }),
      networkTotals: snapshot.networkTotals.map((n) => {
        const v = netByChain.get(n.chain);
        return {
          ...n,
          valueUsd: v?.valueUsd ?? null,
          allocationPct: v?.allocationPct ?? null,
        };
      }),
      tokenTotals: snapshot.tokenTotals.map((t) => {
        const v = tokenByCode.get(t.assetCode);
        return {
          ...t,
          valueUsd: v?.valueUsd ?? null,
          allocationPct: v?.allocationPct ?? null,
          change24hPct: v?.change24hPct ?? null,
        };
      }),
    };
  }

  private async mapWallets(items: WalletRecord[]): Promise<PortfolioWalletSummary[]> {
    const out: PortfolioWalletSummary[] = [];
    for (const wallet of items) {
      const balance = await this.ledger.getBalance(wallet.id);
      const sync = readChainSync(wallet.metadata);
      out.push({
        walletId: wallet.id,
        assetCode: wallet.assetCode,
        assetSymbol: wallet.assetSymbol,
        assetChain: wallet.assetChain,
        assetStandard: wallet.assetStandard,
        alias: wallet.alias,
        label: wallet.label,
        ledgerBalance: balance?.total ?? '0',
        availableBalance: balance?.available ?? '0',
        chainBalance: sync.lastBalance ?? null,
        lastSyncedAt: sync.lastSyncedAt ?? null,
      });
    }
    return out;
  }

  private hasAdmin(requester: JwtAccessClaims): boolean {
    return requester.permissions.includes(PERMISSION_WALLETS_ADMIN as PermissionCode);
  }
}
