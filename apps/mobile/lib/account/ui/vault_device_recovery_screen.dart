import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../account_controller.dart';
import '../vault_recovery_api.dart';
import '../vault_recovery_service.dart';

/// Device B: trusted-device vault recovery after a password-reset email link.
class VaultDeviceRecoveryScreen extends StatefulWidget {
  const VaultDeviceRecoveryScreen({
    super.key,
    this.initialResetToken,
  });

  final String? initialResetToken;

  @override
  State<VaultDeviceRecoveryScreen> createState() => _VaultDeviceRecoveryScreenState();
}

class _VaultDeviceRecoveryScreenState extends State<VaultDeviceRecoveryScreen> {
  late final TextEditingController _tokenCtrl;
  late final TextEditingController _passwordCtrl;
  late final TextEditingController _confirmCtrl;
  VaultRecoveryRequest? _activeRequest;
  bool _waitingForApproval = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tokenCtrl = TextEditingController(text: widget.initialResetToken ?? '');
    _passwordCtrl = TextEditingController();
    _confirmCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _tokenCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _startRequest() async {
    final token = _tokenCtrl.text.trim();
    if (token.length < 20) {
      setState(() => _error = 'Paste the reset link token from your email.');
      return;
    }
    setState(() {
      _error = null;
      _waitingForApproval = true;
    });
    final recovery = context.read<VaultRecoveryService>();
    final created = await recovery.startDeviceRecovery(resetToken: token);
    if (!mounted) return;
    if (created == null) {
      setState(() {
        _waitingForApproval = false;
        _error = recovery.lastError ?? 'Could not start recovery.';
      });
      return;
    }
    setState(() => _activeRequest = created);
  }

  Future<void> _finishRecovery() async {
    final token = _tokenCtrl.text.trim();
    final password = _passwordCtrl.text;
    final request = _activeRequest;
    if (request == null) {
      setState(() => _error = 'Start recovery and wait for approval first.');
      return;
    }
    if (password.length < 12) {
      setState(() => _error = 'New password must be at least 12 characters.');
      return;
    }
    if (password != _confirmCtrl.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    setState(() => _error = null);
    final account = context.read<AccountController>();
    final recovery = context.read<VaultRecoveryService>();
    final ok = await recovery.finishDeviceRecovery(
      account: account,
      resetToken: token,
      requestId: request.requestId,
      newPassword: password,
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop(true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(recovery.lastStatus ?? 'Recovery complete. Sign in with your new password.')),
      );
      return;
    }
    setState(() => _error = recovery.lastError ?? 'Recovery could not be completed.');
  }

  @override
  Widget build(BuildContext context) {
    final recovery = context.watch<VaultRecoveryService>();
    final t = Theme.of(context);
    final busy = recovery.busy || _waitingForApproval;
    return Scaffold(
      appBar: AppBar(title: const Text('Recover on this device')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'After resetting your account password, a trusted device must approve vault access. '
              'Paste the token from your reset email, then choose a new password for this recovery.',
              style: t.textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _tokenCtrl,
              decoration: const InputDecoration(
                labelText: 'Reset token',
                hintText: 'From your password-reset email link',
              ),
              enabled: _activeRequest == null && !recovery.busy,
            ),
            if (_activeRequest == null) ...[
              const SizedBox(height: 20),
              FilledButton(
                onPressed: recovery.busy ? null : _startRequest,
                child: Text(recovery.busy ? 'Starting…' : 'Request trusted-device approval'),
              ),
            ] else ...[
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Waiting for approval', style: t.textTheme.titleSmall),
                      const SizedBox(height: 8),
                      Text(
                        recovery.lastStatus ??
                            'Open Auvora on a device where you are signed in and approve the recovery request in Security Center.',
                      ),
                      if (_activeRequest!.expiresAt != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          'Expires ${_activeRequest!.expiresAt!.toLocal()}',
                          style: t.textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'New account password'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _confirmCtrl,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirm new password'),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: busy ? null : _finishRecovery,
                child: Text(busy ? 'Working…' : 'Finish recovery'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.error)),
            ],
            if (recovery.busy) ...[
              const SizedBox(height: 16),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}
