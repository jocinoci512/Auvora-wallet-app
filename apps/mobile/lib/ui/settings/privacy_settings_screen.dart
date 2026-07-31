import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/portfolio_controller.dart';
import '../../preferences/preferences_controller.dart';
import '../../privacy/screenshot_guard.dart';
import '../../security/security_controller.dart';
import '../../theme/aether_theme.dart';
import '../intelligence/guidance_settings_screen.dart';
import '../security/security_center_screen.dart';

class PrivacySettingsScreen extends StatelessWidget {
  const PrivacySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final portfolio = context.watch<PortfolioController>();
    final security = context.watch<SecurityController>();

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          const Text(
            'Control what others can glance on this device. Protection score and emergency tools stay in Security Center.',
            style: TextStyle(color: AetherColors.muted, height: 1.45),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Hide balances'),
            subtitle: const Text('Mask amounts on Home and asset screens'),
            value: portfolio.hideBalances,
            onChanged: portfolio.setHideBalances,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Require auth to reveal balances'),
            subtitle: const Text('Ask for PIN or biometrics before showing amounts again'),
            value: prefs.requireAuthToRevealBalances,
            onChanged: prefs.setRequireAuthToRevealBalances,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Clear clipboard after copy'),
            subtitle: const Text('Preference for address copies — platform timing varies'),
            value: prefs.clearClipboardAfterCopy,
            onChanged: prefs.setClearClipboardAfterCopy,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Hide balances in notifications'),
            subtitle: const Text('Mask amounts in notification previews'),
            value: security.preferences.notificationPrivacy,
            onChanged: (v) => security.patchPreferences(
              security.preferences.copyWith(notificationPrivacy: v),
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Analytics'),
            subtitle: const Text('Help improve Auvora with anonymous usage (off by default)'),
            value: prefs.analyticsEnabled,
            onChanged: (v) async {
              await prefs.setAnalyticsEnabled(v);
              await security.patchPreferences(security.preferences.copyWith(analyticsEnabled: v));
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Crash reporting'),
            subtitle: const Text(
              'Preference saved on this device. Crash SDK wiring ships before Public Beta — nothing is sent today.',
            ),
            value: prefs.crashReportingEnabled,
            onChanged: (v) async {
              await prefs.setCrashReportingEnabled(v);
              await security.patchPreferences(security.preferences.copyWith(crashReportingEnabled: v));
            },
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Screenshot protection hint'),
            subtitle: const Text('Remind you on sensitive screens where the OS allows'),
            value: prefs.screenshotProtectionHint,
            onChanged: (v) async {
              await prefs.setScreenshotProtectionHint(v);
              await ScreenshotGuard.setEnabled(v);
              await security.patchPreferences(security.preferences.copyWith(screenshotProtection: v));
            },
          ),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Auvora Intelligence'),
            subtitle: const Text(
              'Guidance stays on this device by default. External AI needs your explicit consent in Guidance settings.',
            ),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const GuidanceSettingsScreen(),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Your data', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          const Text(
            'Export and deletion requests are optional and recorded on this device in Closed Beta.',
            style: TextStyle(color: AetherColors.muted, height: 1.4, fontSize: 13),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              await security.requestDataExport();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Export request recorded')),
                );
              }
            },
            child: const Text('Request data export'),
          ),
          TextButton(
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Request data deletion?'),
                  content: const Text(
                    'This records a deletion request. Wiping the wallet on this device still requires unlocking and Account settings. Keep your recovery phrase.',
                  ),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Request')),
                  ],
                ),
              );
              if (ok == true) {
                await security.requestDataDeletion();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Deletion request recorded')),
                  );
                }
              }
            },
            child: const Text('Request data deletion'),
          ),
          const SizedBox(height: 16),
          FilledButton.tonal(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const SecurityCenterScreen()),
            ),
            child: const Text('Open Security Center'),
          ),
        ],
      ),
    );
  }
}
