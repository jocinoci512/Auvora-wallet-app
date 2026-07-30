import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../theme/aether_theme.dart';
import '../asset_detail_screen.dart';
import '../transaction_detail_screen.dart';
import 'home_shared.dart';

/// Full-screen search — not a bottom-nav destination.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final results = p.searchResults;
    final q = p.globalQuery.trim();

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          focusNode: _focus,
          onChanged: p.setGlobalQuery,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: 'Assets, networks, activity, contacts',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            contentPadding: EdgeInsets.symmetric(vertical: 12),
          ),
        ),
        actions: [
          if (q.isNotEmpty)
            IconButton(
              tooltip: 'Clear',
              onPressed: () {
                _controller.clear();
                p.setGlobalQuery('');
              },
              icon: const Icon(Icons.close_rounded),
            ),
        ],
      ),
      body: q.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Type to find an asset, network, transaction, or contact.\nResults update instantly.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AetherColors.muted, height: 1.5),
                ),
              ),
            )
          : results.isEmpty
              ? const Center(
                  child: Text('No matches', style: TextStyle(color: AetherColors.muted)),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  itemCount: results.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, i) {
                    final item = results[i];
                    if (item is AssetHolding) {
                      return _tile(
                        context,
                        title: item.name,
                        subtitle: 'Asset · ${item.ticker}',
                        icon: Icons.token_outlined,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(builder: (_) => AssetDetailScreen(assetId: item.id)),
                        ),
                      );
                    }
                    if (item is AssetNetwork) {
                      return _tile(
                        context,
                        title: item.label,
                        subtitle: 'Network · ${item.short}',
                        icon: Icons.hub_outlined,
                        onTap: () => showActionSheet(
                          context,
                          title: item.label,
                          body: '${item.label} is ready for balances and activity once networks sync.',
                        ),
                      );
                    }
                    if (item is PortfolioTx) {
                      return _tile(
                        context,
                        title: '${item.type.label} ${item.assetTicker}',
                        subtitle: 'Activity · ${item.status.label}',
                        icon: typeIcon(item.type),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(builder: (_) => TransactionDetailScreen(txId: item.id)),
                        ),
                      );
                    }
                    if (item is AddressContact) {
                      return _tile(
                        context,
                        title: item.name,
                        subtitle: 'Contact · ${item.network.label}',
                        icon: Icons.person_outline_rounded,
                        onTap: () => copyText(context, item.address, label: 'Address copied'),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
    );
  }

  Widget _tile(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      label: '$title, $subtitle',
      child: Material(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
        child: ListTile(
          onTap: onTap,
          minVerticalPadding: 14,
          leading: CircleAvatar(
            backgroundColor: AetherColors.lagoon.withValues(alpha: 0.1),
            child: Icon(icon, color: AetherColors.lagoon, size: 20),
          ),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right_rounded),
        ),
      ),
    );
  }
}
