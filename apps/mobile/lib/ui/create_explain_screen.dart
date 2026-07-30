import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import 'app_shell.dart';

class CreateExplainScreen extends StatelessWidget {
  const CreateExplainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    return ScreenScaffold(
      title: 'Create your wallet',
      subtitle: 'In a moment you’ll see twelve words. They’re the master key to your funds — only you should ever see them.',
      reassure: 'Nothing is generated until you tap continue.',
      onBack: c.goWelcome,
      showProgress: true,
      body: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Step(n: '1', title: 'Write the words', body: 'Use paper. Keep it offline and private.'),
          _Step(n: '2', title: 'Confirm a few words', body: 'A short quiz proves you saved them.'),
          _Step(n: '3', title: 'Protect this phone', body: 'Add a passcode — and biometrics if you like.'),
        ],
      ),
      footer: FilledButton(
        onPressed: c.generateAndShowBackup,
        child: const Text('Show my recovery phrase'),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.title, required this.body});

  final String n;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
            child: Text(
              n,
              style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(body, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
