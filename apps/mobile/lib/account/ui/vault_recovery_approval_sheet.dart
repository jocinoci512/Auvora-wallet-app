import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';

import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../../ui/widgets/passcode_entry.dart';
import '../account_controller.dart';
import '../vault_recovery_api.dart';
import '../vault_recovery_service.dart';

/// Banner / sheet for trusted-device vault recovery approval.
class VaultRecoveryApprovalBanner extends StatefulWidget {
  const VaultRecoveryApprovalBanner({super.key});

  @override
  State<VaultRecoveryApprovalBanner> createState() => _VaultRecoveryApprovalBannerState();
}

class _VaultRecoveryApprovalBannerState extends State<VaultRecoveryApprovalBanner> {
  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) return;
    _bootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final account = context.read<AccountController>();
      if (!account.isSignedIn) return;
      await context.read<VaultRecoveryService>().refreshPending(account: account);
    });
  }

  Future<bool> _authenticate(WalletController wallet, {required String reason}) async {
    if (wallet.biometricsEnabled) {
      final auth = LocalAuthentication();
      try {
        final ok = await auth.authenticate(
          localizedReason: reason,
          options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
        );
        if (ok) return true;
      } catch (_) {}
    }
    if (!mounted) return false;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        String? error;
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: StatefulBuilder(
            builder: (ctx, setModal) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(reason, style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text(
                  'Enter your PIN if biometrics are unavailable.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AetherColors.muted),
                ),
                const SizedBox(height: 16),
                PasscodeEntry(
                  errorText: error,
                  onCompleted: (pin) async {
                    final ok = await wallet.verifyPin(pin);
                    if (!ok) {
                      setModal(() => error = 'Incorrect passcode. Try again.');
                      return;
                    }
                    if (ctx.mounted) Navigator.pop(ctx, true);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
    return result == true;
  }

  Future<void> _approve(VaultRecoveryRequest request) async {
    final wallet = context.read<WalletController>();
    final account = context.read<AccountController>();
    final recovery = context.read<VaultRecoveryService>();
    final allowed = await _authenticate(
      wallet,
      reason: 'Confirm before approving vault recovery',
    );
    if (!allowed || !mounted) return;

    final password = await _promptAccountPassword();
    if (password == null || password.isEmpty || !mounted) return;

    final ok = await recovery.approvePendingRequest(
      account: account,
      request: request,
      accountPassword: password,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? (recovery.lastStatus ?? 'Recovery approved.')
              : (recovery.lastError ?? 'Could not approve recovery.'),
        ),
      ),
    );
  }

  Future<void> _deny(String requestId) async {
    final account = context.read<AccountController>();
    final recovery = context.read<VaultRecoveryService>();
    final ok = await recovery.denyPendingRequest(account: account, requestId: requestId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Recovery denied.' : (recovery.lastError ?? 'Could not deny.')),
      ),
    );
  }

  Future<String?> _promptAccountPassword() async {
    final ctrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm account password'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Your account password unlocks the encrypted backup so the vault key can be wrapped for the requesting device.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Account password'),
              onSubmitted: (_) => Navigator.pop(ctx, ctrl.text),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text), child: const Text('Continue')),
        ],
      ),
    );
    ctrl.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final recovery = context.watch<VaultRecoveryService>();
    if (!recovery.hasPendingRequests) return const SizedBox.shrink();
    final t = Theme.of(context);
    final request = recovery.pendingRequests.first;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Card(
        color: t.colorScheme.tertiaryContainer,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Vault recovery request', style: t.textTheme.titleSmall),
              const SizedBox(height: 8),
              Text(
                'Another device is trying to recover your wallet after a password reset. '
                'Approve only if you initiated this.',
              ),
              if (request.requestingPlatform != null) ...[
                const SizedBox(height: 6),
                Text('Platform: ${request.requestingPlatform}', style: t.textTheme.bodySmall),
              ],
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton(
                    onPressed: recovery.busy ? null : () => _approve(request),
                    child: const Text('Approve'),
                  ),
                  OutlinedButton(
                    onPressed: recovery.busy ? null : () => _deny(request.requestId),
                    child: const Text('Deny'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
