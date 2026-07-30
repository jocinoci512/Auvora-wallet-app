import 'package:flutter/material.dart';

import '../../release/release_config.dart';
import '../../theme/aether_theme.dart';
import '../beta/beta_feedback_screen.dart';
import '../home/home_shared.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

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
          SoftBanner(
            tone: BannerTone.warn,
            message: ReleaseConfig.fundingBlockedMessage,
          ),
          const SizedBox(height: 20),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Send beta feedback'),
            subtitle: const Text('Bugs, UX, performance, security, accessibility'),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const BetaFeedbackScreen()),
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Release notes'),
            subtitle: const Text('What changed in this Closed Beta'),
            onTap: () => showActionSheet(
              context,
              title: 'RM2 Closed Beta',
              body:
                  '• Structured beta feedback with optional diagnostics consent\n'
                  '• Receive funding locked until BIP32 derivation\n'
                  '• Live broadcast kill switch off — preview sends only\n'
                  '• Clipboard auto-clear, Android screenshot guard, balance reveal auth\n'
                  '• Web access tokens moved to sessionStorage\n'
                  '• Security trust theater removed (this-device sessions)',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Privacy policy'),
            onTap: () => showActionSheet(
              context,
              title: 'Privacy policy',
              body: 'Draft policy lives on web at /legal. Keys never leave this device for analytics.',
            ),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Terms of service'),
            onTap: () => showActionSheet(
              context,
              title: 'Terms of service',
              body:
                  'Draft terms live on web at /legal. Closed Beta uses preview networks — not live chain guarantees.',
            ),
          ),
        ],
      ),
    );
  }
}
