import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(flex: 2),
              Text(
                'Auvora',
                textAlign: TextAlign.center,
                style: theme.textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  letterSpacing: -1.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'A calm wallet for digital value.\nYou hold the keys — we never ask for them.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: AetherColors.muted,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AetherColors.lagoon.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'Self-custody means your recovery phrase is the backup. Write it down privately. Support will never ask for it.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AetherColors.lagoon,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
              const Spacer(flex: 3),
              FilledButton(
                onPressed: c.startCreate,
                child: const Text('Create a new wallet'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: c.startImport,
                child: const Text('I already have a wallet'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
