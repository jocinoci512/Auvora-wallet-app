import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/wallet_controller.dart';
import '../account_controller.dart';
import '../auth_api_client.dart';
import '../kyc_client.dart';
import '../wallet_backend_sync.dart';

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
            context.read<WalletController>().goWalletChoice();
            Navigator.of(context).popUntil((route) => route.isFirst);
          });
          return const Center(child: CircularProgressIndicator());
        }
        return _ProfileView(account: account);
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
              'QA and release builds use https://api.auvorawallet.com.',
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadKyc());
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
    final sync = context.watch<WalletBackendSync>();
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
          'Wallet metadata',
          sync.lastError != null
              ? 'Sync failed — tap retry'
              : sync.lastSuccessAt != null
                  ? 'Synced (${sync.registeredCount} public addresses)'
                  : wallet.unlocked
                      ? 'Syncing automatically…'
                      : 'Unlock wallet to register public addresses',
        ),
        const SizedBox(height: 8),
        _row(
          context,
          'Identity verification',
          _kycBusy
              ? 'Loading…'
              : (_kyc?.productLabel ?? (_kycError ?? 'Not started')),
        ),
        if (sync.lastError != null) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: sync.busy || !wallet.unlocked
                ? null
                : () => sync.syncIfPossible(account: account, wallet: wallet),
            icon: const Icon(Icons.refresh),
            label: const Text('Retry wallet metadata sync'),
          ),
        ],
        if (account.error != null) ...[
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
                    'Your wallet keys stay on this device. Signing out of your '
                    'Auvora account never removes or uploads your wallet. '
                    'Admin only receives public addresses and review metadata.',
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

class _AuthForms extends StatefulWidget {
  const _AuthForms({this.preferSignIn = false, this.onboardingMode = false});
  final bool preferSignIn;
  final bool onboardingMode;

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
    _createMode = !widget.preferSignIn;
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
    final ok = _createMode
        ? await account.register(
            email: email,
            username: usernameFromEmail(email),
            password: _password.text,
          )
        : await account.signIn(email: email, password: _password.text);
    if (!mounted) return;
    if (!ok && account.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(account.error!)));
      return;
    }
    if (ok && widget.onboardingMode) {
      context.read<WalletController>().goWalletChoice();
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
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
        if (widget.onboardingMode) ...[
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
        const SizedBox(height: 12),
        Text(
          'Your Auvora account is the canonical identity across platforms. '
          'We never receive your recovery phrase or private keys. '
          'Password reset cannot unlock a wallet encrypted with another secret.',
          textAlign: TextAlign.center,
          style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline),
        ),
      ],
    );
  }
}
