import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../account/account_controller.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'backup_screen.dart';
import 'biometric_screen.dart';
import 'create_explain_screen.dart';
import 'home_shell.dart';
import 'import_screen.dart';
import 'permissions_screen.dart';
import 'pin_screen.dart';
import 'splash_screen.dart';
import 'unlock_screen.dart';
import 'verify_screen.dart';
import 'welcome_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      final wallet = context.read<WalletController>();
      if (wallet.hasPin && wallet.unlocked && wallet.stage == AppStage.dashboard) {
        wallet.lock();
      }
    } else if (state == AppLifecycleState.resumed) {
      // Re-check account session after background / network change. Transient
      // failures keep tokens; invalid refresh still returns to sign-in.
      // ignore: discarded_futures
      context.read<AccountController>().revalidate();
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<WalletController>();
    final media = MediaQuery.maybeOf(context);
    final systemReduce = media?.disableAnimations == true || (media?.accessibleNavigation ?? false);
    if (systemReduce && !controller.reduceMotion) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<WalletController>().setReduceMotion(true);
      });
    }

    final duration = controller.reduceMotion ? Duration.zero : const Duration(milliseconds: 320);
    return AnimatedSwitcher(
      duration: duration,
      switchInCurve: Curves.easeOutCubic,
      switchOutCurve: Curves.easeInCubic,
      transitionBuilder: (child, animation) {
        if (controller.reduceMotion) return child;
        final offset = Tween<Offset>(begin: const Offset(0.04, 0), end: Offset.zero).animate(animation);
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(position: offset, child: child),
        );
      },
      child: KeyedSubtree(
        key: ValueKey(controller.stage),
        child: _screenFor(controller.stage),
      ),
    );
  }

  Widget _screenFor(AppStage stage) {
    switch (stage) {
      case AppStage.splash:
        return const SplashScreen();
      case AppStage.unlock:
        return const UnlockScreen();
      case AppStage.welcome:
        return const WelcomeScreen();
      case AppStage.createExplain:
        return const CreateExplainScreen();
      case AppStage.createBackup:
        return const BackupScreen();
      case AppStage.createVerify:
        return const VerifyScreen();
      case AppStage.importPhrase:
        return const ImportScreen();
      case AppStage.securityPin:
        return const PinScreen();
      case AppStage.securityBiometric:
        return const BiometricScreen();
      case AppStage.permissions:
        return const PermissionsScreen();
      case AppStage.dashboard:
        return const HomeShell();
    }
  }
}

class ScreenScaffold extends StatelessWidget {
  const ScreenScaffold({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.onBack,
    this.footer,
    this.reassure,
    this.showProgress = false,
  });

  final String title;
  final String? subtitle;
  final String? reassure;
  final Widget body;
  final VoidCallback? onBack;
  final Widget? footer;
  final bool showProgress;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = context.watch<WalletController>();
    final wide = MediaQuery.sizeOf(context).width >= 700;
    final maxWidth = wide ? 520.0 : double.infinity;

    return Scaffold(
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      if (onBack != null)
                        IconButton(
                          tooltip: 'Back',
                          onPressed: onBack,
                          icon: const Icon(Icons.arrow_back_rounded),
                          style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
                        )
                      else
                        const SizedBox(width: 48, height: 48),
                      const Spacer(),
                      if (showProgress && c.onboardingStep > 0)
                        Semantics(
                          label: 'Step ${c.onboardingStep} of ${c.onboardingStepCount}',
                          child: Text(
                            '${c.onboardingStep} / ${c.onboardingStepCount}',
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: AetherColors.mutedFor(context),
                            ),
                          ),
                        ),
                    ],
                  ),
                  if (showProgress && c.onboardingStep > 0) ...[
                    const SizedBox(height: 4),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: c.onboardingStep / c.onboardingStepCount,
                        minHeight: 4,
                        backgroundColor: AetherColors.border,
                        color: AetherColors.lagoon,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Text(title, style: theme.textTheme.headlineMedium?.copyWith(height: 1.15)),
                  if (subtitle != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      subtitle!,
                      style: theme.textTheme.bodyLarge?.copyWith(
                        color: AetherColors.mutedFor(context),
                        height: 1.45,
                      ),
                    ),
                  ],
                  if (reassure != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AetherColors.lagoon.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        reassure!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: AetherColors.lagoon,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Expanded(child: body),
                  if (footer != null) ...[
                    const SizedBox(height: 12),
                    footer!,
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
