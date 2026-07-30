import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import 'widgets/passcode_entry.dart';

class UnlockScreen extends StatelessWidget {
  const UnlockScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 20),
          child: Column(
            children: [
              Text('Auvora', style: Theme.of(context).textTheme.headlineLarge),
              const SizedBox(height: 8),
              Text(
                'Enter your passcode to continue',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 28),
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
    );
  }
}
