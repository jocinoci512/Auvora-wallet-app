import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../intelligence/intelligence_controller.dart';
import '../../intelligence/models.dart';
import '../../portfolio/models.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../../wallet_engine/key_store.dart';
import '../asset_detail_screen.dart';
import '../connections/permission_center_screen.dart';
import '../intelligence/guidance_settings_screen.dart';
import '../intelligence/learning_center_screen.dart';
import '../security/security_center_screen.dart';
import '../settings/account_settings_screen.dart';
import '../settings/help_support_screen.dart';
import '../settings/notification_center_screen.dart';
import '../settings/settings_home_screen.dart';
import '../transaction_detail_screen.dart';
import 'home_shared.dart';

/// Full-screen search — assets, activity, and Intelligence shortcuts.
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

  void _openAssist(SearchAssistHit hit) {
    final nav = Navigator.of(context);
    switch (hit.route) {
      case 'settings':
        nav.push(MaterialPageRoute<void>(builder: (_) => const SettingsHomeScreen()));
      case 'security':
        nav.push(MaterialPageRoute<void>(builder: (_) => const SecurityCenterScreen()));
      case 'permissions':
        nav.push(MaterialPageRoute<void>(builder: (_) => const PermissionCenterScreen()));
      case 'learn':
        nav.push(MaterialPageRoute<void>(builder: (_) => const LearningCenterScreen()));
      case 'guidance':
        nav.push(MaterialPageRoute<void>(builder: (_) => const GuidanceSettingsScreen()));
      case 'support':
        nav.push(MaterialPageRoute<void>(builder: (_) => const HelpSupportScreen()));
      case 'notifications':
        nav.push(MaterialPageRoute<void>(builder: (_) => const NotificationCenterScreen()));
      case 'activity':
      case 'assets':
        nav.pop();
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PortfolioController>();
    final intel = context.watch<IntelligenceController>();
    final wallet = context.watch<WalletController>();
    final results = p.searchResults;
    final q = p.globalQuery.trim();
    final assist = intel.searchAssist(q);
    final vaultHits = q.isEmpty
        ? const <VaultIndexEntry>[]
        : [
            for (final v in wallet.vaults)
              if (v.name.toLowerCase().contains(q.toLowerCase())) v,
          ];

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          focusNode: _focus,
          onChanged: p.setGlobalQuery,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: 'Assets, wallets, activity, settings…',
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
                  'Find assets, wallets, activity, settings, or lessons.\nTry “fees”, “recovery”, or “security”.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AetherColors.muted, height: 1.5),
                ),
              ),
            )
          : results.isEmpty && assist.isEmpty && vaultHits.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text(
                      'No matches.\nTry a ticker, wallet name, or “security”.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AetherColors.muted, height: 1.45),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                  children: [
                    if (assist.isNotEmpty) ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(4, 4, 4, 8),
                        child: Text(
                          'Quick links',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AetherColors.muted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      for (final hit in assist)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: _tile(
                            context,
                            title: hit.title,
                            subtitle: 'Guidance · ${hit.subtitle}',
                            icon: Icons.auto_awesome_outlined,
                            onTap: () => _openAssist(hit),
                          ),
                        ),
                      if (results.isNotEmpty || vaultHits.isNotEmpty)
                        const Padding(
                          padding: EdgeInsets.fromLTRB(4, 12, 4, 8),
                          child: Text(
                            'Wallet matches',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AetherColors.muted,
                              fontSize: 13,
                            ),
                          ),
                        ),
                    ],
                    for (final item in vaultHits)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: _tile(
                          context,
                          title: item.name,
                          subtitle: item.backupConfirmed ? 'Wallet · backup confirmed' : 'Wallet · backup needed',
                          icon: Icons.account_balance_wallet_outlined,
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => const AccountSettingsScreen()),
                          ),
                        ),
                      ),
                    for (final item in results) ...[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: _resultTile(context, item),
                      ),
                    ],
                  ],
                ),
    );
  }

  Widget _resultTile(BuildContext context, Object item) {
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
          body:
              '${item.label} is used for balances and transfers on that network. Always match networks when receiving — the wrong one can lose funds.',
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
