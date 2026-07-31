import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'widgets/passcode_entry.dart';

class UnlockScreen extends StatelessWidget {
  const UnlockScreen({super.key});

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
                ? const [Color(0xFF0F1318), Color(0xFF141B21)]
                : const [Color(0xFFF7FAFB), AetherColors.mist],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 36, 24, 20),
            child: Column(
              children: [
                Text(
                  'Auvora',
                  style: theme.textTheme.headlineLarge?.copyWith(letterSpacing: -0.8),
                ),
                const SizedBox(height: 10),
                Text(
                  'Enter your passcode to continue',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AetherColors.mutedFor(context),
                  ),
                ),
                const SizedBox(height: 32),
                Expanded(
                  child: PasscodeEntry(
                    enabled: !c.busy,
                    errorText: c.errorMessage,
                    onCompleted: c.unlockWithPin,
                  ),
                ),
                if (c.biometricsEnabled)
                  TextButton.icon(
                    onPressed: c.busy ? null : c.unlockWithBiometrics,
                    icon: const Icon(Icons.fingerprint_rounded),
                    label: const Text('Use biometrics'),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
