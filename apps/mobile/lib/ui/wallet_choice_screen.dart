import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    final theme = Theme.of(context);

    return ScreenScaffold(
      title: 'Set up your wallet',
      subtitle:
          'Your Auvora account is separate from wallet keys. '
          'Keys are created or restored only on this device.',
      onBack: c.goWelcome,
      body: ListView(
        children: [
          const SoftBanner(
            tone: BannerTone.info,
            message:
                'Recovery phrases are for emergency wallet backup — not for everyday Auvora sign-in.',
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: c.startCreate,
            child: const Text('Create a new wallet'),
          ),
          const SizedBox(height: 12),
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
