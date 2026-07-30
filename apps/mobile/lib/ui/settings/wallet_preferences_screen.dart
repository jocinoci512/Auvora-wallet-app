import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../preferences/models.dart';
import '../../preferences/preferences_controller.dart';
import '../../theme/aether_theme.dart';

class WalletPreferencesScreen extends StatelessWidget {
  const WalletPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final w = prefs.walletDisplay;

    return Scaffold(
      appBar: AppBar(title: const Text('Wallet')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'How balances and activity appear on this device. Changes save immediately.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 16),
          _section(context, 'Default network'),
          Wrap(
            spacing: 8,
            children: [
              for (final net in const ['ETHEREUM', 'BITCOIN', 'SOLANA', 'POLYGON'])
                ChoiceChip(
                  label: Text(net),
                  selected: w.defaultNetwork == net,
                  onSelected: (_) => prefs.setWalletDisplay(w.copyWith(defaultNetwork: net)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _section(context, 'Preferred fiat'),
          Wrap(
            spacing: 8,
            children: [
              for (final c in FiatCurrency.values)
                ChoiceChip(
                  label: Text(currencyCode(c)),
                  selected: prefs.locale.currency == c,
                  onSelected: (_) => prefs.setLocale(prefs.locale.copyWith(currency: c)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _section(context, 'Asset sorting'),
          Wrap(
            spacing: 8,
            children: [
              for (final s in AssetSortPreference.values)
                ChoiceChip(
                  label: Text(_sortLabel(s)),
                  selected: w.assetSort == s,
                  onSelected: (_) => prefs.setWalletDisplay(w.copyWith(assetSort: s)),
                ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Hide zero balances'),
            subtitle: const Text('Keep empty tokens out of the list'),
            value: w.hideZeroBalances,
            onChanged: (v) => prefs.setWalletDisplay(w.copyWith(hideZeroBalances: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Hide small balances'),
            subtitle: Text('Hide assets under ${currencyCode(prefs.locale.currency)} ${w.smallBalanceThreshold.toStringAsFixed(0)}'),
            value: w.hideSmallBalances,
            onChanged: (v) => prefs.setWalletDisplay(w.copyWith(hideSmallBalances: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Auto-refresh'),
            subtitle: const Text('Refresh portfolio when you return to Home'),
            value: w.autoRefresh,
            onChanged: (v) => prefs.setWalletDisplay(w.copyWith(autoRefresh: v)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Show fiat beside crypto'),
            subtitle: const Text('Transaction and balance rows show both amounts'),
            value: w.showFiatBesideCrypto,
            onChanged: (v) => prefs.setWalletDisplay(w.copyWith(showFiatBesideCrypto: v)),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title, style: Theme.of(context).textTheme.titleMedium),
    );
  }

  String _sortLabel(AssetSortPreference s) => switch (s) {
        AssetSortPreference.valueDesc => 'Value',
        AssetSortPreference.nameAsc => 'Name',
        AssetSortPreference.changeDesc => 'Change',
        AssetSortPreference.balanceDesc => 'Balance',
      };
}
