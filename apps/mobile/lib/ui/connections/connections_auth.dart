import 'package:flutter/material.dart';

import '../../state/wallet_controller.dart';
import '../widgets/passcode_entry.dart';

/// Shared biometric / PIN gate for Web3 approve paths.
///
/// Fails closed when neither biometrics nor a PIN is available — users must
/// set a PIN before approving connections, signatures, or dApp transactions.
Future<bool> authenticateConnectionsAction(
  BuildContext context,
  WalletController wallet, {
  required String reason,
}) async {
  if (wallet.biometricsEnabled) {
    final ok = await wallet.authenticateForTransfer(reason: reason);
    if (ok) return true;
    // Fall through to PIN if biometrics fail/cancel and a PIN exists.
  }

  if (!wallet.hasPin) {
    if (!context.mounted) return false;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set a PIN to continue'),
        content: const Text(
          'Web3 approvals need device protection. Add a PIN in Security Center, then try again.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
        ],
      ),
    );
    return false;
  }

  if (!context.mounted) return false;
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
                'Enter your PIN to confirm this approval.',
                style: TextStyle(height: 1.4),
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
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ),
      );
    },
  );
  return result == true;
}
