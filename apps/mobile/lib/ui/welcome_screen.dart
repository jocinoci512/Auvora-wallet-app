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
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? const [Color(0xFF0F1318), Color(0xFF121A1F), AetherColors.lagoonDeep]
                : const [Color(0xFFF7FAFB), AetherColors.mist, Color(0xFFE4EEF0)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(flex: 2),
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AetherColors.lagoon.withValues(alpha: isDark ? 0.28 : 0.1),
                      border: Border.all(
                        color: AetherColors.lagoon.withValues(alpha: 0.22),
                      ),
                    ),
                    child: Center(
                      child: Text(
                        'A',
                        style: theme.textTheme.headlineMedium?.copyWith(
                          color: isDark ? AetherColors.lagoonMist : AetherColors.lagoon,
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -1,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Auvora',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'A calm wallet for digital value.\nYou hold the keys — we never ask for them.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AetherColors.mutedFor(context),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Self-custody means your recovery phrase is the backup. Write it down privately. Support will never ask for it.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AetherColors.lagoonSoft,
                    fontWeight: FontWeight.w600,
                    height: 1.45,
                  ),
                ),
                const Spacer(flex: 3),
                FilledButton(
                  onPressed: c.startCreate,
                  child: const Text('Create a new wallet'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: c.startImport,
                  child: const Text('I already have a wallet'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
