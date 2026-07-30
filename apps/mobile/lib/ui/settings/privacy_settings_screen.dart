import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../portfolio/portfolio_controller.dart';
import '../../preferences/preferences_controller.dart';
import '../../privacy/screenshot_guard.dart';
import '../../theme/aether_theme.dart';
import '../intelligence/guidance_settings_screen.dart';
import '../security/security_center_screen.dart';

class PrivacySettingsScreen extends StatelessWidget {
  const PrivacySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final prefs = context.watch<PreferencesController>();
    final portfolio = context.watch<PortfolioController>();

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
            title: const Text('Analytics'),
            subtitle: const Text('Help improve Auvora with anonymous usage (off by default)'),
            value: prefs.analyticsEnabled,
            onChanged: prefs.setAnalyticsEnabled,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Crash reporting'),
            subtitle: const Text('Send crash diagnostics without seed phrases or keys'),
            value: prefs.crashReportingEnabled,
            onChanged: prefs.setCrashReportingEnabled,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Screenshot protection hint'),
            subtitle: const Text('Remind you on sensitive screens where the OS allows'),
            value: prefs.screenshotProtectionHint,
            onChanged: (v) async {
              await prefs.setScreenshotProtectionHint(v);
              await ScreenshotGuard.setEnabled(v);
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
