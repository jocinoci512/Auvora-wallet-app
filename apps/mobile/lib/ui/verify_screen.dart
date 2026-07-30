import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../crypto/wallet_crypto.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  late final List<int> _quiz;
  late final List<String> _words;
  late final Map<int, List<String>> _choices;
  final Map<int, String> _answers = {};
  int _cursor = 0;

  @override
  void initState() {
    super.initState();
    final mnemonic = context.read<WalletController>().draftMnemonic ?? '';
    _words = WalletCrypto.words(mnemonic);
    _quiz = WalletCrypto.pickQuizIndices(_words.length);
    _choices = {
      for (final i in _quiz) i: WalletCrypto.quizChoices(_words, i),
    };
  }

  bool get _complete =>
      _quiz.every((i) => (_answers[i] ?? '') == _words[i]);

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    if (_quiz.isEmpty) {
      return ScreenScaffold(
        title: 'Confirm your backup',
        subtitle: 'Something went wrong generating the quiz.',
        showProgress: true,
        body: const SizedBox.shrink(),
        footer: FilledButton(onPressed: c.continueToBackup, child: const Text('Back to phrase')),
      );
    }

    final index = _quiz[_cursor.clamp(0, _quiz.length - 1)];
    final options = _choices[index] ?? const <String>[];

    return ScreenScaffold(
      title: 'Confirm your backup',
      subtitle: 'Select word #${index + 1}. This proves you saved the phrase — without typing.',
      reassure: 'Take your time. There’s no rush.',
      onBack: c.continueToBackup,
      showProgress: true,
      body: ListView(
        children: [
          Text(
            'Question ${_cursor + 1} of ${_quiz.length}',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AetherColors.muted),
          ),
          const SizedBox(height: 16),
          ...options.map((word) {
            final selected = _answers[index] == word;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                color: selected
                    ? AetherColors.lagoon.withValues(alpha: 0.12)
                    : Theme.of(context).cardTheme.color,
                borderRadius: BorderRadius.circular(14),
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () {
                    setState(() => _answers[index] = word);
                    if (word == _words[index] && _cursor < _quiz.length - 1) {
                      final reduce = c.reduceMotion || MediaQuery.disableAnimationsOf(context);
                      void advance() {
                        if (mounted) setState(() => _cursor += 1);
                      }
                      if (reduce) {
                        advance();
                      } else {
                        Future<void>.delayed(const Duration(milliseconds: 180), advance);
                      }
                    }
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected ? AetherColors.lagoon : AetherColors.border,
                      ),
                    ),
                    child: Text(
                      word,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                    ),
                  ),
                ),
              ),
            );
          }),
          if (c.errorMessage != null)
            Text(c.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
      ),
      footer: FilledButton(
        onPressed: !_complete || c.busy ? null : () => c.commitMnemonic(c.draftMnemonic ?? ''),
        child: Text(c.busy ? 'Securing…' : 'Continue'),
      ),
    );
  }
}
