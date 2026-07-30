import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../preferences/preferences_controller.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../connections/connections_auth.dart';
import '../home/home_shared.dart';

class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final wallet = context.watch<WalletController>();
    final address = wallet.address ?? '—';

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Name this wallet for yourself. Switching rows below is preview inventory only — not a second vault.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 20),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Display name'),
            subtitle: Text(prefs.account.displayName),
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => _editField(
              context,
              title: 'Display name',
              initial: prefs.account.displayName,
              onSave: prefs.setDisplayName,
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Wallet nickname'),
            subtitle: Text(prefs.account.walletNickname),
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => _editField(
              context,
              title: 'Wallet nickname',
              initial: prefs.account.walletNickname,
              onSave: prefs.setWalletNickname,
            ),
          ),
          const SizedBox(height: 12),
          Text('Public address', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SelectableText(address, style: const TextStyle(fontSize: 13, height: 1.4)),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              final ok = await authenticateConnectionsAction(
                context,
                wallet,
                reason: 'Confirm before exporting public wallet info',
              );
              if (!ok || !context.mounted) return;
              await Clipboard.setData(ClipboardData(text: address));
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Public address copied')),
              );
            },
            child: const Text('Export public address'),
          ),
          const SizedBox(height: 24),
          Text('Wallets on this device (preview)', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text(
            'Archive and switch update local labels only. Private keys are never shown here.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          for (final row in prefs.previewWallets.where((w) => !w.archived))
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                row.active ? Icons.check_circle : Icons.circle_outlined,
                color: AetherColors.lagoon,
              ),
              title: Text(row.label),
              subtitle: Text(row.addressHint),
              trailing: row.active
                  ? const Text('Active', style: TextStyle(color: AetherColors.muted))
                  : TextButton(
                      onPressed: () => prefs.setActivePreviewWallet(row.id),
                      child: const Text('Switch'),
                    ),
              onLongPress: row.active
                  ? null
                  : () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Archive preview wallet?'),
                          content: const Text(
                            'This hides the row from the list. It does not delete keys from a vault.',
                          ),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Archive')),
                          ],
                        ),
                      );
                      if (confirm == true) await prefs.archivePreviewWallet(row.id);
                    },
            ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => showActionSheet(
              context,
              title: 'Add wallet',
              body:
                  'Creating another vault is not available in this preview. Use a new install or future multi-wallet release.',
            ),
            child: const Text('Add wallet (coming later)'),
          ),
        ],
      ),
    );
  }

  Future<void> _editField(
    BuildContext context, {
    required String title,
    required String initial,
    required Future<void> Function(String) onSave,
  }) async {
    final ctrl = TextEditingController(text: initial);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok == true) await onSave(ctrl.text);
    ctrl.dispose();
  }
}
