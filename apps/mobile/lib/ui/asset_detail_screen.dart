import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../engine/models.dart';
import '../portfolio/portfolio_controller.dart';
import '../release/release_config.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import '../wallet_engine/market_data_provider.dart';
import '../wallet_engine/price_service.dart';
import 'home/home_shared.dart';
import 'home/home_tab.dart';
import 'receive_flow_screen.dart';
import 'send_flow_screen.dart';
import 'transaction_detail_screen.dart';

class AssetDetailScreen extends StatefulWidget {
  const AssetDetailScreen({super.key, required this.assetId});

  final String assetId;

  @override
  State<AssetDetailScreen> createState() => _AssetDetailScreenState();
}

class _AssetDetailScreenState extends State<AssetDetailScreen> {
  ChartRange _range = ChartRange.d7;
  List<double> _series = const [];
  bool _loadingChart = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadChart());
  }

  Future<void> _loadChart() async {
    final p = context.read<PortfolioController>();
    final asset = p.assetById(widget.assetId);
    if (asset == null) return;
    setState(() => _loadingChart = true);
    try {
      final prices = context.read<PriceService>();
      final series = await prices.history(asset.ticker, _range);
      if (mounted) setState(() => _series = series);
    } finally {
      if (mounted) setState(() => _loadingChart = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final wallet = context.watch<WalletController>();
    final asset = p.assetById(widget.assetId);

    if (asset == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Asset')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'This asset is not in your portfolio yet.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AetherColors.muted),
            ),
          ),
        ),
      );
    }

    final up = asset.change24hPct >= 0;
    final fav = p.favorites.contains(asset.id);
    final pin = p.pinned.contains(asset.id);
    final address = wallet.addressFor(asset.network) ?? wallet.address;
    final chart = _series.isNotEmpty ? _series : asset.sparkline;
    final txs = p.filteredTransactions
        .where((t) => t.assetTicker == asset.ticker && t.network == asset.network)
        .take(8)
        .toList();

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
          Wrap(
            spacing: 8,
            children: [
              for (final range in ChartRange.values)
                ChoiceChip(
                  label: Text(_rangeLabel(range)),
                  selected: _range == range,
                  onSelected: (_) {
                    setState(() => _range = range);
                    _loadChart();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loadingChart)
            const SizedBox(height: 96, child: Center(child: CircularProgressIndicator()))
          else
            TrendChart(values: chart, height: 96, color: Color(asset.color)),
          const SizedBox(height: 8),
          Text(
            '${_rangeLabel(_range)} price',
            style: const TextStyle(color: AetherColors.muted, fontSize: 12),
          ),
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
              if (address != null)
                OutlinedButton(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: address));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          ReleaseConfig.allowFundingAddresses
                              ? 'Address copied'
                              : 'Preview address copied — funding stays locked in Closed Beta',
                        ),
                      ),
                    );
                  },
                  child: const Text('Copy address'),
                ),
              for (final entry in [
                ('Swap', EngineOp.swap),
                ('Buy', EngineOp.buy),
              ])
                OutlinedButton(
                  onPressed: () => openDigitalAssetFlow(
                    context,
                    entry.$2,
                    initialFrom: asset.ticker,
                  ),
                  child: Text(entry.$1),
                ),
            ],
          ),
          const SizedBox(height: 28),
          Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (txs.isEmpty)
            const SoftBanner(message: 'No transactions for this asset yet.')
          else
            ...[
              for (final tx in txs)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('${tx.type.label} · ${tx.status.label}'),
                  subtitle: Text(relativeTime(tx.timestamp)),
                  trailing: Text(p.crypto(tx.amount, tx.assetTicker)),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: tx.id)),
                  ),
                ),
            ],
          const SizedBox(height: 16),
          SoftBanner(
            tone: BannerTone.warn,
            message: ReleaseConfig.usesHdDerivation
                ? 'Balances may still be preview-synced. HD addresses are active; funding receive stays locked until Closed Beta sign-off.'
                : 'Prices and balances in this build are a local preview until chain sync and market data are connected.',
          ),
        ],
      ),
    );
  }

  String _rangeLabel(ChartRange range) => switch (range) {
        ChartRange.d1 => '1D',
        ChartRange.d7 => '7D',
        ChartRange.d30 => '30D',
        ChartRange.y1 => '1Y',
        ChartRange.all => 'All',
      };
}
