import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/portfolio_controller.dart';
import '../../theme/aether_theme.dart';
import '../asset_detail_screen.dart';
import 'home_shared.dart';

class AssetsTab extends StatelessWidget {
  const AssetsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final assets = p.visibleAssets;

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Assets', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 4),
                const Text('Search, pin favorites, and hide empty balances.', style: TextStyle(color: AetherColors.muted)),
                const SizedBox(height: 16),
                TextField(
                  onChanged: p.setAssetQuery,
                  decoration: const InputDecoration(
                    hintText: 'Search assets',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('Hide zero'),
                        selected: p.hideZeroBalances,
                        onSelected: p.setHideZero,
                      ),
                      const SizedBox(width: 8),
                      ...AssetSort.values.map((s) {
                        final label = switch (s) {
                          AssetSort.valueDesc => 'Value',
                          AssetSort.nameAsc => 'Name',
                          AssetSort.changeDesc => '24h',
                          AssetSort.balanceDesc => 'Balance',
                        };
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(label),
                            selected: p.sort == s,
                            onSelected: (_) => p.setSort(s),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (assets.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('No assets match', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  const Text(
                    'Try another search, or turn off “Hide zero” to see the full supported list.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AetherColors.muted, height: 1.45),
                  ),
                ],
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            sliver: SliverList.separated(
              itemCount: assets.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final asset = assets[i];
                final up = asset.change24hPct >= 0;
                final fav = p.favorites.contains(asset.id);
                final pin = p.pinned.contains(asset.id);
                return Material(
                  color: Theme.of(context).cardTheme.color,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => AssetDetailScreen(assetId: asset.id)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                      child: Row(
                        children: [
                          AssetAvatar(asset: asset),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Flexible(
                                      child: Text(asset.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ),
                                    if (pin) ...[
                                      const SizedBox(width: 6),
                                      const Icon(Icons.push_pin_rounded, size: 14, color: AetherColors.lagoon),
                                    ],
                                  ],
                                ),
                                Text(
                                  '${asset.ticker} · ${asset.network.label}',
                                  style: const TextStyle(color: AetherColors.muted, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(p.crypto(asset.balance, asset.ticker), style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(p.money(asset.fiatValue), style: const TextStyle(color: AetherColors.muted, fontSize: 13)),
                              Text(
                                p.hideBalances ? '••' : '${up ? '+' : ''}${asset.change24hPct.toStringAsFixed(2)}%',
                                style: TextStyle(
                                  color: up ? const Color(0xFF067647) : AetherColors.danger,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          PopupMenuButton<String>(
                            onSelected: (v) {
                              if (v == 'fav') p.toggleFavorite(asset.id);
                              if (v == 'pin') p.togglePinned(asset.id);
                            },
                            itemBuilder: (_) => [
                              PopupMenuItem(value: 'fav', child: Text(fav ? 'Remove favorite' : 'Favorite')),
                              PopupMenuItem(value: 'pin', child: Text(pin ? 'Unpin' : 'Pin to top')),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
