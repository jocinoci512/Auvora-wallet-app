import { Inject, Injectable } from '@nestjs/common';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { ForbiddenError } from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import {
  LEDGER_REPOSITORY,
  type LedgerRepositoryPort,
} from '../ports/ledger-repository.port';
import {
  WALLET_REPOSITORY,
  type WalletRecord,
  type WalletRepositoryPort,
} from '../ports/wallet-repository.port';
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
};

export type NetworkPortfolioTotal = {
  chain: string;
  walletCount: number;
  ledgerTotal: string;
  chainTotal: string | null;
};

export type TokenPortfolioTotal = {
  assetCode: string;
  assetSymbol: string;
  standard: string;
  walletCount: number;
  ledgerTotal: string;
};

export type PortfolioSnapshot = {
  ownerUserId: string;
  generatedAt: string;
  wallets: PortfolioWalletSummary[];
  networkTotals: NetworkPortfolioTotal[];
  tokenTotals: TokenPortfolioTotal[];
  portfolioLedgerTotal: string;
  walletCount: number;
};

@Injectable()
export class PortfolioEngineService {
  constructor(
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(LEDGER_REPOSITORY) private readonly ledger: LedgerRepositoryPort,
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
    const byNetwork = new Map<string, { count: number; ledger: number; chain: number; hasChain: boolean }>();
    const byToken = new Map<string, { symbol: string; standard: string; count: number; ledger: number }>();

    let portfolioLedger = 0;
    for (const w of wallets) {
      const ledger = Number(w.ledgerBalance) || 0;
      portfolioLedger += ledger;
      const net = byNetwork.get(w.assetChain) ?? { count: 0, ledger: 0, chain: 0, hasChain: false };
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

    return {
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
