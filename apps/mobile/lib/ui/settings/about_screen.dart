import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../release/release_config.dart';
import '../../theme/aether_theme.dart';
import '../beta/beta_feedback_screen.dart';
import '../home/home_shared.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not open $url')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          Text('Auvora Wallet', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            '${ReleaseConfig.buildLabel}\nVersion ${ReleaseConfig.marketingVersion} · Channel ${ReleaseConfig.releaseChannel}',
            style: TextStyle(color: AetherColors.mutedFor(context), height: 1.4),
          ),
          const SizedBox(height: 12),
          const SoftBanner(
            tone: BannerTone.warn,
            message: ReleaseConfig.fundingBlockedMessage,
          ),
          const SizedBox(height: 20),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Send Alpha feedback'),
            subtitle: const Text('Bugs, UX, performance, security, accessibility'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const BetaFeedbackScreen()),
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Release notes'),
            subtitle: const Text('What changed in Version 1.0 Alpha'),
            onTap: () => showActionSheet(
              context,
              title: 'Version 1.0 Alpha',
              body:
                  '• Version 1.0 Alpha packaging for internal testing\n'
                  '• Receive funding locked — QR/copy/share disabled\n'
                  '• Live broadcast kill switch off — preview sends only\n'
                  '• Recovery: on-device activity persists across sync; CoinGecko→CoinCap→seeded price failover\n'
                  '• Integrations: public RPC health probes; optional dart-define keys (never committed)\n'
                  '• Stabilization: biometrics (FragmentActivity), HTTPS offline probe, stale price banners\n'
                  '• Soft-gates: Buy partners / Sell / Bridge / Stake — partner onboarding or hosted checkout when enabled\n'
                  '• Sync is foreground-only (resume, reconnect, pull-to-refresh) — no OS WorkManager yet\n'
                  '• English only; other languages Coming Soon\n'
                  '• Store-ready Android icons, splash, deep links, HTTPS-only network config\n'
                  '• Security Center, Help, Diagnostics, Alpha feedback',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Website'),
            subtitle: const Text(ReleaseConfig.websiteUrl),
            onTap: () => _open(context, ReleaseConfig.websiteUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Privacy policy'),
            subtitle: const Text('Opens the hosted draft policy'),
            onTap: () => _open(context, ReleaseConfig.privacyPolicyUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Terms of service'),
            subtitle: const Text('Opens the hosted draft terms'),
            onTap: () => _open(context, ReleaseConfig.termsOfServiceUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Support'),
            subtitle: const Text(ReleaseConfig.supportEmail),
            onTap: () => _open(context, ReleaseConfig.supportMailto),
          ),
        ],
      ),
    );
  }
}
