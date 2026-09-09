import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../release/app_update_policy.dart';
import '../../theme/aether_theme.dart';

/// Blocking gate for security-required minimum versions.
/// Does not clear wallet or account data.
class RequiredUpdateGate extends StatelessWidget {
  const RequiredUpdateGate({super.key, required this.decision});

  final AppUpdateDecision decision;

  Future<void> _openStore() async {
    final uri = Uri.parse(decision.policy.storeUrl);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              Text(
                'Auvora Wallet',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: AetherColors.ink,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                decision.requiredMessage,
                style: theme.textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                'Your wallet and account data stay on this device. '
                'Update the same Auvora Wallet app from the official store.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              FilledButton(
                onPressed: _openStore,
                child: const Text('Update Auvora Wallet'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Non-blocking banner for ordinary recommended updates (cooldown-aware).
class OptionalUpdateBanner extends StatelessWidget {
  const OptionalUpdateBanner({
    super.key,
    required this.decision,
    required this.onLater,
    required this.onUpdate,
  });

  final AppUpdateDecision decision;
  final VoidCallback onLater;
  final VoidCallback onUpdate;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'A newer Auvora Wallet is available.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              TextButton(onPressed: onLater, child: const Text('Later')),
              FilledButton.tonal(
                onPressed: onUpdate,
                child: const Text('Update'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
