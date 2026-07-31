import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../crypto/wallet_crypto.dart';
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
    final vaults = wallet.vaults;
    final activeId = wallet.wallet?.walletId;

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Manage wallets stored on this device. Names are local labels — recovery phrases stay encrypted in secure storage.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          if (wallet.needsBackupReminder) ...[
            const SizedBox(height: 16),
            const SoftBanner(
              tone: BannerTone.warn,
              message:
                  'Backup reminder: confirm your recovery phrase in Security Center so you can restore this wallet.',
            ),
          ],
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
            title: const Text('Active wallet nickname'),
            subtitle: Text(wallet.wallet?.name ?? prefs.account.walletNickname),
            trailing: const Icon(Icons.edit_outlined),
            onTap: activeId == null
                ? null
                : () => _editField(
                      context,
                      title: 'Wallet name',
                      initial: wallet.wallet?.name ?? '',
                      onSave: (value) async {
                        await wallet.renameWallet(activeId, value);
                        await prefs.setWalletNickname(value);
                      },
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
          Text('Wallets on this device', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text(
            'Switching loads another encrypted vault. Deleting removes keys from this device only.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          if (vaults.isEmpty)
            const SoftBanner(
              message: 'No vault index yet. Create or import a wallet to begin.',
            )
          else
            for (final row in vaults)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  row.walletId == activeId ? Icons.check_circle : Icons.account_balance_wallet_outlined,
                  color: AetherColors.lagoon,
                ),
                title: Text(row.name),
                subtitle: Text(
                  row.backupConfirmed ? 'Backup confirmed' : 'Backup not confirmed',
                  style: TextStyle(
                    color: row.backupConfirmed ? AetherColors.muted : AetherColors.danger,
                    fontSize: 12,
                  ),
                ),
                trailing: row.walletId == activeId
                    ? const Text('Active', style: TextStyle(color: AetherColors.muted))
                    : TextButton(
                        onPressed: () async {
                          final ok = await authenticateConnectionsAction(
                            context,
                            wallet,
                            reason: 'Confirm before switching wallets',
                          );
                          if (!ok || !context.mounted) return;
                          await wallet.switchWallet(row.walletId);
                        },
                        child: const Text('Switch'),
                      ),
                onLongPress: row.walletId == activeId || vaults.length <= 1
                    ? null
                    : () => _confirmDelete(context, wallet, row.walletId, row.name),
              ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => _addWallet(context, wallet),
            child: const Text('Add wallet'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WalletController wallet,
    String walletId,
    String name,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete wallet?'),
        content: Text(
          'Remove “$name” from this device? Make sure you have the recovery phrase. This cannot be undone on this phone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;
    final okAuth = await authenticateConnectionsAction(
      context,
      wallet,
      reason: 'Confirm before deleting a wallet',
    );
    if (!okAuth || !context.mounted) return;
    final deleted = await wallet.deleteWallet(walletId);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(deleted ? 'Wallet removed from this device' : 'Could not delete wallet')),
    );
  }

  Future<void> _addWallet(BuildContext context, WalletController wallet) async {
    final okAuth = await authenticateConnectionsAction(
      context,
      wallet,
      reason: 'Confirm before creating another wallet',
    );
    if (!okAuth || !context.mounted) return;

    final nameCtrl = TextEditingController(text: 'Wallet ${(wallet.vaults.length + 1)}');
    final choice = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add wallet'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Create a new recovery phrase or import an existing one. Each vault is encrypted separately on this device.',
              style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, 'import'), child: const Text('Import')),
          FilledButton(onPressed: () => Navigator.pop(ctx, 'create'), child: const Text('Create')),
        ],
      ),
    );
    if (choice == null || !context.mounted) {
      nameCtrl.dispose();
      return;
    }

    if (choice == 'create') {
      final mnemonic = WalletCrypto.generateMnemonic();
      await wallet.createAdditionalWallet(mnemonic: mnemonic, name: nameCtrl.text.trim());
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Write down your phrase'),
          content: SelectableText(mnemonic, style: const TextStyle(height: 1.5)),
          actions: [
            FilledButton(onPressed: () => Navigator.pop(ctx), child: const Text('I saved it')),
          ],
        ),
      );
    } else {
      final phraseCtrl = TextEditingController();
      final imported = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Import wallet'),
          content: TextField(
            controller: phraseCtrl,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Recovery phrase',
              alignLabelWithHint: true,
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Import')),
          ],
        ),
      );
      if (imported == true) {
        final phrase = WalletCrypto.normalizeMnemonic(phraseCtrl.text);
        if (WalletCrypto.validateMnemonic(phrase)) {
          await wallet.createAdditionalWallet(mnemonic: phrase, name: nameCtrl.text.trim());
        } else if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('That recovery phrase is not valid')),
          );
        }
      }
      phraseCtrl.dispose();
    }
    nameCtrl.dispose();
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
