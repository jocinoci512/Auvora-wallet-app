import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../privacy/sensitive_screen.dart';
import '../../state/wallet_controller.dart';
import '../account_controller.dart';
import '../vault_recovery_service.dart';
import '../vault_sync_service.dart';

/// Emergency vault recovery using the recovery phrase (account must be signed in).
class EmergencyRecoveryScreen extends StatefulWidget {
  const EmergencyRecoveryScreen({super.key});

  @override
  State<EmergencyRecoveryScreen> createState() => _EmergencyRecoveryScreenState();
}

class _EmergencyRecoveryScreenState extends State<EmergencyRecoveryScreen> {
  final _phraseCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _submitting = false;
  String? _error;
  List<String> _addressMismatches = const [];
  bool _acknowledgedMismatch = false;

  @override
  void dispose() {
    _phraseCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkMismatch() async {
    final phrase = _phraseCtrl.text.trim();
    if (phrase.split(RegExp(r'\s+')).length < 12) return;
    final account = context.read<AccountController>();
    final recovery = context.read<VaultRecoveryService>();
    final mismatches = await recovery.findAddressMismatches(
      account: account,
      recoveryPhrase: phrase,
    );
    if (!mounted) return;
    setState(() {
      _addressMismatches = mismatches;
      _acknowledgedMismatch = mismatches.isEmpty;
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final phrase = _phraseCtrl.text.trim();
    final password = _passwordCtrl.text;
    if (phrase.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your recovery phrase and account password.');
      return;
    }
    if (_addressMismatches.isNotEmpty && !_acknowledgedMismatch) {
      setState(() => _error = 'Confirm the address mismatch warning before continuing.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final account = context.read<AccountController>();
    final wallet = context.read<WalletController>();
    final recovery = context.read<VaultRecoveryService>();
    final vaultSync = context.read<VaultSyncService>();
    final ok = await recovery.performEmergencyRecovery(
      account: account,
      wallet: wallet,
      recoveryPhrase: phrase,
      accountPassword: password,
      forceDespiteMismatch: _acknowledgedMismatch && _addressMismatches.isNotEmpty,
    );
    if (!mounted) return;
    if (ok) {
      vaultSync.clearPasswordFlags();
      await vaultSync.reconcileFlags(account: account, wallet: wallet);
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(recovery.lastStatus ?? 'Wallet restored.')),
      );
      return;
    }
    setState(() {
      _submitting = false;
      _error = recovery.lastError ?? 'Emergency recovery failed.';
      if (_addressMismatches.isEmpty &&
          (recovery.lastError?.toLowerCase().contains('mismatch') ?? false)) {
        _addressMismatches = const ['unknown'];
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final recovery = context.watch<VaultRecoveryService>();
    final t = Theme.of(context);
    return SensitiveScope(
      child: Scaffold(
        appBar: AppBar(title: const Text('Emergency recovery')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Use your recovery phrase to unlock the wallet after an account password reset. '
                'Auvora will not replace your wallet automatically.',
                style: t.textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _phraseCtrl,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Recovery phrase',
                  hintText: '12 or 24 English words',
                ),
                onChanged: (_) => _checkMismatch(),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Current account password'),
              ),
              if (_addressMismatches.isNotEmpty) ...[
                const SizedBox(height: 16),
                Card(
                  color: t.colorScheme.errorContainer,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Address mismatch warning',
                          style: t.textTheme.titleSmall,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Addresses derived from this phrase do not match your registered wallet metadata. '
                          'Continuing may restore a different wallet.',
                        ),
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _acknowledgedMismatch,
                          onChanged: _submitting
                              ? null
                              : (v) => setState(() => _acknowledgedMismatch = v ?? false),
                          title: const Text('I understand and want to continue'),
                          controlAffinity: ListTileControlAffinity.leading,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.error)),
              ],
              if (_submitting || recovery.busy) ...[
                const SizedBox(height: 16),
                const LinearProgressIndicator(),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: (_submitting || recovery.busy) ? null : _submit,
                child: Text(_submitting ? 'Restoring…' : 'Restore wallet'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
