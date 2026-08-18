import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../crypto/phrase_confirmation.dart';
import '../preferences/preferences_controller.dart';
import '../privacy/sensitive_screen.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';

class VerifyScreen extends StatefulWidget {
  const VerifyScreen({super.key});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  PhraseConfirmationSession? _session;
  PhraseAdvanceScheduler? _scheduler;
  Object? _initError;

  @override
  void initState() {
    super.initState();
    try {
      final mnemonic = context.read<WalletController>().draftMnemonic ?? '';
      _session = PhraseConfirmationSession.fromMnemonic(mnemonic);
      _scheduler = PhraseAdvanceScheduler(
        session: _session!,
        onTick: () {
          if (mounted) setState(() {});
        },
      );
    } catch (e) {
      _initError = e;
    }
  }

  @override
  void dispose() {
    _scheduler?.cancel();
    super.dispose();
  }

  void _onSelect(String word) {
    final session = _session;
    if (session == null) return;
    _scheduler?.cancel();
    final ok = session.select(word);
    setState(() {});
    if (!ok) return;
    if (session.onLastQuestion) return;
    final c = context.read<WalletController>();
    final reduce = c.reduceMotion || MediaQuery.disableAnimationsOf(context);
    _scheduler?.schedule(reduceMotion: reduce);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final prefs = context.watch<PreferencesController>();
    final session = _session;

    if (_initError != null || session == null) {
      return SensitiveScope(
        keepEnabledOnExit: prefs.screenshotProtectionHint,
        child: ScreenScaffold(
          title: 'Confirm your backup',
          subtitle: 'Something went wrong generating the quiz.',
          showProgress: true,
          body: const SizedBox.shrink(),
          footer: FilledButton(onPressed: c.continueToBackup, child: const Text('Back to phrase')),
        ),
      );
    }

    final index = session.currentIndex;
    final options = session.currentChoices;

    return SensitiveScope(
      keepEnabledOnExit: prefs.screenshotProtectionHint,
      child: ScreenScaffold(
        title: 'Confirm your backup',
        subtitle: 'Select word #${index + 1}. Only the word you wrote in that position is accepted.',
        reassure: 'A wrong choice stays on this step. Auvora will not reveal the answer.',
        onBack: c.continueToBackup,
        showProgress: true,
        body: ListView(
          children: [
            Text(
              'Question ${session.cursor + 1} of ${session.positions.length}',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AetherColors.muted),
            ),
            const SizedBox(height: 16),
            ...options.map((word) {
              final selected = session.answers[index] == word;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: selected
                      ? AetherColors.lagoon.withValues(alpha: 0.12)
                      : Theme.of(context).cardTheme.color,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => _onSelect(word),
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
            if (session.error != null) ...[
              const SizedBox(height: 8),
              Text(
                session.error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error, height: 1.4),
              ),
            ],
            if (c.errorMessage != null)
              Text(c.errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ),
        footer: FilledButton(
          onPressed: !session.complete || c.busy
              ? null
              : () => c.commitMnemonic(c.draftMnemonic ?? '', backupQuizPassed: session.complete),
          child: Text(c.busy ? 'Securing…' : 'Continue'),
        ),
      ),
    );
  }
}
