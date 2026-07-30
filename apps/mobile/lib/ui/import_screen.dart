import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../intelligence/intelligence_controller.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';
import 'home/home_shared.dart';

class ImportScreen extends StatefulWidget {
  const ImportScreen({super.key});

  @override
  State<ImportScreen> createState() => _ImportScreenState();
}

class _ImportScreenState extends State<ImportScreen> {
  final _controller = TextEditingController();
  String? _localError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int get _wordCount {
    final t = _controller.text.trim();
    if (t.isEmpty) return 0;
    return t.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length;
  }

  Future<void> _submit(WalletController c) async {
    setState(() => _localError = null);
    await c.commitMnemonic(_controller.text);
    if (!mounted) return;
    _controller.clear();
    if (c.errorMessage == null && c.stage == AppStage.securityPin) {
      context.read<IntelligenceController>().noteEvent('afterImport');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final error = _localError ?? c.errorMessage;
    final count = _wordCount;

    return ScreenScaffold(
      title: 'Import wallet',
      subtitle:
          'Enter the recovery phrase from your existing wallet. Validation happens on this device.',
      reassure: 'Never enter a phrase someone else typed or sent to you.',
      onBack: c.goWelcome,
      showProgress: true,
      body: ListView(
        children: [
          const SoftBanner(
            tone: BannerTone.info,
            message:
                'Make sure nobody can see your screen. Auvora never asks for this phrase by email or chat.',
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            minLines: 4,
            maxLines: 6,
            autocorrect: false,
            enableSuggestions: false,
            textCapitalization: TextCapitalization.none,
            decoration: InputDecoration(
              hintText: 'word1 word2 word3 …',
              alignLabelWithHint: true,
              labelText: 'Recovery phrase',
              helperText: count == 0
                  ? '12 or 24 words, separated by spaces'
                  : '$count words · ${count == 12 || count == 24 ? 'looks ready' : 'needs 12 or 24'}',
              helperStyle: TextStyle(
                color: (count == 12 || count == 24) ? AetherColors.lagoon : AetherColors.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
            onChanged: (_) {
              setState(() {});
              if (_localError != null) setState(() => _localError = null);
            },
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            SoftBanner(tone: BannerTone.error, message: error),
          ],
        ],
      ),
      footer: FilledButton(
        onPressed: c.busy || (count != 12 && count != 24) ? null : () => _submit(c),
        child: Text(c.busy ? 'Importing…' : 'Import on this device'),
      ),
    );
  }
}
