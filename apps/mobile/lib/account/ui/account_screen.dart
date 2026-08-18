import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../account_controller.dart';
import '../auth_api_client.dart';

/// Auvora account (backend identity) screen: create account, sign in, view
/// profile, sign out. Kept separate from the on-device non-custodial wallet —
/// signing in/out never touches wallet secrets.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final account = context.watch<AccountController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Auvora Account')),
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
        return _ProfileView(account: account);
      case AccountStatus.signedOut:
        return const _AuthForms();
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
              'This build has no Auvora account API configured. Your wallet still '
              'works fully on-device. Account sign-in becomes available in builds '
              'configured with AUVORA_API_BASE_URL.',
              textAlign: TextAlign.center,
              style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileView extends StatelessWidget {
  const _ProfileView({required this.account});
  final AccountController account;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final AuthProfile? p = account.profile;
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
                    'Auvora account never removes or uploads your wallet.',
                    style: t.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
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
          SizedBox(width: 130, child: Text(label, style: t.textTheme.labelLarge)),
          Expanded(child: Text(value, style: t.textTheme.bodyMedium)),
        ],
      ),
    );
  }
}

class _AuthForms extends StatefulWidget {
  const _AuthForms();
  @override
  State<_AuthForms> createState() => _AuthFormsState();
}

class _AuthFormsState extends State<_AuthForms> {
  bool _createMode = false;
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit(AccountController account) async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final ok = _createMode
        ? await account.register(
            email: _email.text.trim(),
            username: _username.text.trim(),
            password: _password.text,
          )
        : await account.signIn(email: _email.text.trim(), password: _password.text);
    if (!mounted) return;
    if (!ok && account.error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(account.error!)));
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
              if (_createMode) ...[
                TextFormField(
                  controller: _username,
                  decoration: const InputDecoration(labelText: 'Username'),
                  validator: (v) => (v == null || v.trim().length < 3)
                      ? 'At least 3 characters'
                      : null,
                ),
                const SizedBox(height: 12),
              ],
              TextFormField(
                controller: _password,
                obscureText: true,
                autofillHints: const [AutofillHints.password],
                decoration: const InputDecoration(labelText: 'Password'),
                validator: (v) => (v == null || v.length < 12)
                    ? 'At least 12 characters'
                    : null,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        FilledButton(
          onPressed: account.busy ? null : () => _submit(account),
          child: account.busy
              ? const SizedBox(
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_createMode ? 'Create account' : 'Sign in'),
        ),
        if (!_createMode)
          TextButton(
            onPressed: account.busy ? null : () => _forgotPassword(account),
            child: const Text('Forgot password?'),
          ),
        const SizedBox(height: 12),
        Text(
          'Your Auvora account is separate from your on-device wallet. We never '
          'receive your recovery phrase or private keys.',
          textAlign: TextAlign.center,
          style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.outline),
        ),
      ],
    );
  }
}
