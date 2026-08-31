import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../account/account_controller.dart';
import '../account/ui/account_screen.dart';
import '../state/wallet_controller.dart';
import '../state/wallet_session_restore.dart';
import '../theme/aether_theme.dart';

/// Account-first welcome: Create Account / Sign In before wallet setup.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final account = context.watch<AccountController>();
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    // Signed-in routing waits for wallet restore. A late vault read must not
    // be overwritten by Create Wallet.
    if (account.isSignedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!context.mounted) return;
        final wallet = context.read<WalletController>();
        if (wallet.hasLocalWallet) {
          wallet.resumeExistingSession();
          return;
        }
        if (!wallet.restoreResolved || wallet.stage == AppStage.splash) return;
        if (!wallet.onboardingComplete) wallet.goWalletChoice();
      });
    }

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
                  'Welcome to Auvora',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: -1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'One account for Android and Web.\n'
                  'Your wallet keys stay on this device — we never ask for them.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AetherColors.mutedFor(context),
                    height: 1.5,
                  ),
                ),
                const Spacer(flex: 3),
                if (account.isSessionExpired) ...[
                  Text(
                    WalletSessionRestore.sessionExpiredMessage,
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AetherColors.mutedFor(context),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (!c.hasLocalWallet && !account.isSessionExpired)
                  FilledButton(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const AccountScreen(onboardingMode: true),
                        ),
                      );
                    },
                    child: const Text('Create Account'),
                  ),
                if (!c.hasLocalWallet && !account.isSessionExpired) const SizedBox(height: 12),
                Builder(
                  builder: (context) {
                    void openSignIn() {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const AccountScreen(
                            onboardingMode: true,
                            preferSignIn: true,
                          ),
                        ),
                      );
                    }

                    final label = account.isSessionExpired ? 'Sign in again' : 'Sign In';
                    if (c.hasLocalWallet || account.isSessionExpired) {
                      return FilledButton(onPressed: openSignIn, child: Text(label));
                    }
                    return OutlinedButton(onPressed: openSignIn, child: Text(label));
                  },
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: c.goWalletChoice,
                  child: Text(
                    'Restore or import wallet',
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: AetherColors.mutedFor(context),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
