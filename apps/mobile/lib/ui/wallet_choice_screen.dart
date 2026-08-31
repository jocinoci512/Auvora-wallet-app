import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../account/ui/account_screen.dart';
import '../account/vault_sync_service.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';
import 'home/home_shared.dart';

/// After account auth (or emergency restore), choose Create / Import wallet.
class WalletChoiceScreen extends StatelessWidget {
  const WalletChoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final vaultSync = context.watch<VaultSyncService>();
    final theme = Theme.of(context);
    final cloudRestore = vaultSync.needsPasswordForRestore;

    return ScreenScaffold(
      title: cloudRestore ? 'Unlock your wallet' : 'Set up your wallet',
      subtitle: cloudRestore
          ? 'An encrypted backup is already on your Auvora account. '
              'Confirm your account password — do not create a second wallet.'
          : 'Your Auvora account is separate from wallet keys. '
              'Keys are created or restored only on this device.',
      onBack: c.goWelcome,
      body: ListView(
        children: [
          SoftBanner(
            tone: cloudRestore ? BannerTone.warn : BannerTone.info,
            message: cloudRestore
                ? 'Cloud backup available — confirm your password to unlock. '
                    'Do not create a new wallet on this device.'
                : 'Recovery phrases are for emergency wallet backup — not for everyday Auvora sign-in.',
          ),
          const SizedBox(height: 20),
          if (cloudRestore) ...[
            FilledButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AccountScreen(),
                  ),
                );
              },
              child: const Text('Unlock wallet from backup'),
            ),
            const SizedBox(height: 12),
          ] else
            FilledButton(
              onPressed: c.startCreate,
              child: const Text('Create a new wallet'),
            ),
          if (!cloudRestore) const SizedBox(height: 12),
          OutlinedButton(
            onPressed: c.startImport,
            child: const Text('Import or restore wallet'),
          ),
          const SizedBox(height: 24),
          Text(
            'Auvora never receives your mnemonic or private keys. '
            'Password reset restores account access only — it cannot decrypt a wallet that was encrypted with a different password.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AetherColors.mutedFor(context),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
