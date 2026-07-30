import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import 'app_shell.dart';

class BiometricScreen extends StatefulWidget {
  const BiometricScreen({super.key});

  @override
  State<BiometricScreen> createState() => _BiometricScreenState();
}

class _BiometricScreenState extends State<BiometricScreen> {
  bool? _available;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final ok = await context.read<WalletController>().canCheckBiometrics();
      if (mounted) setState(() => _available = ok);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    return ScreenScaffold(
      title: 'Unlock faster next time',
      subtitle:
          'Face ID, Touch ID, or fingerprint can unlock Auvora after your passcode. Biometric data stays on your phone — Auvora never receives it.',
      reassure: 'You can change this later. Passcode always works as backup.',
      showProgress: true,
      body: ListView(
        children: [
          if (_available == false)
            const Text(
              'This device doesn’t offer biometrics right now. Continue with your passcode — you’re still protected.',
            ),
          if (c.errorMessage != null)
            Text(c.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
      ),
      footer: Column(
        children: [
          FilledButton(
            onPressed: _available == false ? null : () => c.enableBiometrics(true),
            child: const Text('Enable biometrics'),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: () => c.enableBiometrics(false),
            child: const Text('Continue with passcode only'),
          ),
        ],
      ),
    );
  }
}
