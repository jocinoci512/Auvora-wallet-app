import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/wallet_controller.dart';
import 'app_shell.dart';
import 'widgets/passcode_entry.dart';

class PinScreen extends StatefulWidget {
  const PinScreen({super.key});

  @override
  State<PinScreen> createState() => _PinScreenState();
}

class _PinScreenState extends State<PinScreen> {
  String? _first;
  String? _localError;

  Future<void> _onCompleted(String pin) async {
    final c = context.read<WalletController>();
    if (_first == null) {
      setState(() {
        _first = pin;
        _localError = null;
      });
      return;
    }
    if (_first != pin) {
      setState(() {
        _first = null;
        _localError = 'Passcodes didn’t match. Choose a new 6-digit passcode.';
      });
      return;
    }
    await c.setPin(pin);
  }

  @override
  Widget build(BuildContext context) {
    final confirming = _first != null;
    return ScreenScaffold(
      title: confirming ? 'Confirm passcode' : 'Create a passcode',
      subtitle: confirming
          ? 'Enter the same 6 digits again.'
          : 'This unlocks Auvora on this phone. Your recovery phrase still protects the wallet itself.',
      reassure: 'Never store your passcode with your recovery phrase.',
      showProgress: true,
      body: PasscodeEntry(
        key: ValueKey(confirming ? 'confirm' : 'create'),
        titleHint: confirming ? null : 'Choose 6 digits you’ll remember.',
        errorText: _localError ?? context.watch<WalletController>().errorMessage,
        onCompleted: _onCompleted,
      ),
    );
  }
}
