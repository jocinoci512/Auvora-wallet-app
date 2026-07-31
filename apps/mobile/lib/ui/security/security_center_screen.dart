import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../connections/connections_controller.dart';
import '../../crypto/wallet_crypto.dart';
import '../../intelligence/intelligence_controller.dart';
import '../../portfolio/portfolio_controller.dart';
import '../../security/security_controller.dart';
import '../../security/security_models.dart';
import '../../state/wallet_controller.dart';
import '../../theme/aether_theme.dart';
import '../connections/permission_center_screen.dart';
import '../home/home_shared.dart';
import '../widgets/passcode_entry.dart';

class SecurityCenterScreen extends StatefulWidget {
  const SecurityCenterScreen({super.key});

  @override
  State<SecurityCenterScreen> createState() => _SecurityCenterScreenState();
}

class _SecurityCenterScreenState extends State<SecurityCenterScreen> {
  bool _bootstrapped = false;
  bool _biometricBusy = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) return;
    _bootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<ConnectionsController>().bootstrap();
      if (!mounted) return;
      await context.read<SecurityController>().bootstrap();
    });
  }

  @override
  Widget build(BuildContext context) {
    final security = context.watch<SecurityController>();
    final wallet = context.watch<WalletController>();
    final portfolio = context.watch<PortfolioController>();
    final snapshot = security.buildSnapshot();
    final wide = MediaQuery.sizeOf(context).width >= 900;

    return Scaffold(
      appBar: AppBar(title: const Text('Security Center')),
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: wide ? 760 : double.infinity),
            child: security.loading
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                    children: [
                      Text('Protection you can understand', style: Theme.of(context).textTheme.headlineMedium),
                      const SizedBox(height: 6),
                      const Text(
                        'Review your protection, strengthen weak areas, and respond quickly if something changes.',
                        style: TextStyle(color: AetherColors.muted, height: 1.45),
                      ),
                      const SizedBox(height: 18),
                      _DashboardCard(snapshot: snapshot, wallet: wallet),
                      if (snapshot.recommendations.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _SectionCard(
                          title: 'Recommendations',
                          subtitle: 'Calm guidance — never investment advice.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (final tip in snapshot.recommendations)
                                Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: SoftBanner(message: tip),
                                ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Security checkup',
                        subtitle: 'Improve one step at a time.',
                        child: Column(
                          children: [
                            for (final step in snapshot.checkSteps)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  step.done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                                  color: step.done ? const Color(0xFF067647) : AetherColors.muted,
                                ),
                                title: Text(step.title),
                                subtitle: Text(step.description),
                                trailing: TextButton(
                                  onPressed: () => _runStep(step.id, security, wallet),
                                  child: Text(step.actionLabel),
                                ),
                              ),
                            const SizedBox(height: 8),
                            FilledButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before recording this security review',
                                );
                                if (!allowed) return;
                                await security.reviewNow();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Security review updated')),
                                  );
                                }
                              },
                              child: const Text('Mark checkup reviewed'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Recovery phrase',
                        subtitle: 'Reveal only when necessary, and always after strong confirmation.',
                        child: Column(
                          children: [
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: const Icon(Icons.key_rounded, color: AetherColors.lagoon),
                              title: Text(snapshot.backupComplete ? 'Backup confirmed' : 'Backup still needs confirmation'),
                              subtitle: Text(
                                snapshot.recoveryPhraseVerified
                                    ? 'Your recovery phrase was verified.'
                                    : 'Verification proves you can recover later.',
                              ),
                            ),
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                FilledButton(
                                  onPressed: () => _revealPhrase(security, wallet),
                                  child: const Text('View recovery phrase'),
                                ),
                                OutlinedButton(
                                  onPressed: () => _verifyPhrase(security, wallet),
                                  child: const Text('Verify phrase'),
                                ),
                                TextButton(
                                  onPressed: () async {
                                    final allowed = await _authenticateSensitive(
                                      wallet,
                                      reason: 'Confirm before marking the recovery backup complete',
                                    );
                                    if (!allowed) return;
                                    await security.markBackupComplete();
                                  },
                                  child: const Text('Mark backup complete'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Authentication',
                        subtitle: 'Control how often Auvora asks you to prove it’s really you.',
                        child: Column(
                          children: [
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: wallet.biometricsEnabled,
                              onChanged: _biometricBusy
                                  ? null
                                  : (value) async {
                                      setState(() => _biometricBusy = true);
                                      try {
                                        final allowed = await _authenticateSensitive(
                                          wallet,
                                          reason: value
                                              ? 'Confirm before enabling biometrics'
                                              : 'Confirm before disabling biometrics',
                                        );
                                        if (!allowed || !mounted) return;
                                        await wallet.enableBiometrics(value);
                                        if (value && context.mounted) {
                                          context.read<IntelligenceController>().noteEvent('afterBiometrics');
                                        }
                                        await security.addAlert(
                                          title: value ? 'Biometrics enabled' : 'Biometrics disabled',
                                          description: value
                                              ? 'Biometric unlock was enabled for this device.'
                                              : 'Biometric unlock was turned off for this device.',
                                          recommendedAction:
                                              'Review whether you want a faster unlock path on this device.',
                                          severity: value ? SecurityStatus.good : SecurityStatus.fair,
                                        );
                                      } finally {
                                        if (mounted) setState(() => _biometricBusy = false);
                                      }
                                    },
                              title: const Text('Use device biometrics'),
                              subtitle: Text(
                                _biometricBusy
                                    ? 'Waiting for device confirmation…'
                                    : 'Face ID, Touch ID, or Android biometrics when available.',
                              ),
                            ),
                            const SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: true,
                              onChanged: null,
                              title: Text('Require confirmation before sending funds'),
                              subtitle: Text(
                                'Always required in Closed Beta. Preference wiring ships with live send rails.',
                              ),
                            ),
                            const SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: true,
                              onChanged: null,
                              title: Text('Require confirmation before changing security settings'),
                              subtitle: Text('Always required in Security Center.'),
                            ),
                            const SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: true,
                              onChanged: null,
                              title: Text('Require confirmation before viewing the recovery phrase'),
                              subtitle: Text('Always required before reveal.'),
                            ),
                            const SizedBox(height: 8),
                            FilledButton.tonal(
                              onPressed: wallet.hasPin ? () => _changePin(wallet, security) : null,
                              child: const Text('Change PIN'),
                            ),
                            const SizedBox(height: 8),
                            TextButton(
                              onPressed: () => _forgotPinHelp(context),
                              child: const Text('Forgot PIN?'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _EntitySection<TrustedDevice>(
                        title: 'Trusted devices',
                        subtitle: 'Rename or remove devices you no longer trust.',
                        items: snapshot.trustedDevices,
                        itemBuilder: (device) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            device.current ? Icons.smartphone_rounded : Icons.devices_other_rounded,
                            color: device.trusted ? AetherColors.lagoon : AetherColors.danger,
                          ),
                          title: Text(device.name),
                          subtitle: Text(
                            '${device.platform} · v${device.appVersion} · ${relativeTime(device.lastActiveAt)}',
                          ),
                          trailing: Wrap(
                            spacing: 8,
                            children: [
                              TextButton(
                                onPressed: () => _renameDevice(security, device),
                                child: const Text('Rename'),
                              ),
                              if (!device.current)
                                TextButton(
                                  onPressed: () async {
                                    final allowed = await _authenticateSensitive(
                                      wallet,
                                      reason: 'Confirm before removing this trusted device',
                                    );
                                    if (!allowed) return;
                                    await security.removeDevice(device.id);
                                  },
                                  child: const Text('Remove'),
                                ),
                            ],
                          ),
                        ),
                        footer: TextButton(
                          onPressed: () async {
                            final allowed = await _authenticateSensitive(
                              wallet,
                              reason: 'Confirm before marking devices as reviewed',
                            );
                            if (!allowed) return;
                            await security.markDevicesReviewed();
                          },
                          child: const Text('Mark devices reviewed'),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _EntitySection<ActiveSession>(
                        title: 'Active sessions',
                        subtitle: 'Sign out anything you do not recognize.',
                        items: snapshot.activeSessions,
                        footer: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            OutlinedButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before signing out other sessions',
                                );
                                if (!allowed) return;
                                await security.signOutAllOtherSessions();
                              },
                              child: const Text('Sign out other sessions'),
                            ),
                            TextButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before marking sessions reviewed',
                                );
                                if (!allowed) return;
                                await security.markSessionsReviewed();
                              },
                              child: const Text('Mark sessions reviewed'),
                            ),
                          ],
                        ),
                        itemBuilder: (session) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(
                            session.current ? Icons.verified_user_rounded : Icons.travel_explore_rounded,
                            color: session.current ? AetherColors.lagoon : AetherColors.muted,
                          ),
                          title: Text(session.deviceName),
                          subtitle: Text(
                            '${session.platform} · ${session.location}\n${session.authMethod} · ${relativeTime(session.lastActiveAt)}',
                          ),
                          trailing: session.current
                              ? const Text('Current', style: TextStyle(color: AetherColors.muted))
                              : TextButton(
                                  onPressed: () async {
                                    final allowed = await _authenticateSensitive(
                                      wallet,
                                      reason: 'Confirm before revoking this session',
                                    );
                                    if (!allowed) return;
                                    await security.revokeSession(session.id);
                                  },
                                  child: const Text('Revoke'),
                                ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Connected apps',
                        subtitle: 'Open Permission Center to manage sessions, grants, and pairing.',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              snapshot.connectedDapps.isEmpty
                                  ? 'No active connected apps in this preview.'
                                  : '${snapshot.connectedDapps.length} active app${snapshot.connectedDapps.length == 1 ? '' : 's'} · '
                                      '${snapshot.connectedDapps.where((d) => d.warning != null).length} with elevated risk notes',
                              style: const TextStyle(height: 1.4),
                            ),
                            const SizedBox(height: 8),
                            for (final dapp in snapshot.connectedDapps.take(3))
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(Icons.hub_outlined, color: AetherColors.lagoon),
                                title: Text(dapp.name),
                                subtitle: Text(
                                  '${dapp.website}${dapp.warning == null ? '' : '\n${dapp.warning}'}',
                                  style: const TextStyle(height: 1.35),
                                ),
                              ),
                            FilledButton(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(builder: (_) => const PermissionCenterScreen()),
                                );
                              },
                              child: const Text('Open Permission Center'),
                            ),
                            TextButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before marking connected apps as reviewed',
                                );
                                if (!allowed) return;
                                await security.markDappsReviewed();
                              },
                              child: const Text('Mark connected apps reviewed'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Privacy',
                        subtitle: 'Limit what others can see on this device and in notifications.',
                        child: Column(
                          children: [
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: portfolio.hideBalances,
                              onChanged: portfolio.setHideBalances,
                              title: const Text('Hide balances'),
                            ),
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: security.preferences.hideSensitiveInfo,
                              onChanged: (value) async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before changing privacy visibility',
                                );
                                if (!allowed) return;
                                await security.patchPreferences(
                                  security.preferences.copyWith(hideSensitiveInfo: value),
                                );
                              },
                              title: const Text('Hide sensitive information'),
                            ),
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: security.preferences.analyticsEnabled,
                              onChanged: (value) async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before changing analytics preference',
                                );
                                if (!allowed) return;
                                await security.patchPreferences(
                                  security.preferences.copyWith(analyticsEnabled: value),
                                );
                              },
                              title: const Text('Allow analytics'),
                            ),
                            SwitchListTile(
                              contentPadding: EdgeInsets.zero,
                              value: security.preferences.notificationPrivacy,
                              onChanged: (value) async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before changing notification privacy',
                                );
                                if (!allowed) return;
                                await security.patchPreferences(
                                  security.preferences.copyWith(notificationPrivacy: value),
                                );
                              },
                              title: const Text('Hide balances in notifications'),
                            ),
                            ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: const Text('Clipboard timeout'),
                              subtitle: Text('${security.preferences.clipboardTimeoutSeconds} seconds'),
                              trailing: DropdownButton<int>(
                                value: security.preferences.clipboardTimeoutSeconds,
                                items: const [15, 30, 60, 120]
                                    .map((value) => DropdownMenuItem(value: value, child: Text('$value s')))
                                    .toList(),
                                onChanged: (value) async {
                                  if (value == null) return;
                                  final allowed = await _authenticateSensitive(
                                    wallet,
                                    reason: 'Confirm before changing clipboard timeout',
                                  );
                                  if (!allowed) return;
                                  await security.patchPreferences(
                                    security.preferences.copyWith(clipboardTimeoutSeconds: value),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 8),
                            OutlinedButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before requesting a data export',
                                );
                                if (!allowed) return;
                                await security.requestDataExport();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Export request recorded on this device')),
                                  );
                                }
                              },
                              child: const Text('Request data export'),
                            ),
                            TextButton(
                              onPressed: () async {
                                final allowed = await _authenticateSensitive(
                                  wallet,
                                  reason: 'Confirm before requesting data deletion',
                                );
                                if (!allowed) return;
                                await security.requestDataDeletion();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Deletion request recorded — keep your recovery phrase'),
                                    ),
                                  );
                                }
                              },
                              child: const Text('Request data deletion'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Recent security events',
                        subtitle: 'What happened, why it matters, and what to do next.',
                        child: Column(
                          children: [
                            for (final alert in snapshot.recentAlerts)
                              ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  switch (alert.severity) {
                                    SecurityStatus.excellent => Icons.info_outline_rounded,
                                    SecurityStatus.good => Icons.shield_outlined,
                                    SecurityStatus.fair => Icons.warning_amber_rounded,
                                    SecurityStatus.needsAttention => Icons.error_outline_rounded,
                                  },
                                  color: switch (alert.severity) {
                                    SecurityStatus.excellent => AetherColors.lagoon,
                                    SecurityStatus.good => const Color(0xFF067647),
                                    SecurityStatus.fair => const Color(0xFFB54708),
                                    SecurityStatus.needsAttention => AetherColors.danger,
                                  },
                                ),
                                title: Text(alert.title),
                                subtitle: Text(
                                  '${alert.description}\n${alert.recommendedAction}\n${relativeTime(alert.timestamp)}',
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionCard(
                        title: 'Emergency mode',
                        subtitle: 'Act quickly if you think this device or session may be at risk.',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Emergency mode locks the app immediately, hides balance-bearing notifications, and helps you review access before continuing.',
                              style: TextStyle(color: AetherColors.muted, height: 1.45),
                            ),
                            const SizedBox(height: 12),
                            FilledButton(
                              onPressed: () async {
                                await portfolio.setHideBalances(true);
                                await Clipboard.setData(const ClipboardData(text: ''));
                                await security.emergencyLock();
                              },
                              style: FilledButton.styleFrom(backgroundColor: AetherColors.danger),
                              child: const Text('Lock now'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }

  Future<void> _runStep(String id, SecurityController security, WalletController wallet) async {
    switch (id) {
      case 'backup':
        final backupOk = await _authenticateSensitive(
          wallet,
          reason: 'Confirm before marking backup complete',
        );
        if (!backupOk) return;
        await security.markBackupComplete();
        break;
      case 'verify':
        await _verifyPhrase(security, wallet);
        break;
      case 'biometric':
        final allowed = await _authenticateSensitive(
          wallet,
          reason: wallet.biometricsEnabled
              ? 'Confirm before disabling biometrics'
              : 'Confirm before enabling biometrics',
        );
        if (!allowed) return;
        await wallet.enableBiometrics(!wallet.biometricsEnabled);
        break;
      case 'pin':
        if (wallet.hasPin) {
          await _changePin(wallet, security);
        }
        break;
      case 'devices':
        final devicesOk = await _authenticateSensitive(
          wallet,
          reason: 'Confirm before marking devices reviewed',
        );
        if (!devicesOk) return;
        await security.markDevicesReviewed();
        break;
      case 'dapps':
        await Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const PermissionCenterScreen()),
        );
        if (!mounted) return;
        final dappOk = await _authenticateSensitive(
          wallet,
          reason: 'Confirm after reviewing connected apps',
        );
        if (!dappOk) return;
        await security.markDappsReviewed();
        break;
      case 'sessions':
        final sessionsOk = await _authenticateSensitive(
          wallet,
          reason: 'Confirm before marking sessions reviewed',
        );
        if (!sessionsOk) return;
        await security.markSessionsReviewed();
        break;
      case 'clipboard':
      case 'notifications':
        // Privacy section handles these toggles.
        break;
      case 'app':
        final appOk = await _authenticateSensitive(
          wallet,
          reason: 'Confirm this app version is current',
        );
        if (!appOk) return;
        await security.confirmAppUpdated();
        break;
    }
  }

  Future<void> _forgotPinHelp(BuildContext context) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Forgot PIN?'),
        content: const Text(
          'Auvora cannot reset your PIN remotely. Unlock requires the PIN you set, or restore this wallet with your recovery phrase after wiping local data.\n\n'
          'Never share your recovery phrase. Support will never ask for it.',
          style: TextStyle(height: 1.45),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Got it')),
        ],
      ),
    );
  }

  Future<bool> _authenticateSensitive(WalletController wallet, {required String reason}) async {
    if (wallet.biometricsEnabled) {
      final ok = await wallet.authenticateForTransfer(reason: reason);
      if (ok) return true;
    }
    // Fail closed — sensitive actions require a PIN when biometrics are unavailable.
    if (!wallet.hasPin || !mounted) return false;
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        String? error;
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: StatefulBuilder(
            builder: (ctx, setModal) => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(reason, style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 8),
                const Text(
                  'Enter your PIN if biometrics are unavailable.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AetherColors.muted),
                ),
                const SizedBox(height: 16),
                PasscodeEntry(
                  errorText: error,
                  onCompleted: (pin) async {
                    final ok = await wallet.verifyPin(pin);
                    if (!ok) {
                      setModal(() => error = 'Incorrect passcode. Try again.');
                      return;
                    }
                    if (ctx.mounted) Navigator.pop(ctx, true);
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
    return result == true;
  }

  Future<void> _revealPhrase(SecurityController security, WalletController wallet) async {
    final allowed = await _authenticateSensitive(wallet, reason: 'Confirm before viewing your recovery phrase');
    if (!allowed) return;
    final phrase = await wallet.revealRecoveryPhrase();
    if (!mounted || phrase == null) return;
    await security.addAlert(
      title: 'Recovery phrase viewed',
      description: 'The recovery phrase was revealed on this device.',
      recommendedAction: 'Make sure nobody else can see this screen.',
      severity: SecurityStatus.fair,
    );
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Recovery phrase'),
        content: SelectableText(phrase, style: const TextStyle(height: 1.6)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
        ],
      ),
    );
  }

  Future<void> _verifyPhrase(SecurityController security, WalletController wallet) async {
    final allowed = await _authenticateSensitive(wallet, reason: 'Confirm before verifying your recovery phrase');
    if (!allowed) return;
    final phrase = await wallet.revealRecoveryPhrase();
    if (phrase == null || !mounted) return;
    final words = WalletCrypto.words(phrase);
    final quiz = WalletCrypto.pickQuizIndices(words.length);
    final answers = <int, String>{};
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('Verify recovery phrase'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Pick the correct saved word for each prompt.'),
                const SizedBox(height: 12),
                for (final index in quiz) ...[
                  Text('Word #${index + 1}', style: Theme.of(ctx).textTheme.titleSmall),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: WalletCrypto.quizChoices(words, index).map((option) {
                      final selected = answers[index] == option;
                      return ChoiceChip(
                        label: Text(option),
                        selected: selected,
                        onSelected: (_) => setDialog(() => answers[index] = option),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final passed = quiz.every((index) => answers[index] == words[index]);
                Navigator.pop(ctx, passed);
              },
              child: const Text('Verify'),
            ),
          ],
        ),
      ),
    );
    if (ok == true) {
      await security.markPhraseVerified();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recovery phrase verified')),
        );
      }
    }
  }

  Future<void> _changePin(WalletController wallet, SecurityController security) async {
    final currentCtrl = TextEditingController();
    final nextCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    String? error;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          title: const Text('Change PIN'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: currentCtrl,
                obscureText: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Current PIN'),
              ),
              TextField(
                controller: nextCtrl,
                obscureText: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'New 6-digit PIN'),
              ),
              TextField(
                controller: confirmCtrl,
                obscureText: true,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Confirm new PIN'),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: Theme.of(ctx).colorScheme.error)),
              ],
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () async {
                if (nextCtrl.text != confirmCtrl.text) {
                  setDialog(() => error = 'The new PINs do not match.');
                  return;
                }
                if (nextCtrl.text == currentCtrl.text) {
                  setDialog(() => error = 'Choose a new PIN instead of reusing the current one.');
                  return;
                }
                if (_isWeakPin(nextCtrl.text)) {
                  setDialog(() => error = 'That PIN is too easy to guess. Avoid repeats or simple sequences.');
                  return;
                }
                final changed = await wallet.changePin(
                  currentPin: currentCtrl.text,
                  nextPin: nextCtrl.text,
                );
                if (!changed) {
                  setDialog(() => error = 'Could not change PIN. Confirm the current PIN and use 6 digits.');
                  return;
                }
                if (ctx.mounted) Navigator.pop(ctx, true);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    currentCtrl.dispose();
    nextCtrl.dispose();
    confirmCtrl.dispose();
    if (ok == true) {
      await security.addAlert(
        title: 'PIN changed',
        description: 'The wallet PIN was updated on this device.',
        recommendedAction: 'Make sure the new PIN is memorable but not obvious.',
        severity: SecurityStatus.good,
      );
    }
  }

  Future<void> _renameDevice(SecurityController security, TrustedDevice device) async {
    final ctrl = TextEditingController(text: device.name);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rename device'),
        content: TextField(
          controller: ctrl,
          decoration: const InputDecoration(labelText: 'Device name'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok == true && ctrl.text.trim().isNotEmpty) {
      await security.renameDevice(device.id, ctrl.text.trim());
    }
    ctrl.dispose();
  }

  bool _isWeakPin(String value) {
    const blocked = {
      '000000',
      '111111',
      '123456',
      '654321',
      '121212',
      '112233',
    };
    return blocked.contains(value);
  }
}

class _DashboardCard extends StatelessWidget {
  const _DashboardCard({required this.snapshot, required this.wallet});

  final SecuritySnapshot snapshot;
  final WalletController wallet;

  @override
  Widget build(BuildContext context) {
    final review = snapshot.preferences.lastReviewAt ?? wallet.wallet?.lastSecurityReviewAt;
    final statusLabel = switch (snapshot.status) {
      SecurityStatus.excellent => 'Excellent',
      SecurityStatus.good => 'Good',
      SecurityStatus.fair => 'Fair',
      SecurityStatus.needsAttention => 'Needs attention',
    };
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AetherColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Security dashboard', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                width: 88,
                height: 88,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AetherColors.lagoon.withValues(alpha: 0.08),
                ),
                child: Text(
                  '${snapshot.score}',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(statusLabel, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(
                      review == null ? 'No security review recorded yet' : 'Last reviewed ${relativeTime(review)}',
                      style: const TextStyle(color: AetherColors.muted),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _MiniStat(label: 'Trusted devices', value: '${snapshot.trustedDevices.length}'),
                        _MiniStat(label: 'Biometrics', value: snapshot.biometricsEnabled ? 'On' : 'Off'),
                        _MiniStat(label: 'Backup', value: snapshot.backupComplete ? 'Done' : 'Pending'),
                        _MiniStat(label: 'Active sessions', value: '${snapshot.activeSessions.length}'),
                        _MiniStat(label: 'Connected dApps', value: '${snapshot.connectedDapps.length}'),
                        _MiniStat(label: 'Alerts', value: '${snapshot.recentAlerts.length}'),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AetherColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AetherColors.muted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.subtitle, required this.child});

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AetherColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(color: AetherColors.muted, height: 1.4)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _EntitySection<T> extends StatelessWidget {
  const _EntitySection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.itemBuilder,
    this.footer,
  });

  final String title;
  final String subtitle;
  final List<T> items;
  final Widget Function(T item) itemBuilder;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: title,
      subtitle: subtitle,
      child: Column(
        children: [
          for (final item in items) itemBuilder(item),
          if (footer != null) ...[
            const SizedBox(height: 8),
            footer!,
          ],
        ],
      ),
    );
  }
}
