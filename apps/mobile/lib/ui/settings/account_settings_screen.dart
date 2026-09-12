import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../account/account_controller.dart';
import '../../crypto/phrase_confirmation.dart';
import '../../crypto/wallet_crypto.dart';
import '../../privacy/sensitive_screen.dart';
import '../../preferences/preferences_controller.dart';
import '../../release/release_config.dart';
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
          if (!ReleaseConfig.allowFundingAddresses) ...[
            const SoftBanner(
              tone: BannerTone.warn,
              message: ReleaseConfig.fundingBlockedMessage,
            ),
            const SizedBox(height: 8),
          ],
          SelectableText(
            ReleaseConfig.allowFundingAddresses
                ? address
                : ReleaseConfig.redactAddress(address),
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: !ReleaseConfig.allowFundingAddresses
                ? null
                : () async {
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
            child: const Text(
              ReleaseConfig.allowFundingAddresses
                  ? 'Export public address'
                  : 'Export locked (Alpha)',
            ),
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
          const SizedBox(height: 32),
          Text('Account management', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          const Text(
            'Deleting your Auvora account removes your Auvora account and eligible associated cloud data. '
            'It does not erase public blockchain transaction history — blockchain records are not controlled by Auvora.\n\n'
            'This is separate from signing out or removing a wallet from this device.',
            style: TextStyle(color: AetherColors.muted, fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AetherColors.danger,
              side: const BorderSide(color: AetherColors.danger),
            ),
            icon: const Icon(Icons.delete_forever_outlined),
            label: const Text('Delete Auvora account'),
            onPressed: () => _confirmDeleteAccount(context),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => launchUrl(
              Uri.parse('https://auvorawallet.com/account-deletion'),
              mode: LaunchMode.externalApplication,
            ),
            child: const Text('Web deletion policy & instructions'),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDeleteAccount(BuildContext context) async {
    final account = context.read<AccountController>();
    final wallet = context.read<WalletController>();

    if (!account.isSignedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to delete your Auvora account.')),
      );
      return;
    }

    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Auvora account?'),
        content: SingleChildScrollView(
          child: Text(
            'Auvora does not hold your private keys.\n\n'
            'Deleting your Auvora account may remove:\n'
            '• profile and account settings\n'
            '• sessions and device registrations\n'
            '• notification preferences\n'
            '• cloud encrypted wallet backup (if any)\n'
            '• KYC / account records subject to applicable retention requirements\n\n'
            'This does not delete public blockchain history and does not automatically erase '
            'the wallet stored on this device.\n\n'
            '${wallet.wallet != null ? 'Before continuing, make sure you can independently recover your self-custody wallet (for example with your recovery phrase stored offline). Auvora will not show or transmit your recovery phrase during this process.\n\n' : ''}'
            'Some records required by law or compliance may be retained until legal retention policy is confirmed — Auvora does not claim immediate deletion of those records.',
            style: const TextStyle(height: 1.4),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AetherColors.danger),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (proceed != true || !context.mounted) return;

    final credentials = await showDialog<({String password, String confirmation})>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const _DeleteAccountConfirmDialog(),
    );
    if (credentials == null || !context.mounted) return;

    final okAuth = await authenticateConnectionsAction(
      context,
      wallet,
      reason: 'Authorize account deletion',
    );
    if (!okAuth || !context.mounted) return;

    final ok = await account.deleteAccount(
      currentPassword: credentials.password,
      confirmation: credentials.confirmation,
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok || account.info != null
              ? (account.info ?? 'Your Auvora account has been deleted.')
              : (account.error ?? 'Could not delete account. Check your password and try again.'),
        ),
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

  Future<bool> _confirmNewRecoveryPhrase(BuildContext context, String mnemonic) async {
    final session = PhraseConfirmationSession.fromMnemonic(mnemonic);
    String? error;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => SensitiveScope(
        child: StatefulBuilder(
          builder: (ctx, setDialog) => AlertDialog(
            title: const Text('Confirm recovery phrase'),
            content: SizedBox(
              width: 420,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Pick the exact saved word for each position before this wallet is stored on the device.',
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Select word #${session.currentIndex + 1}',
                    style: Theme.of(ctx).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: session.currentChoices.map((option) {
                      final selected = session.answers[session.currentIndex] == option;
                      return ChoiceChip(
                        label: Text(option),
                        selected: selected,
                        onSelected: (_) => setDialog(() {
                          final correct = session.select(option);
                          error = session.error;
                          if (correct) session.advanceIfCurrentCorrect();
                        }),
                      );
                    }).toList(),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 8),
                    Text(error!, style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: session.complete ? () => Navigator.pop(ctx, true) : null,
                child: const Text('Continue'),
              ),
            ],
          ),
        ),
      ),
    );
    return ok == true;
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
      builder: (ctx) => SensitiveScope(
        child: AlertDialog(
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
      ),
    );
    if (choice == null || !context.mounted) {
      nameCtrl.dispose();
      return;
    }

    if (choice == 'create') {
      final mnemonic = WalletCrypto.generateMnemonic();
      if (!context.mounted) {
        nameCtrl.dispose();
        return;
      }
      await showDialog<void>(
        context: context,
        builder: (ctx) => SensitiveScope(
          child: AlertDialog(
            title: const Text('Write down your phrase'),
            content: SelectableText(mnemonic, style: const TextStyle(height: 1.5)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Continue')),
            ],
          ),
        ),
      );
      if (!context.mounted) {
        nameCtrl.dispose();
        return;
      }
      final confirmed = await _confirmNewRecoveryPhrase(context, mnemonic);
      if (!confirmed || !context.mounted) {
        nameCtrl.dispose();
        return;
      }
      await wallet.createAdditionalWallet(
        mnemonic: mnemonic,
        name: nameCtrl.text.trim(),
        backupQuizPassed: true,
      );
    } else {
      final phraseCtrl = TextEditingController();
      final imported = await showDialog<bool>(
        context: context,
        builder: (ctx) => SensitiveScope(
          child: AlertDialog(
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
        ),
      );
      if (imported == true) {
        final phrase = WalletCrypto.normalizeMnemonic(phraseCtrl.text);
        if (WalletCrypto.validateMnemonic(phrase)) {
          await wallet.createAdditionalWallet(
            mnemonic: phrase,
            name: nameCtrl.text.trim(),
            backupQuizPassed: true,
          );
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

class _DeleteAccountConfirmDialog extends StatefulWidget {
  const _DeleteAccountConfirmDialog();

  @override
  State<_DeleteAccountConfirmDialog> createState() => _DeleteAccountConfirmDialogState();
}

class _DeleteAccountConfirmDialogState extends State<_DeleteAccountConfirmDialog> {
  final _password = TextEditingController();
  final _confirmation = TextEditingController();

  @override
  void dispose() {
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit =
        _password.text.isNotEmpty && _confirmation.text.trim().toUpperCase() == 'DELETE';
    return AlertDialog(
      title: const Text('Confirm deletion'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Enter your account password, then type DELETE to confirm. '
              'This permanently deletes your Auvora cloud account.',
              style: TextStyle(height: 1.4),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _password,
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              decoration: const InputDecoration(labelText: 'Current password'),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmation,
              decoration: const InputDecoration(
                labelText: 'Type DELETE to confirm',
              ),
              textCapitalization: TextCapitalization.characters,
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AetherColors.danger),
          onPressed: canSubmit
              ? () => Navigator.pop(context, (
                    password: _password.text,
                    confirmation: _confirmation.text.trim(),
                  ))
              : null,
          child: const Text('Delete account'),
        ),
      ],
    );
  }
}
