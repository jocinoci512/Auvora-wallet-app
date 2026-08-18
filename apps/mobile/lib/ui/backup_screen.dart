import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../crypto/wallet_crypto.dart';
import '../preferences/preferences_controller.dart';
import '../privacy/sensitive_screen.dart';
import '../state/wallet_controller.dart';
import '../theme/aether_theme.dart';
import 'app_shell.dart';

class BackupScreen extends StatefulWidget {
  const BackupScreen({super.key});

  @override
  State<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends State<BackupScreen> {
  bool _revealed = false;

  @override
  Widget build(BuildContext context) {
    final c = context.watch<WalletController>();
    final prefs = context.watch<PreferencesController>();
    final mnemonic = c.draftMnemonic ?? '';
    final words = WalletCrypto.words(mnemonic);

    return SensitiveScope(
      keepEnabledOnExit: prefs.screenshotProtectionHint,
      child: ScreenScaffold(
      title: 'Write these words down',
      subtitle:
          'This is your recovery phrase — the only backup of this wallet. Anyone with these words can move your funds. These words are BIP-39 English and do not change when you change the app language.',
      reassure:
          'Auvora does not send this phrase off your device. After setup it stays encrypted in this phone’s secure storage. Write it down — you need it if you lose the device.',
      onBack: c.backToExplain,
      showProgress: true,
      body: Column(
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => setState(() => _revealed = !_revealed),
              child: Text(_revealed ? 'Hide words' : 'Show words'),
            ),
          ),
          Expanded(
            child: GridView.builder(
              itemCount: words.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 2.15,
              ),
              itemBuilder: (context, i) {
                return Semantics(
                  label: _revealed ? 'Word ${i + 1}: ${words[i]}' : 'Word ${i + 1} hidden',
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Theme.of(context).cardTheme.color,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AetherColors.border),
                    ),
                    child: Text(
                      _revealed ? '${i + 1}. ${words[i]}' : '${i + 1}. ••••',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                );
              },
            ),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: c.draftBackupConfirmed,
            onChanged: (words.length == 12 || words.length == 24)
                ? (v) => c.setDraftBackupConfirmed(v ?? false)
                : null,
            controlAffinity: ListTileControlAffinity.leading,
            title: const Text(
              'I wrote these words down and stored them somewhere private.',
              style: TextStyle(fontSize: 14, height: 1.35),
            ),
          ),
        ],
      ),
      footer: FilledButton(
        onPressed: c.draftBackupConfirmed && (words.length == 12 || words.length == 24)
            ? c.continueToVerify
            : null,
        child: const Text('Continue to confirmation'),
      ),
    ),
    );
  }
}
