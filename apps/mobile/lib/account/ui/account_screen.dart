import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/wallet_controller.dart';
import '../../state/wallet_session_restore.dart';
import '../account_controller.dart';
import '../auth_api_client.dart';
import '../account_password_session.dart';
import '../kyc_client.dart';
import '../vault_sync_service.dart';

/// Auvora account (backend identity) screen: create account, sign in, view
/// profile, sign out. Kept separate from the on-device non-custodial wallet —
/// signing in/out never touches wallet secrets.
class AccountScreen extends StatelessWidget {
  const AccountScreen({
    super.key,
    this.onboardingMode = false,
    this.preferSignIn = false,
  });

  /// When true, successful auth pops back and advances wallet onboarding.
  final bool onboardingMode;
  final bool preferSignIn;

  @override
  Widget build(BuildContext context) {
    final account = context.watch<AccountController>();
    return Scaffold(
      appBar: AppBar(
        title: Text(onboardingMode ? 'Welcome to Auvora' : 'Auvora Account'),
      ),
      body: SafeArea(
        child: _body(context, account),
      ),
    );
  }

  Widget _body(BuildContext context, AccountController account) {
    if (!account.isConfigured) {
      return const _NotConfiguredView();
    }
    switch (account.status) {
      case AccountStatus.unknown:
      case AccountStatus.authenticating:
        return const Center(child: CircularProgressIndicator());
      case AccountStatus.signedIn:
        if (onboardingMode) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!context.mounted) return;
            final wallet = context.read<WalletController>();
            if (wallet.hasLocalWallet) {
              wallet.resumeExistingSession();
            } else if (wallet.restoreResolved) {
              wallet.goWalletChoice();
            }
            Navigator.of(context).popUntil((route) => route.isFirst);
          });
          return const Center(child: CircularProgressIndicator());
        }
        return _ProfileView(account: account);
      case AccountStatus.sessionExpired:
        return _AuthForms(
          preferSignIn: true,
          onboardingMode: onboardingMode,
          sessionExpired: true,
        );
      case AccountStatus.signedOut:
        return _AuthForms(preferSignIn: preferSignIn, onboardingMode: onboardingMode);
    }
  }
}

class _NotConfiguredView extends StatelessWidget {
  const _NotConfiguredView();

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, size: 48, color: t.colorScheme.outline),
            const SizedBox(height: 12),
            Text('Account backend not configured', style: t.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'This build refused the configured account API host (localhost / '
              'insecure HTTP are blocked). Your wallet still works fully on-device. '
              'Production builds use https://api.auvorawallet.com.',
              textAlign: TextAlign.center,
              style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileView extends StatefulWidget {
  const _ProfileView({required this.account});
  final AccountController account;

  @override
  State<_ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<_ProfileView> {
  KycStatusSnapshot? _kyc;
  String? _kycError;
  bool _kycBusy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await widget.account.revalidate();
      if (!mounted) return;
      await _loadKyc();
    });
  }

  Future<void> _loadKyc() async {
    final token = await widget.account.readAccessToken();
    if (token == null || token.isEmpty) return;
    setState(() {
      _kycBusy = true;
      _kycError = null;
    });
    try {
      final snap = await KycClient().fetchStatus(accessToken: token);
      if (!mounted) return;
      widget.account.noteAuthenticatedSuccess();
      setState(() {
        _kyc = snap;
        _kycBusy = false;
      });
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _kycError = e.message;
        _kycBusy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _kycError = 'Could not load identity verification status.';
        _kycBusy = false;
      });
    }
  }

  Future<void> _startKyc() async {
    final token = await widget.account.readAccessToken();
    if (token == null || token.isEmpty) return;
    setState(() => _kycBusy = true);
    try {
      await KycClient().submitBasic(accessToken: token);
      await _loadKyc();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Verification submitted. We will update your status shortly.')),
      );
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() => _kycBusy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final account = widget.account;
    final AuthProfile? p = account.profile;
    final vaultSync = context.watch<VaultSyncService>();
    final wallet = context.watch<WalletController>();
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        CircleAvatar(
          radius: 32,
          child: Text(
            (p?.username.isNotEmpty ?? false) ? p!.username[0].toUpperCase() : '?',
            style: t.textTheme.headlineSmall,
          ),
        ),
        const SizedBox(height: 16),
        _row(context, 'Username', p?.username ?? '—'),
        _row(context, 'Email', p?.email ?? '—'),
        _row(context, 'Status', p?.status ?? '—'),
        _row(context, 'Email verified', (p?.emailVerified ?? false) ? 'Yes' : 'No'),
        _row(
          context,
          'Secure backup',
          vaultSync.lastError != null
              ? 'Needs attention'
              : vaultSync.backupIncomplete
                  ? 'Incomplete'
                  : (vaultSync.remoteEpoch != null ||
                          (vaultSync.lastStatus?.toLowerCase().contains('complete') ?? false))
                      ? 'Complete'
                      : vaultSync.needsPasswordForUpload
                          ? 'Pending'
                          : (wallet.unlocked ? 'Ready' : 'Unlock wallet to manage backup'),
        ),
        _row(
          context,
          'Identity verification',
          _kycBusy
              ? 'Loading…'
              : (_kyc?.productLabel ?? (_kycError ?? 'Not started')),
        ),
        if (_kyc?.customerReason != null &&
            _kyc!.customerReason!.isNotEmpty &&
            !_kyc!.isApproved) ...[
          const SizedBox(height: 8),
          Text(
            _kyc!.customerReason!,
            style: t.textTheme.bodySmall,
          ),
        ],
        if (vaultSync.backupIncomplete) ...[
          const SizedBox(height: 12),
          Card(
            color: t.colorScheme.tertiaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                vaultSync.lastStatus ??
                    'Wallet works on this device, but secure backup for other devices is incomplete.',
                style: t.textTheme.bodyMedium,
              ),
            ),
          ),
        ],
        if (vaultSync.needsPasswordForRestore || vaultSync.needsPasswordForUpload) ...[
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: vaultSync.busy
                ? null
                : () => _promptVaultPassword(
                      context,
                      restore: vaultSync.needsPasswordForRestore,
                    ),
            icon: Icon(
              vaultSync.needsPasswordForRestore ? Icons.lock_open : Icons.cloud_done_outlined,
            ),
            label: Text(
              vaultSync.needsPasswordForRestore
                  ? 'Unlock wallet from backup'
                  : 'Finish secure backup',
            ),
          ),
        ] else if (wallet.unlocked &&
            wallet.vaults.isNotEmpty &&
            vaultSync.remoteEpoch == null) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: vaultSync.busy
                ? null
                : () => _promptVaultPassword(context, restore: false),
            icon: const Icon(Icons.cloud_done_outlined),
            label: const Text('Finish secure backup'),
          ),
        ],
        if (vaultSync.lastError != null) ...[
          const SizedBox(height: 8),
          Text(
            vaultSync.lastError!,
            style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.error),
          ),
        ],
        if (account.hasTransportError) ...[
          const SizedBox(height: 16),
          Card(
            color: t.colorScheme.errorContainer,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(account.error!, style: t.textTheme.bodyMedium),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: () => account.revalidate(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.lock_outline),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Auvora keeps an encrypted backup so you can unlock the same wallet '
                    'on your other devices. Your recovery phrase is only needed for emergencies.',
                    style: t.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_kyc == null || !_kyc!.isApproved) ...[
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: _kycBusy ? null : _startKyc,
            icon: const Icon(Icons.verified_user_outlined),
            label: Text(
              _kyc?.needsResubmission == true
                  ? 'Resubmit identity verification'
                  : 'Start identity verification',
            ),
          ),
        ],
        const SizedBox(height: 12),
        FilledButton.tonalIcon(
          onPressed: account.busy ? null : () => account.signOut(),
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'),
        ),
      ],
    );
  }

  Future<void> _promptVaultPassword(BuildContext context, {required bool restore}) async {
    final account = widget.account;
    final wallet = context.read<WalletController>();
    final vaultSync = context.read<VaultSyncService>();
    final success = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _SecureBackupPasswordDialog(
        restore: restore,
        account: account,
        wallet: wallet,
        vaultSync: vaultSync,
      ),
    );
    if (!context.mounted || success != true) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          vaultSync.lastStatus ??
              (restore ? 'Wallet unlocked from secure backup' : 'Secure backup complete'),
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    final t = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(label, style: t.textTheme.labelLarge)),
          Expanded(child: Text(value, style: t.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

/// Owns [TextEditingController] lifecycle so Continue never disposes it while
/// the dialog [TextField] still has InheritedWidget dependents.
class _SecureBackupPasswordDialog extends StatefulWidget {
  const _SecureBackupPasswordDialog({
    required this.restore,
    required this.account,
    required this.wallet,
    required this.vaultSync,
  });

  final bool restore;
  final AccountController account;
  final WalletController wallet;
  final VaultSyncService vaultSync;

  @override
  State<_SecureBackupPasswordDialog> createState() => _SecureBackupPasswordDialogState();
}

class _SecureBackupPasswordDialogState extends State<_SecureBackupPasswordDialog> {
  late final TextEditingController _passwordCtrl;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _passwordCtrl = TextEditingController();
  }

  @override
  void dispose() {
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _onContinue() async {
    if (_submitting) return;
    final password = _passwordCtrl.text;
    if (password.trim().isEmpty) {
      setState(() => _error = 'Enter your Auvora password.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final confirmed = await widget.account.confirmPassword(password);
      if (!mounted) return;
      if (!confirmed) {
        setState(() {
          _submitting = false;
          _error = 'Incorrect password. Please try again.';
        });
        return;
      }

      final ok = widget.restore
          ? await widget.vaultSync.restoreFromCloud(
              account: widget.account,
              wallet: widget.wallet,
              password: password,
            )
          : await widget.vaultSync.uploadLocalVault(
              account: widget.account,
              wallet: widget.wallet,
              password: password,
            );
      if (!mounted) return;
      if (!ok) {
        setState(() {
          _submitting = false;
          _error = widget.vaultSync.lastError ??
              (widget.restore
                  ? 'Incorrect password. Please try again.'
                  : 'Secure backup could not be completed. Please try again.');
        });
        return;
      }
      Navigator.of(context).pop(true);
    } on AuthException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.kind == AuthErrorKind.network ||
                e.kind == AuthErrorKind.timeout ||
                e.kind == AuthErrorKind.server
            ? 'Secure backup could not be completed. Please try again.'
            : (e.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Secure backup could not be completed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.restore ? 'Unlock wallet from backup' : 'Finish secure backup'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.restore
                ? 'Confirm your Auvora password to unlock your wallet on this device.'
                : 'Confirm your Auvora password so this wallet can be unlocked on your other devices.',
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _passwordCtrl,
            obscureText: true,
            enabled: !_submitting,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Account password'),
            onSubmitted: (_) {
              if (!_submitting) _onContinue();
            },
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
            ),
          ],
          if (_submitting) ...[
            const SizedBox(height: 16),
            const LinearProgressIndicator(),
            const SizedBox(height: 8),
            Text(
              widget.restore ? 'Unlocking…' : 'Creating secure backup…',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _onContinue,
          child: Text(_submitting ? 'Please wait…' : 'Continue'),
        ),
      ],
    );
  }
}

class _AuthForms extends StatefulWidget {
  const _AuthForms({
    this.preferSignIn = false,
    this.onboardingMode = false,
    this.sessionExpired = false,
  });
  final bool preferSignIn;
  final bool onboardingMode;
  final bool sessionExpired;

  @override
  State<_AuthForms> createState() => _AuthFormsState();
}

class _AuthFormsState extends State<_AuthForms> {
  late bool _createMode;
  bool _acceptedTerms = false;
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  @override
  void initState() {
    super.initState();
    _createMode = widget.sessionExpired ? false : !widget.preferSignIn;
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  /// Collision-safe username from email local-part + short suffix.
  static String usernameFromEmail(String email) {
    final local = email.split('@').first.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
    final base = (local.isEmpty ? 'auvora' : local).toLowerCase();
    final suffix = DateTime.now().millisecondsSinceEpoch.toRadixString(36).substring(4);
    final combined = '${base}_$suffix';
    return combined.length > 28 ? combined.substring(0, 28) : combined;
  }

  Future<void> _submit(AccountController account) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_createMode && !_acceptedTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Accept the Terms to create an account.')),
      );
      return;
    }
    final email = _email.text.trim();
    final password = _password.text;
    final ok = _createMode
        ? await account.register(
            email: email,
            username: usernameFromEmail(email),
            password: password,
          )
        : await account.signIn(email: email, password: password);
    if (!mounted) return;
    if (_createMode && ok) {
      setState(() => _createMode = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            account.info ??
                'Account created. Check your email for a verification link, then sign in.',
          ),
        ),
      );
      return;
    }
    if (!ok && account.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(account.error!)));
      return;
    }
    if (ok) {
      AccountPasswordSession.capture(password);
      final wallet = context.read<WalletController>();
      final vaultSync = context.read<VaultSyncService>();
      await vaultSync.reconcileFlags(account: account, wallet: wallet);
      if (vaultSync.needsPasswordForRestore) {
        final restored = await vaultSync.restoreFromCloud(
          account: account,
          wallet: wallet,
          password: password,
        );
        if (mounted && restored) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(vaultSync.lastStatus ?? 'Encrypted vault restored')),
          );
        } else if (mounted && vaultSync.lastError != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(vaultSync.lastError!)),
          );
        }
      } else if (wallet.unlocked && wallet.vaults.isNotEmpty) {
        await vaultSync.uploadLocalVault(
          account: account,
          wallet: wallet,
          password: password,
        );
      }
    }
    if (!mounted) return;
    if (ok && widget.onboardingMode) {
      final wallet = context.read<WalletController>();
      if (wallet.hasLocalWallet) {
        wallet.resumeExistingSession();
      } else if (wallet.restoreResolved) {
        wallet.goWalletChoice();
      }
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  Future<void> _resendVerification(AccountController account) async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your email above first.')),
      );
      return;
    }
    await account.resendVerification(email);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          account.info ??
              'If that account needs verification, a new email is on the way.',
        ),
      ),
    );
  }

  Future<void> _forgotPassword(AccountController account) async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your email above first.')),
      );
      return;
    }
    try {
      await AuthApiClient().forgotPassword(email);
    } catch (_) {
      // Enumeration-safe: always show the same generic confirmation.
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('If that account exists, a reset email has been sent.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final account = context.watch<AccountController>();
    final t = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (widget.sessionExpired) ...[
          Text(
            WalletSessionRestore.sessionExpiredMessage,
            style: t.textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'This device wallet stays on the phone. Sign in to continue.',
            style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.outline),
          ),
          const SizedBox(height: 20),
        ] else if (widget.onboardingMode) ...[
          Text(
            _createMode ? 'Create your Auvora account' : 'Sign in to Auvora',
            style: t.textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'The same email and password work on Android and Web. '
            'Wallet keys stay on this device.',
            style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.outline),
          ),
          const SizedBox(height: 20),
        ],
        if (!widget.sessionExpired)
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Sign in')),
            ButtonSegment(value: true, label: Text('Create account')),
          ],
          selected: {_createMode},
          onSelectionChanged: (s) => setState(() => _createMode = s.first),
        ),
        const SizedBox(height: 20),
        Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email'),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(labelText: 'Password'),
                validator: (v) => (v == null || v.length < 12)
                    ? 'At least 12 characters'
                    : null,
              ),
              if (_createMode) ...[
                const SizedBox(height: 12),
                TextFormField(
                  controller: _confirm,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Confirm password'),
                  validator: (v) =>
                      v != _password.text ? 'Passwords do not match' : null,
                ),
                const SizedBox(height: 12),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _acceptedTerms,
                  onChanged: (v) => setState(() => _acceptedTerms = v ?? false),
                  title: const Text('I accept the Auvora Terms of Service'),
                  controlAffinity: ListTileControlAffinity.leading,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: account.busy ? null : () => _submit(account),
          child: account.busy
              ? const SizedBox(
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_createMode ? 'Create Account' : 'Sign In'),
        ),
        if (!_createMode)
          TextButton(
            onPressed: account.busy ? null : () => _forgotPassword(account),
            child: const Text('Forgot password?'),
          ),
        if (!_createMode)
          TextButton(
            onPressed: account.busy ? null : () => _resendVerification(account),
            child: const Text('Resend verification email'),
          ),
        const SizedBox(height: 12),
        Text(
          'Password reset only restores access to your Auvora account. It cannot reset '
          'or restore your secret recovery phrase. Your private keys and crypto funds '
          'remain securely on your device.',
          textAlign: TextAlign.center,
          style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline),
        ),
      ],
    );
  }
}
