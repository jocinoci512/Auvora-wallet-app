import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../portfolio/portfolio_controller.dart';
import '../theme/aether_theme.dart';
import 'home/home_shared.dart';
import 'receive_flow_screen.dart';
import 'send_flow_screen.dart';

class AssetDetailScreen extends StatelessWidget {
  const AssetDetailScreen({super.key, required this.assetId});

  final String assetId;

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final asset = p.assetById(assetId);

    if (asset == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Asset')),
        body: const Center(child: Text('Asset not found')),
      );
    }

    final up = asset.change24hPct >= 0;
    final fav = p.favorites.contains(asset.id);
    final pin = p.pinned.contains(asset.id);

    return Scaffold(
      appBar: AppBar(
        title: Text(asset.name),
        actions: [
          IconButton(
            tooltip: fav ? 'Unfavorite' : 'Favorite',
            onPressed: () => p.toggleFavorite(asset.id),
            icon: Icon(fav ? Icons.star_rounded : Icons.star_outline_rounded),
          ),
          IconButton(
            tooltip: pin ? 'Unpin' : 'Pin',
            onPressed: () => p.togglePinned(asset.id),
            icon: Icon(pin ? Icons.push_pin_rounded : Icons.push_pin_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
        children: [
          Row(
            children: [
              AssetAvatar(asset: asset, size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(asset.ticker, style: Theme.of(context).textTheme.headlineSmall),
                    Text(asset.network.label, style: const TextStyle(color: AetherColors.muted)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text('Balance', style: TextStyle(color: AetherColors.muted)),
          const SizedBox(height: 4),
          Text(p.crypto(asset.balance, asset.ticker, digits: 6), style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 4),
          Text(p.money(asset.fiatValue), style: const TextStyle(fontSize: 18, color: AetherColors.muted)),
          const SizedBox(height: 12),
          Text(
            p.hideBalances
                ? '•••• 24h'
                : '${up ? '+' : ''}${asset.change24hPct.toStringAsFixed(2)}% · ${p.money(asset.priceUsd)} per ${asset.ticker}',
            style: TextStyle(
              color: up ? const Color(0xFF067647) : AetherColors.danger,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 20),
          TrendChart(values: asset.sparkline, height: 96, color: Color(asset.color)),
          const SizedBox(height: 8),
          const Text('7-day price', style: TextStyle(color: AetherColors.muted, fontSize: 12)),
          const SizedBox(height: 24),
          Text('Actions', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => SendFlowScreen(initialAssetId: asset.id)),
                ),
                child: const Text('Send'),
              ),
              OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => ReceiveFlowScreen(initialAssetId: asset.id)),
                ),
                child: const Text('Receive'),
              ),
              for (final label in ['Swap', 'Buy'])
                OutlinedButton(
                  onPressed: () => showActionSheet(
                    context,
                    title: '$label ${asset.ticker}',
                    body: '$label for ${asset.name} opens when live networks are connected.',
                  ),
                  child: Text(label),
                ),
            ],
          ),
          const SizedBox(height: 28),
          const SoftBanner(
            message: 'Prices and balances in this build are a local preview until chain sync and market data are connected.',
          ),
        ],
      ),
    );
  }
}
