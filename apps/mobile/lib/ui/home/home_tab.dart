import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../asset_detail_screen.dart';
import '../receive_flow_screen.dart';
import '../send_flow_screen.dart';
import '../transaction_detail_screen.dart';
import 'home_shared.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({
    super.key,
    required this.onOpenAssets,
    required this.onOpenActivity,
    required this.onOpenSearch,
    required this.onOpenMore,
    this.desktop = false,
  });

  final VoidCallback onOpenAssets;
  final VoidCallback onOpenActivity;
  final VoidCallback onOpenSearch;
  final VoidCallback onOpenMore;
  final bool desktop;

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();
    final p = context.watch<PortfolioController>();
    final snap = p.snapshot;
    final reduce = wallet.reduceMotion;

    if (p.loading && snap == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final body = desktop && snap != null && !p.isEmptyPortfolio
        ? _DesktopHome(
            wallet: wallet,
            portfolio: p,
            snap: snap,
            reduceMotion: reduce,
            onOpenAssets: onOpenAssets,
            onOpenActivity: onOpenActivity,
            onOpenSearch: onOpenSearch,
            onOpenMore: onOpenMore,
          )
        : _MobileHome(
            wallet: wallet,
            portfolio: p,
            snap: snap,
            reduceMotion: reduce,
            onOpenAssets: onOpenAssets,
            onOpenActivity: onOpenActivity,
            onOpenSearch: onOpenSearch,
            onOpenMore: onOpenMore,
          );

    return RefreshIndicator(
      onRefresh: () => p.refresh(wallet.address),
      child: body,
    );
  }
}

class _MobileHome extends StatelessWidget {
  const _MobileHome({
    required this.wallet,
    required this.portfolio,
    required this.snap,
    required this.reduceMotion,
    required this.onOpenAssets,
    required this.onOpenActivity,
    required this.onOpenSearch,
    required this.onOpenMore,
  });

  final WalletController wallet;
  final PortfolioController portfolio;
  final PortfolioSnapshot? snap;
  final bool reduceMotion;
  final VoidCallback onOpenAssets;
  final VoidCallback onOpenActivity;
  final VoidCallback onOpenSearch;
  final VoidCallback onOpenMore;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: _HomeHeader(
            wallet: wallet,
            portfolio: portfolio,
            onOpenSearch: onOpenSearch,
            onOpenMore: onOpenMore,
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: _StatusStack(snap: snap, portfolio: portfolio, address: wallet.address),
          ),
        ),
        ..._moneySection(context),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
            child: _PrimaryActions(),
          ),
        ),
        if (!portfolio.isEmptyPortfolio) ..._assetsPreview(context),
        ..._activityPreview(context),
        const SliverToBoxAdapter(child: SizedBox(height: 36)),
      ],
    );
  }

  List<Widget> _moneySection(BuildContext context) {
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          child: portfolio.isEmptyPortfolio
              ? _EmptyPortfolio(
                  address: wallet.address ?? '',
                  onReceive: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const ReceiveFlowScreen()),
                  ),
                  onBuy: () => showActionSheet(
                    context,
                    title: 'Buy',
                    body: 'Buy opens when a payment partner is connected. Until then, receive from an exchange you trust.',
                  ),
                )
              : _PortfolioHero(
                  portfolio: portfolio,
                  snap: snap!,
                  reduceMotion: reduceMotion,
                ),
        ),
      ),
    ];
  }

  List<Widget> _assetsPreview(BuildContext context) {
    final assets = portfolio.visibleAssets.take(5).toList();
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 12, 8),
          child: Row(
            children: [
              Expanded(child: Text('Your assets', style: Theme.of(context).textTheme.titleLarge)),
              TextButton(onPressed: onOpenAssets, child: const Text('See all')),
            ],
          ),
        ),
      ),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        sliver: SliverList.separated(
          itemCount: assets.length,
          separatorBuilder: (_, __) => const SizedBox(height: 6),
          itemBuilder: (context, i) {
            final asset = assets[i];
            return HomeAssetTile(
              asset: asset,
              portfolio: portfolio,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => AssetDetailScreen(assetId: asset.id)),
              ),
            );
          },
        ),
      ),
    ];
  }

  List<Widget> _activityPreview(BuildContext context) {
    final txs = snap?.transactions.take(4).toList() ?? const <PortfolioTx>[];
    return [
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 12, 8),
          child: Row(
            children: [
              Expanded(child: Text('Recent activity', style: Theme.of(context).textTheme.titleLarge)),
              TextButton(onPressed: onOpenActivity, child: const Text('See all')),
            ],
          ),
        ),
      ),
      if (txs.isEmpty)
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: _QuietEmpty(
              title: 'No moves yet',
              body: 'Send, receive, or swap — each one will appear here with a clear status.',
            ),
          ),
        )
      else
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList.separated(
            itemCount: txs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (context, i) {
              final tx = txs[i];
              return HomeTxTile(
                tx: tx,
                portfolio: portfolio,
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: tx.id)),
                ),
              );
            },
          ),
        ),
    ];
  }
}

class _DesktopHome extends StatelessWidget {
  const _DesktopHome({
    required this.wallet,
    required this.portfolio,
    required this.snap,
    required this.reduceMotion,
    required this.onOpenAssets,
    required this.onOpenActivity,
    required this.onOpenSearch,
    required this.onOpenMore,
  });

  final WalletController wallet;
  final PortfolioController portfolio;
  final PortfolioSnapshot snap;
  final bool reduceMotion;
  final VoidCallback onOpenAssets;
  final VoidCallback onOpenActivity;
  final VoidCallback onOpenSearch;
  final VoidCallback onOpenMore;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: _HomeHeader(
            wallet: wallet,
            portfolio: portfolio,
            onOpenSearch: onOpenSearch,
            onOpenMore: onOpenMore,
          ),
        ),
        if (snap.isPreview)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(
                'Preview figures — keys stay on this device until live networks sync.',
                style: TextStyle(color: AetherColors.muted, fontSize: 13),
              ),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          sliver: SliverToBoxAdapter(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: Column(
                    children: [
                      _PortfolioHero(portfolio: portfolio, snap: snap, reduceMotion: reduceMotion),
                      const SizedBox(height: 18),
                      _PrimaryActions(),
                    ],
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  flex: 6,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text('Your assets', style: Theme.of(context).textTheme.titleLarge)),
                          TextButton(onPressed: onOpenAssets, child: const Text('See all')),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (final asset in portfolio.visibleAssets.take(6)) ...[
                        HomeAssetTile(
                          asset: asset,
                          portfolio: portfolio,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => AssetDetailScreen(assetId: asset.id)),
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(child: Text('Recent activity', style: Theme.of(context).textTheme.titleLarge)),
                          TextButton(onPressed: onOpenActivity, child: const Text('See all')),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (final tx in snap.transactions.take(5)) ...[
                        HomeTxTile(
                          tx: tx,
                          portfolio: portfolio,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: tx.id)),
                          ),
                        ),
                        const SizedBox(height: 6),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.wallet,
    required this.portfolio,
    required this.onOpenSearch,
    required this.onOpenMore,
  });

  final WalletController wallet;
  final PortfolioController portfolio;
  final VoidCallback onOpenSearch;
  final VoidCallback onOpenMore;

  @override
  Widget build(BuildContext context) {
    final secured = wallet.biometricsEnabled || wallet.hasPin;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 8, 0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(greetingFor(DateTime.now()), style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 6),
                Semantics(
                  label: secured
                      ? (wallet.biometricsEnabled ? 'Protected with biometrics' : 'Protected with passcode')
                      : 'Wallet ready on this device',
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: secured ? const Color(0xFF067647) : AetherColors.muted,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        secured
                            ? (wallet.biometricsEnabled ? 'Protected · biometrics' : 'Protected · passcode')
                            : 'Ready on this device',
                        style: const TextStyle(color: AetherColors.muted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: portfolio.hideBalances ? 'Show balances' : 'Hide balances',
            onPressed: () => portfolio.setHideBalances(!portfolio.hideBalances),
            icon: Icon(portfolio.hideBalances ? Icons.visibility_off_outlined : Icons.visibility_outlined),
            style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
          ),
          IconButton(
            tooltip: 'Search',
            onPressed: onOpenSearch,
            icon: const Icon(Icons.search_rounded),
            style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
          ),
          IconButton(
            tooltip: 'Profile and settings',
            onPressed: onOpenMore,
            icon: const Icon(Icons.account_circle_outlined),
            style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
          ),
        ],
      ),
    );
  }
}

class _StatusStack extends StatelessWidget {
  const _StatusStack({required this.snap, required this.portfolio, required this.address});

  final PortfolioSnapshot? snap;
  final PortfolioController portfolio;
  final String? address;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    if (snap?.offline == true) {
      children.add(
        SoftBanner(
          tone: BannerTone.warn,
          message: 'You appear offline. Showing the last values saved on this device.',
          actionLabel: 'Retry',
          onAction: () => portfolio.refresh(address),
        ),
      );
    }
    if (snap?.priceError == true) {
      if (children.isNotEmpty) children.add(const SizedBox(height: 8));
      children.add(
        SoftBanner(
          tone: BannerTone.error,
          message: 'Prices are temporarily unavailable. Crypto balances still show.',
          actionLabel: 'Retry',
          onAction: () => portfolio.refresh(address),
        ),
      );
    }
    if (snap?.syncDelayed == true) {
      if (children.isNotEmpty) children.add(const SizedBox(height: 8));
      children.add(
        const SoftBanner(
          tone: BannerTone.warn,
          message: 'Network sync is slower than usual. Figures may update shortly.',
        ),
      );
    }
    if (children.isEmpty) return const SizedBox.shrink();
    return Column(children: children);
  }
}

class _PortfolioHero extends StatelessWidget {
  const _PortfolioHero({required this.portfolio, required this.snap, required this.reduceMotion});

  final PortfolioController portfolio;
  final PortfolioSnapshot snap;
  final bool reduceMotion;

  @override
  Widget build(BuildContext context) {
    final up = snap.change24hPct >= 0;
    final changeColor = up ? const Color(0xFF067647) : AetherColors.danger;
    return Semantics(
      label: portfolio.hideBalances
          ? 'Total portfolio hidden'
          : 'Total portfolio ${portfolio.money(snap.totalUsd)}, '
              '${up ? 'up' : 'down'} ${snap.change24hPct.abs().toStringAsFixed(2)} percent today',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Your money', style: TextStyle(color: AetherColors.muted, fontSize: 13, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          AnimatedDefaultTextStyle(
            duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 240),
            curve: Curves.easeOutCubic,
            style: Theme.of(context).textTheme.displaySmall!.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.8,
                  height: 1.05,
                ),
            child: Text(portfolio.money(snap.totalUsd)),
          ),
          const SizedBox(height: 10),
          Text(
            portfolio.hideBalances
                ? '•••• today'
                : '${up ? '+' : ''}${snap.change24hPct.toStringAsFixed(2)}% · ${portfolio.money(snap.change24hUsd)} today',
            style: TextStyle(color: changeColor, fontWeight: FontWeight.w600, fontSize: 14),
          ),
          const SizedBox(height: 18),
          ExcludeSemantics(
            child: TrendChart(values: snap.trend7d, height: 56, color: AetherColors.lagoonSoft),
          ),
          const SizedBox(height: 6),
          const Text('Last 7 days', style: TextStyle(color: AetherColors.muted, fontSize: 12)),
          const SizedBox(height: 16),
          AllocationBar(assets: snap.assets),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              for (final a in snap.nonZero.take(4))
                Text(
                  '${a.ticker} ${(a.fiatValue / snap.totalUsd * 100).toStringAsFixed(0)}%',
                  style: const TextStyle(fontSize: 12, color: AetherColors.muted, fontWeight: FontWeight.w600),
                ),
            ],
          ),
          if (snap.isPreview) ...[
            const SizedBox(height: 14),
            const Text(
              'Preview balances · live sync next',
              style: TextStyle(color: AetherColors.muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _EmptyPortfolio extends StatelessWidget {
  const _EmptyPortfolio({
    required this.address,
    required this.onReceive,
    required this.onBuy,
  });

  final String address;
  final VoidCallback onReceive;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Your money', style: TextStyle(color: AetherColors.muted, fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Text('\$0.00', style: Theme.of(context).textTheme.displaySmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        Text('Add funds to get started', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        const Text(
          'Your keys are secured on this device. Receive crypto or buy to see your portfolio here.',
          style: TextStyle(color: AetherColors.muted, height: 1.45),
        ),
        const SizedBox(height: 18),
        FilledButton(onPressed: onReceive, child: const Text('Receive crypto')),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: onBuy, child: const Text('Buy')),
        if (address.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(
            address.length > 14 ? '${address.substring(0, 8)}…${address.substring(address.length - 4)}' : address,
            style: const TextStyle(color: AetherColors.muted, fontSize: 12),
          ),
        ],
      ],
    );
  }
}

class _PrimaryActions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    const primary = [
      (Icons.arrow_upward_rounded, 'Send'),
      (Icons.arrow_downward_rounded, 'Receive'),
      (Icons.swap_horiz_rounded, 'Swap'),
      (Icons.shopping_bag_outlined, 'Buy'),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < primary.length; i++) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  icon: primary[i].$1,
                  label: primary[i].$2,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => _showMoreActions(context),
            child: const Text('Sell · Bridge · Stake'),
          ),
        ),
      ],
    );
  }

  void _showMoreActions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        const more = [
          (Icons.sell_outlined, 'Sell'),
          (Icons.hub_outlined, 'Bridge'),
          (Icons.savings_outlined, 'Stake'),
        ];
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('More actions', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 12),
              for (final a in more)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(a.$1, color: AetherColors.lagoon),
                  title: Text(a.$2),
                  subtitle: Text('${a.$2} opens when live networks are connected.'),
                  onTap: () {
                    Navigator.pop(ctx);
                    showActionSheet(
                      context,
                      title: a.$2,
                      body: '${a.$2} opens when live networks are connected. Your wallet stays protected on-device.',
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            if (label == 'Send') {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const SendFlowScreen()),
              );
              return;
            }
            if (label == 'Receive') {
              Navigator.of(context).push(
                MaterialPageRoute<void>(builder: (_) => const ReceiveFlowScreen()),
              );
              return;
            }
            showActionSheet(
              context,
              title: label,
              body: '$label opens when live networks are connected. Your wallet stays protected on-device.',
            );
          },
          child: Ink(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AetherColors.border),
            ),
            child: SizedBox(
              height: 76,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, color: AetherColors.lagoon, size: 24),
                  const SizedBox(height: 6),
                  Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QuietEmpty extends StatelessWidget {
  const _QuietEmpty({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(body, style: const TextStyle(color: AetherColors.muted, height: 1.45)),
        ],
      ),
    );
  }
}

class HomeAssetTile extends StatelessWidget {
  const HomeAssetTile({super.key, required this.asset, required this.portfolio, required this.onTap});

  final AssetHolding asset;
  final PortfolioController portfolio;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final up = asset.change24hPct >= 0;
    return Semantics(
      button: true,
      label: '${asset.name}, ${portfolio.crypto(asset.balance, asset.ticker)}, '
          '${portfolio.money(asset.fiatValue)}',
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            child: Row(
              children: [
                AssetAvatar(asset: asset, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(asset.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(asset.ticker, style: const TextStyle(color: AetherColors.muted, fontSize: 13)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(portfolio.money(asset.fiatValue), style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text(
                      portfolio.hideBalances
                          ? '••••'
                          : '${portfolio.crypto(asset.balance, asset.ticker)} · ${up ? '+' : ''}${asset.change24hPct.toStringAsFixed(1)}%',
                      style: TextStyle(
                        color: up ? const Color(0xFF067647) : AetherColors.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class HomeTxTile extends StatelessWidget {
  const HomeTxTile({super.key, required this.tx, required this.portfolio, required this.onTap});

  final PortfolioTx tx;
  final PortfolioController portfolio;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final inbound = tx.type == TxType.receive || tx.type == TxType.buy;
    return Semantics(
      button: true,
      label: '${tx.type.label} ${tx.assetTicker}, ${tx.status.label}, ${relativeTime(tx.timestamp)}',
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: statusColor(tx.status).withValues(alpha: 0.12),
                  child: Icon(typeIcon(tx.type), color: statusColor(tx.status), size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${tx.type.label} · ${tx.assetTicker}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      Text(
                        '${tx.status.label} · ${relativeTime(tx.timestamp)}',
                        style: TextStyle(color: statusColor(tx.status), fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
                Text(
                  portfolio.hideBalances
                      ? '••••'
                      : '${inbound ? '+' : '−'}${tx.amount} ${tx.assetTicker}',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: inbound ? const Color(0xFF067647) : Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
